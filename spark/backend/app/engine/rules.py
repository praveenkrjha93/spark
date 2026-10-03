"""Deterministic warranty rules layer — Oben Electric bulletin OBEN/Service/2025/001.

Evaluates every structured rejection criterion from Annexure A before the
narrative reasoning layer runs. Returns a RulesResult with individual check
outcomes that the orchestrator and LLM can cite.

Rejection categories implemented (matching Oben Annexure A):
  1. part-found-ok         — no defect reproducible (needs investigation evidence)
  2. external-damage       — physical damage from mishandling
  3. external-repair       — tampering / unauthorised rework
  4. duplicate-local-part  — non-listed-vendor / non-genuine parts
  5. extreme-condition     — stunts, overload, extreme weather/mud
  6. non-genuine-accessory — aftermarket accessories altering the vehicle
  7. claim-mismatch        — administrative / paperwork gaps (warn, not hard-fail)
  Plus: coverage-period, mileage-exceeded, non-genuine-parts, lapsed-service-schedule,
        battery-soh (judgment trigger).
"""
from __future__ import annotations

from datetime import date

from dateutil.relativedelta import relativedelta

from app.enums import RejectionCategory
from app.integrations.base import CRMRecord, TelematicsSnapshot
from app.models import Claim, Policy
from app.engine.types import RuleCheck, RulesResult

# ISO date string: vehicles sold before this use old_part_limits.
_ERA_BOUNDARY = date(2025, 5, 1)

# Canonical component key → part_limits lookup key.
# Maps every plausible input (from the dealer's free-text form) to a single key.
_COMPONENT_ALIASES: dict[str, str] = {
    # Battery / BMS
    "battery": "battery", "battery pack": "battery", "bms": "battery",
    "battery management system": "battery", "traction battery": "battery",
    "lithium battery": "battery", "cell": "battery", "cells": "battery",
    "battery assy": "battery", "battery assembly": "battery",
    # Motor
    "motor": "motor", "drive motor": "motor", "motor assy": "motor",
    "electric motor": "motor", "hub motor": "motor",
    # HMI / Dashboard
    "hmi": "hmi", "hmi assy": "hmi", "dashboard": "hmi",
    "instrument cluster": "hmi", "display": "hmi", "screen": "hmi",
    "speedometer": "hmi", "cluster": "hmi",
    # Charger
    "charger": "charger", "onboard charger": "charger",
    "charging unit": "charger", "charger assy": "charger",
    "charger assembly": "charger",
    # Main Frame
    "frame": "main-frame", "main frame": "main-frame", "chassis": "main-frame",
    "frame assembly": "main-frame", "main frame assy": "main-frame",
    # DCDC Converter
    "dcdc": "dcdc-converter", "dc-dc": "dcdc-converter",
    "dcdc converter": "dcdc-converter", "dc dc converter": "dcdc-converter",
    "dcdc assy": "dcdc-converter", "dc-dc converter": "dcdc-converter",
    # Motor Controller / Inverter
    "controller": "motor-controller", "motor controller": "motor-controller",
    "mcu": "motor-controller", "inverter": "motor-controller",
    "motor controller assy": "motor-controller",
    # Front Fork / Oil Seal / Suspension
    "fork": "front-fork", "front fork": "front-fork", "oil seal": "front-fork",
    "front fork oil seal": "front-fork", "suspension": "front-fork",
    "front suspension": "front-fork",
    # Drive Belt / Pulley
    "belt": "drive-belt", "drive belt": "drive-belt",
    "drive belt pulley": "drive-belt", "belt pulley": "drive-belt",
    "belt drive": "drive-belt", "pulley": "drive-belt",
    "rear pulley": "drive-belt", "front pulley": "drive-belt",
    # Switches
    "switch": "switches", "switches": "switches",
    "handlebar switch": "switches", "rh switch": "switches",
    "lh switch": "switches", "rh lh switch": "switches",
    "rh/ lh switch": "switches",
    # Horn
    "horn": "horn", "horn assy": "horn", "horn assembly": "horn",
    # Mono Shock / Rear Shock
    "shock": "mono-shock", "mono shock": "mono-shock",
    "rear shock": "mono-shock", "shock absorber": "mono-shock",
    "mono shock assy": "mono-shock", "rear suspension": "mono-shock",
    # Wire Harness
    "harness": "wire-harness", "wire harness": "wire-harness",
    "wiring harness": "wire-harness", "lt wire harness": "wire-harness",
    "lt harness": "wire-harness", "lt wiring": "wire-harness",
    # Indicators / Turn Signals
    "indicator": "indicators", "indicators": "indicators",
    "turn signal": "indicators", "blinker": "indicators",
    "flasher": "indicators",
    # Front Rim
    "front rim": "front-rim", "front wheel": "front-rim",
    "front rim assy": "front-rim", "front wheel rim": "front-rim",
    # Rear Rim
    "rear rim": "rear-rim", "rear wheel": "rear-rim",
    "rear rim assy": "rear-rim", "rear wheel rim": "rear-rim",
    # Throttle
    "throttle": "throttle", "throttle assy": "throttle",
    "throttle assembly": "throttle",
}

# ── Keywords for Annexure A categories ───────────────────────────────────────

# Category 2: External damage (physical mishandling)
_EXTERNAL_DAMAGE_KW = (
    "physically damaged", "physical damage", "dented", "dent", "cracked",
    "crack", "broken casing", "impact damage", "dropped", "scratched casing",
    "crushed", "bent", "broken due to impact", "mishandled",
)

# Category 3: External repair / tampering / unauthorised modification
_EXTERNAL_REPAIR_KW = (
    "tampered", "tampering", "modified", "modification", "unauthorised repair",
    "unauthorized repair", "outside repair", "external repair", "rework",
    "soldered", "wire cut", "cut wire", "wires cut", "jumped",
    "opened by customer", "opened outside", "tool marks", "scratch on fastener",
    "non-authorised", "non-authorized",
)

# Category 4: Duplicate / local (non-listed vendor) parts
_DUPLICATE_PART_KW = (
    "local part", "local belt", "local horn", "local throttle",
    "non-listed", "non-oem", "aftermarket part", "compatible part",
    "duplicate part", "non-genuine part", "counterfeit",
)

# Category 5: Extreme condition usage
_EXTREME_CONDITION_KW = (
    "stunt", "stunts", "wheelie", "overload", "overloaded",
    "flooded", "submerged", "water logging", "waterlogged", "deep water",
    "mud", "muddy", "off-road", "off road", "racing", "excessive speed",
    "heavy load", "overloading", "extreme condition", "extreme weather",
)

# Category 6: Non-genuine accessory fitment (alters vehicle electrical/mech)
_ACCESSORY_KW = (
    "extra horn", "additional horn", "led light", "led fitment", "usb socket",
    "usb charger", "rear hugger", "rear axle attachment", "added accessory",
    "non-genuine accessory", "aftermarket accessory", "external accessory",
    "added electrical", "extra electrical", "extra load",
)

# Negation prefixes that flip a keyword match from positive to neutral
_NEGATIONS = ("no ", "not ", "never ", "without ", "n't ", "free of ", "denies ")


def _normalize_component(raw: str) -> str:
    """Return the canonical component key, or the original lower-stripped value."""
    return _COMPONENT_ALIASES.get(raw.strip().lower(), raw.strip().lower())


def _get_limits(component_key: str, policy: Policy, sale_date: date | None) -> tuple[int, int]:
    """Return (coverage_months, coverage_km) for the component in the correct era.

    Handles both `years` and `months` entries in part_limits.
    Falls back to the policy-level battery/general limits if the component is not listed.
    """
    if sale_date and policy.era_boundary:
        boundary = date.fromisoformat(policy.era_boundary)
        limits_dict = policy.old_part_limits if sale_date < boundary else policy.part_limits
    else:
        limits_dict = policy.part_limits

    entry = limits_dict.get(component_key) if limits_dict else None

    if entry:
        km = int(entry.get("km", 0))
        if "months" in entry:
            return int(entry["months"]), km
        return int(entry.get("years", 1)) * 12, km

    # Fall back to policy-level limits (battery uses battery_coverage_*, else general)
    if component_key == "battery":
        return policy.battery_coverage_years * 12, policy.battery_coverage_km
    return policy.coverage_years * 12, policy.coverage_km


def _affirmative_match(text: str, keywords: tuple[str, ...]) -> str | None:
    """Return the first keyword that appears in text without a preceding negation, else None."""
    low = text.lower()
    for kw in keywords:
        pos = low.find(kw)
        while pos != -1:
            prefix = low[max(0, pos - 18):pos]
            if not any(neg in prefix for neg in _NEGATIONS):
                return kw
            pos = low.find(kw, pos + 1)
    return None


def _service_check(claim: Claim, policy: Policy, crm: CRMRecord) -> RuleCheck:
    services = [j for j in crm.job_cards if j.work_type == "scheduled-service"]
    if not services:
        return RuleCheck("service-schedule", "5.1", None,
                         "No scheduled-service records found in CRM.")
    last = max(services, key=lambda j: j.date)
    grace = relativedelta(months=12, days=policy.max_service_overdue_days)
    due_by = last.date + grace
    if claim.claim_date > due_by:
        return RuleCheck(
            "service-schedule", "5.1", False,
            f"Last scheduled service {last.date}; service overdue beyond grace (due by {due_by}).",
            RejectionCategory.LAPSED_SERVICE_SCHEDULE.value,
        )
    return RuleCheck("service-schedule", "5.1", True,
                     f"Service schedule adhered to (last service {last.date}).")


def _fail(result: RulesResult, category: str, clause: str) -> None:
    result.hard_fail = True
    result.fail_category = category
    result.fail_clause = clause


def evaluate(
    claim: Claim,
    policy: Policy,
    crm: CRMRecord,
    telematics: TelematicsSnapshot,
) -> RulesResult:
    result = RulesResult()
    raw_component = claim.component.strip()
    component_key = _normalize_component(raw_component)
    desc = claim.failure_description

    # ── ADMINISTRATIVE WARNINGS (category 7 — warn, do not hard-fail) ────────
    admin_warns: list[str] = []
    if not claim.dealer:
        admin_warns.append("Dealer / service centre not specified on the claim.")
    if claim.odometer_km == 0:
        admin_warns.append("Odometer reading is zero — verify at job card.")
    if not claim.failure_description or len(claim.failure_description.strip()) < 15:
        admin_warns.append("Failure description is too brief; add technician narrative.")
    if claim.claim_date > date.today():
        admin_warns.append(f"Claim date {claim.claim_date} is in the future.")
    if not crm.sale_date:
        admin_warns.append("Vehicle sale date not in CRM; coverage period cannot be verified.")
    if admin_warns:
        result.checks.append(RuleCheck(
            "admin-completeness", "6.1", None,
            "Admin warnings: " + " | ".join(admin_warns),
        ))

    # ── CATEGORY 2: External damage ───────────────────────────────────────────
    kw = _affirmative_match(desc, _EXTERNAL_DAMAGE_KW)
    if kw:
        result.checks.append(RuleCheck(
            "external-damage", "4.1", None,
            f"Failure narrative mentions physical damage ('{kw}'). "
            "Inspect for mishandling; photograph job card before repair. "
            "Confirm before rejecting — may still be covered if damage is coincidental.",
        ))
        result.undetermined = True   # needs human confirmation; not auto-rejected

    # ── CATEGORY 3: External repair / tampering ───────────────────────────────
    kw = _affirmative_match(desc, _EXTERNAL_REPAIR_KW)
    if kw:
        result.checks.append(RuleCheck(
            "external-repair", "4.2", False,
            f"Narrative indicates tampering or unauthorised repair ('{kw}'). "
            "Warranty is void on the affected assembly.",
            RejectionCategory.EXTERNAL_REPAIR.value,
        ))
        _fail(result, RejectionCategory.EXTERNAL_REPAIR.value, "4.2")
        return result

    # ── CATEGORY 4: Duplicate / local part ───────────────────────────────────
    kw = _affirmative_match(desc, _DUPLICATE_PART_KW)
    if kw or not claim.parts_genuine:
        detail = (
            f"Non-listed/local vendor part referenced in narrative ('{kw}')."
            if kw else "Dealer declared non-genuine parts were used."
        )
        result.checks.append(RuleCheck(
            "genuine-parts", "5.2", False, detail,
            RejectionCategory.DUPLICATE_LOCAL_PART.value,
        ))
        _fail(result, RejectionCategory.DUPLICATE_LOCAL_PART.value, "5.2")
        return result

    # ── CATEGORY 5: Extreme condition usage ───────────────────────────────────
    kw = _affirmative_match(desc, _EXTREME_CONDITION_KW)
    if kw:
        result.checks.append(RuleCheck(
            "extreme-condition", "4.4", None,
            f"Narrative suggests extreme condition usage ('{kw}'). "
            "Confirm with customer: is vehicle used for intended purpose? "
            "Check telematics for riding pattern before deciding.",
        ))
        result.undetermined = True

    # ── CATEGORY 6: Non-genuine accessory fitment ─────────────────────────────
    kw = _affirmative_match(desc, _ACCESSORY_KW)
    if kw:
        result.checks.append(RuleCheck(
            "non-genuine-accessory", "4.5", None,
            f"Non-genuine accessory mentioned ('{kw}'). "
            "Warranty is void on components affected by the accessory. "
            "Educate customer to remove the accessory.",
        ))
        result.undetermined = True

    # ── COMPONENT COVERAGE ────────────────────────────────────────────────────
    excluded = {c.lower() for c in policy.excluded_components}
    covered_raw = {c.lower() for c in policy.covered_components}
    covered_keys = {_normalize_component(c) for c in covered_raw}

    if raw_component.lower() in excluded or component_key in excluded:
        result.checks.append(RuleCheck(
            "component-excluded", "2.1", False,
            f"'{raw_component}' is a wear/consumable item excluded from warranty coverage.",
            RejectionCategory.EXCLUDED_COMPONENT.value,
        ))
        _fail(result, RejectionCategory.EXCLUDED_COMPONENT.value, "2.1")
        return result

    if component_key in covered_keys or raw_component.lower() in covered_raw:
        result.checks.append(RuleCheck(
            "component-covered", "2.1", True,
            f"'{raw_component}' is a covered component.",
        ))
    else:
        result.checks.append(RuleCheck(
            "component-covered", "2.1", None,
            f"'{raw_component}' is not explicitly listed as covered or excluded. "
            "Discuss with HO on a case-by-case basis; PFR may be required.",
        ))
        result.undetermined = True

    # ── COVERAGE PERIOD + KM LIMIT (per-component, era-aware) ─────────────────
    sale_date = crm.sale_date
    coverage_months, km_limit = _get_limits(component_key, policy, sale_date)

    if sale_date is None:
        result.checks.append(RuleCheck(
            "coverage-period", "3.1", None,
            "Sale date unavailable from CRM; cannot verify coverage window.",
        ))
        result.undetermined = True
    else:
        expiry = sale_date + relativedelta(months=coverage_months)
        era = "old era" if (policy.era_boundary and sale_date < date.fromisoformat(policy.era_boundary)) else "new era"
        if claim.claim_date > expiry:
            result.checks.append(RuleCheck(
                "coverage-period", "3.1", False,
                f"Claim date {claim.claim_date} is past coverage expiry {expiry} "
                f"({coverage_months} months / {coverage_months//12}Y from sale {sale_date}, {era}).",
                RejectionCategory.OUT_OF_COVERAGE_PERIOD.value,
            ))
            _fail(result, RejectionCategory.OUT_OF_COVERAGE_PERIOD.value, "3.1")
            return result
        result.checks.append(RuleCheck(
            "coverage-period", "3.1", True,
            f"Within coverage window (expires {expiry}, {era}).",
        ))

    if claim.odometer_km > km_limit:
        result.checks.append(RuleCheck(
            "coverage-mileage", "3.1", False,
            f"Odometer {claim.odometer_km:,} km exceeds {raw_component} "
            f"coverage limit {km_limit:,} km.",
            RejectionCategory.MILEAGE_EXCEEDED.value,
        ))
        _fail(result, RejectionCategory.MILEAGE_EXCEEDED.value, "3.1")
        return result
    result.checks.append(RuleCheck(
        "coverage-mileage", "3.1", True,
        f"Odometer {claim.odometer_km:,} km is within the {km_limit:,} km limit.",
    ))

    # ── SERVICE SCHEDULE ──────────────────────────────────────────────────────
    if policy.service_schedule_required:
        check = _service_check(claim, policy, crm)
        result.checks.append(check)
        if check.passed is False:
            _fail(result, RejectionCategory.LAPSED_SERVICE_SCHEDULE.value, "5.1")
            return result

    # ── BATTERY-SPECIFIC CHECKS (Annexure C) ─────────────────────────────────
    if component_key == "battery":
        soh = telematics.battery_soh_pct
        # High DC fast-charge cycles can degrade battery prematurely.
        dc_cycles = telematics.dc_fast_charge_cycles
        if soh < policy.battery_min_soh_pct:
            result.checks.append(RuleCheck(
                "battery-soh", "3.2", True,
                f"Battery SoH {soh}% is below {policy.battery_min_soh_pct}% threshold "
                "— eligible for replacement under clause 3.2.",
            ))
        else:
            result.checks.append(RuleCheck(
                "battery-soh", "3.2", None,
                f"Battery SoH {soh}% is at/above {policy.battery_min_soh_pct}% threshold. "
                "Capacity-loss claim requires BMS App check, charging behaviour review, "
                "and telematics analysis before accepting.",
            ))
            result.undetermined = True
        # Excessive DC fast-charge flag.
        if dc_cycles > 200:
            result.checks.append(RuleCheck(
                "battery-dc-cycles", "3.2", None,
                f"High DC fast-charge cycles ({dc_cycles}) — check if customer charging "
                "behaviour contributed to degradation (clause 3.2).",
            ))
            result.undetermined = True
        # Deep discharge — check if battery was left uncharged.
        desc_low = desc.lower()
        if "deep discharge" in desc_low or "completely discharged" in desc_low:
            result.checks.append(RuleCheck(
                "battery-deep-discharge", "3.2", None,
                "Claim mentions deep discharge. Check: was the battery left uncharged "
                "for an extended period? Customer negligence may void coverage.",
            ))
            result.undetermined = True

    # ── MOTOR-SPECIFIC CHECKS (Annexure C) ────────────────────────────────────
    if component_key == "motor":
        desc_low = desc.lower()
        if any(w in desc_low for w in ("water", "submerged", "flood", "waterlogged")):
            result.checks.append(RuleCheck(
                "motor-water-ingress", "4.4", None,
                "Description suggests possible water ingress. Confirm riding conditions "
                "— submerged water-logging voids coverage (clause 4.4).",
            ))
            result.undetermined = True

    # ── HMI-SPECIFIC CHECKS (Annexure C) ──────────────────────────────────────
    if component_key == "hmi":
        desc_low = desc.lower()
        if any(w in desc_low for w in ("water entry", "water ingress", "wet", "rain")):
            result.checks.append(RuleCheck(
                "hmi-water-entry", "4.4", None,
                "HMI water entry suspected. Check customer usage: washing outside, "
                "parking in open area. May indicate customer negligence.",
            ))
            result.undetermined = True

    # ── BELT-SPECIFIC CHECKS (Annexure C) ─────────────────────────────────────
    if component_key == "drive-belt":
        desc_low = desc.lower()
        if any(w in desc_low for w in ("misalign", "puncture repair", "dusty", "mud")):
            result.checks.append(RuleCheck(
                "belt-condition", "4.4", None,
                "Belt failure may be due to misalignment (e.g. post-puncture repair) "
                "or riding in dusty/muddy conditions. Check pulley alignment and "
                "belt condition per SOP before accepting.",
            ))
            result.undetermined = True

    return result
