"""Reasoning layer — Oben Electric warranty adjudication.

Uses Claude to assess the narrative parts of a claim: whether the failure is a
manufacturing defect vs. the Oben Annexure A rejection categories. Component-
specific judgment checklists from Annexure C are embedded in the prompt.

Falls back to a deterministic mock when no ANTHROPIC_API_KEY is set.
"""
from __future__ import annotations

import json

from app.config import get_settings
from app.integrations.base import CRMRecord, TelematicsSnapshot
from app.models import Claim, Policy
from app.engine.categorize import normalize_category
from app.engine.types import LLMResult, RulesResult

_TOOL = {
    "name": "record_assessment",
    "description": "Record the warranty judgment for this Oben Electric claim.",
    "input_schema": {
        "type": "object",
        "properties": {
            "verdict": {
                "type": "string",
                "enum": ["VALID", "REJECTED", "NEEDS_REVIEW"],
                "description": (
                    "VALID = covered manufacturing defect confirmed. "
                    "REJECTED = a specific Annexure A exclusion clause applies. "
                    "NEEDS_REVIEW = genuinely ambiguous; route to human with PFR if root cause unknown."
                ),
            },
            "confidence": {
                "type": "number",
                "description": "0..1 confidence in the verdict.",
            },
            "rejection_category": {
                "type": "string",
                "description": (
                    "If REJECTED, one of: part-found-ok, external-damage, external-repair, "
                    "duplicate-local-part, extreme-condition, non-genuine-accessory, "
                    "claim-mismatch, wear-and-tear, misuse-abuse, non-genuine-parts, "
                    "insufficient-evidence. Leave empty for VALID."
                ),
            },
            "pfr_required": {
                "type": "boolean",
                "description": (
                    "True if root cause is genuinely unknown and a detailed PFR "
                    "(Why-Why analysis + sample collection per Annexure E) is needed "
                    "before a final decision can be made."
                ),
            },
            "clause_id": {
                "type": "string",
                "description": "The policy clause id most relevant to the verdict (e.g. '4.2').",
            },
            "rationale": {
                "type": "string",
                "description": "Concise reasoning citing the clause and evidence.",
            },
        },
        "required": ["verdict", "confidence", "rationale"],
    },
}

_SYSTEM = (
    "You are a meticulous Oben Electric warranty adjudicator following bulletin "
    "OBEN/Service/2025/001. Your job is to assess ONLY the narrative aspects the "
    "deterministic rules cannot evaluate: whether the described failure is a covered "
    "manufacturing/material defect vs. one of the Oben Annexure A rejection categories.\n\n"
    "Oben Annexure A rejection categories:\n"
    "  1. Part Found OK — no defect reproducible; insufficient pre-diagnosis\n"
    "  2. External Damage — physical damage due to mishandling\n"
    "  3. External Repair — tampering / unauthorised rework\n"
    "  4. Duplicate/Local Part — non-listed vendor parts\n"
    "  5. Extreme Condition — stunts, overloading, severe weather/mud\n"
    "  6. Non-Genuine Accessory — aftermarket accessories altering the vehicle\n"
    "  7. Claim Mismatch — administrative/paperwork issue\n\n"
    "If root cause is genuinely unknown and cannot be established from available evidence, "
    "return NEEDS_REVIEW and set pfr_required=true (per Annexure E — detailed PFR + "
    "Why-Why analysis + sample collection required). Never fabricate coverage. "
    "If evidence is thin, prefer NEEDS_REVIEW over guessing."
)


# ── Annexure C component-specific judgment guidance ───────────────────────────
_COMPONENT_GUIDANCE: dict[str, str] = {
    "battery": (
        "Battery claims (Annexure C): Check — (1) BMS protect error in BMS App, "
        "(2) battery output voltage at HTC-60 connector, (3) rat bite in harness, "
        "(4) external damage/impact, (5) customer charging behaviour (DC fast-charge "
        "cycle count vs claim narrative), (6) unauthorized electrical accessories "
        "installed, (7) deep discharge from leaving uncharged for long time. "
        "Cross-check claim narrative against telematics DC fast-charge cycles."
    ),
    "motor": (
        "Motor claims (Annexure C): Check — (1) error code history via Gtk Tool "
        "(19X = horn/encoder, 49X = MCU), (2) MCU diode values per datasheet for 49X, "
        "(3) abnormal noise from motor without belt, (4) motor temperature via Gtk Tool, "
        "(5) MCU temperature, (6) autotuning sync angle, (7) water submersion / "
        "water-logging riding conditions. Confirm motor temp within safe limits."
    ),
    "hmi": (
        "HMI claims (Annexure C): Check — (1) external impact on HMI, "
        "(2) water entry from washing outside/rain/open parking, "
        "(3) 72V battery output, (4) 12V DCDC output, (5) ignition 12V in ON state, "
        "(6) 12V direct supply to HMI, (7) external electrical accessories, "
        "(8) rat bite in harness, (9) latest HMI firmware update. "
        "Always wear anti-static gloves during diagnosis."
    ),
    "charger": (
        "Charger claims (Annexure C / Annexure B): High false-positive rate — charger "
        "is frequently found OK at HO. Before replacing: (1) duplicate the fault on "
        "another vehicle, (2) check for loose connections or dust causing intermittent "
        "faults, (3) inspect for external rework or non-authorised opening, "
        "(4) check wiring harness for rat bite, (5) verify charging from a different "
        "outlet. Video evidence of the failure is mandatory."
    ),
    "drive-belt": (
        "Belt/pulley claims (Annexure C): (1) Check belt alignment per SOP — "
        "misalignment during puncture repair is a common cause, (2) inspect pulley "
        "condition before replacing belt to prevent repeat failure, (3) confirm "
        "correct belt tension, (4) assess riding conditions: dusty/muddy roads "
        "and overloading accelerate belt wear significantly. Belt must be cleaned/ "
        "lubricated regularly with recommended products."
    ),
    "indicators": (
        "Indicator claims (Annexure C): Check — (1) flasher unit, (2) wiring harness "
        "for rat bite, (3) harness connectivity at indicator connectors, "
        "(4) water entry (inspect seal condition), (5) external electrical accessories "
        "that may cause voltage fluctuation, (6) external physical damage."
    ),
    "main-frame": (
        "Frame claims (Annexure C): Check — (1) customer daily riding conditions "
        "(road condition, load, average speed, riding mode), (2) accidental history "
        "or external impact. For rusting: do not replace — clean rust and apply "
        "anti-rust spray. Record old/new frame serial number on job card."
    ),
}


def _component_guidance(claim: Claim) -> str:
    from app.engine.rules import _normalize_component  # avoid circular at module level
    key = _normalize_component(claim.component)
    return _COMPONENT_GUIDANCE.get(key, "")


def _prompt(claim, policy, crm, telematics, rules_result) -> str:
    clauses = "\n".join(f"  [{cid}] {txt.strip()}" for cid, txt in policy.clauses.items())
    checks = "\n".join(
        f"  - {c.name}: {'PASS' if c.passed else 'FAIL' if c.passed is False else 'N/A'} — {c.detail}"
        for c in rules_result.checks
    )
    guidance = _component_guidance(claim)
    era_note = (
        f"  warranty_package: {getattr(claim, 'warranty_package', 'OBEN-STD')}\n"
        f"  sale_date: {crm.sale_date}\n"
    )
    return (
        f"POLICY {policy.code} v{policy.version} clauses:\n{clauses}\n\n"
        f"CLAIM:\n"
        f"  component: {claim.component}\n"
        f"  failure_description: {claim.failure_description}\n"
        f"  odometer_km: {claim.odometer_km:,}\n"
        f"  claim_date: {claim.claim_date}\n"
        f"  dealer: {claim.dealer or '—'}\n"
        f"  parts_genuine: {claim.parts_genuine}\n"
        + era_note +
        f"\nEVIDENCE (telematics):\n"
        f"  SoH={telematics.battery_soh_pct}%, total_km={telematics.total_km:,}, "
        f"  dc_fast_cycles={telematics.dc_fast_charge_cycles}, "
        f"  ac_cycles={telematics.ac_charge_cycles}, voltage={telematics.battery_voltage_v}V\n"
        f"  CRM: owner={crm.owner_name}, sale_date={crm.sale_date}, "
        f"  job_cards={len(crm.job_cards)}, prior_claims={crm.prior_claim_ids}\n\n"
        f"DETERMINISTIC RULE CHECKS (already applied):\n{checks}\n\n"
        + (f"COMPONENT-SPECIFIC JUDGMENT CHECKLIST (Annexure C):\n{guidance}\n\n" if guidance else "")
        + "Assess the narrative aspects and record your judgment via the tool."
    )


def _claude_assess(claim, policy, crm, telematics, rules_result, settings) -> LLMResult:
    import anthropic
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    model = settings.claude_model_hard if rules_result.undetermined else settings.claude_model
    resp = client.messages.create(
        model=model, max_tokens=1024, system=_SYSTEM,
        tools=[_TOOL],
        tool_choice={"type": "tool", "name": "record_assessment"},
        messages=[{"role": "user", "content": _prompt(claim, policy, crm, telematics, rules_result)}],
    )
    payload = None
    for block in resp.content:
        if getattr(block, "type", None) == "tool_use":
            payload = block.input
            break
    if payload is None:
        raise ValueError("Claude returned no tool_use block")
    if isinstance(payload, str):
        payload = json.loads(payload)
    return LLMResult(
        verdict=payload.get("verdict", "NEEDS_REVIEW"),
        confidence=float(payload.get("confidence", 0.5)),
        rationale=payload.get("rationale", ""),
        category=normalize_category(payload.get("rejection_category")),
        clause_id=payload.get("clause_id") or None,
        source="claude",
        pfr_required=bool(payload.get("pfr_required", False)),
    )


# ── Deterministic mock (no API key) ──────────────────────────────────────────

_MISUSE_KW = ("accident", "modified", "modification", "aftermarket", "abuse",
              "misuse", "tampered", "collision", "crashed")
_WEAR_KW = ("worn out", "worn-out", "wear", "normal wear", "degraded over time",
            "end of life")
_NEGATIONS = ("no ", "not ", "never ", "without ", "n't ")


def _has_kw(desc: str, keywords: tuple[str, ...]) -> bool:
    low = desc.lower()
    for kw in keywords:
        pos = low.find(kw)
        while pos != -1:
            pre = low[max(0, pos - 14):pos]
            if not any(n in pre for n in _NEGATIONS):
                return True
            pos = low.find(kw, pos + 1)
    return False


def _mock_assess(claim: Claim, policy: Policy, telematics: TelematicsSnapshot,
                 rules_result: RulesResult) -> LLMResult:
    """Deterministic stand-in — keeps the app fully functional without an API key."""
    from app.engine.rules import _normalize_component
    desc = claim.failure_description
    component_key = _normalize_component(claim.component)

    # Misuse / abuse
    if _has_kw(desc, _MISUSE_KW):
        return LLMResult("REJECTED", 0.88,
                         "Narrative indicates misuse or unauthorised modification "
                         "(clause 4.2). Excluded under external-repair category.",
                         category="external-repair", clause_id="4.2", source="mock")

    # Wear and tear
    if _has_kw(desc, _WEAR_KW):
        return LLMResult("REJECTED", 0.82,
                         "Described failure is consistent with normal wear-and-tear "
                         "rather than a manufacturing defect.",
                         category="wear-and-tear", clause_id="1.1", source="mock")

    # Unknown component — route with PFR flag
    if rules_result.undetermined and component_key not in (
        "battery", "motor", "hmi", "charger", "main-frame", "dcdc-converter",
        "motor-controller", "front-fork", "drive-belt", "switches", "horn",
        "mono-shock", "wire-harness", "indicators", "front-rim", "rear-rim",
        "throttle",
    ):
        return LLMResult("NEEDS_REVIEW", 0.50,
                         "Component is not clearly covered or excluded. "
                         "Discuss with HO on a case-by-case basis; PFR required.",
                         clause_id="2.1", source="mock", pfr_required=True)

    # Battery — SoH above replacement threshold, or high DC cycles
    if component_key == "battery":
        soh = telematics.battery_soh_pct
        dc = telematics.dc_fast_charge_cycles
        if soh >= policy.battery_min_soh_pct and dc > 200:
            return LLMResult("NEEDS_REVIEW", 0.55,
                             f"Battery SoH {soh}% is above {policy.battery_min_soh_pct}% "
                             f"threshold but DC fast-charge cycles are high ({dc}). "
                             "Detailed telematics review and BMS App check required.",
                             clause_id="3.2", source="mock")
        if soh >= policy.battery_min_soh_pct:
            return LLMResult("NEEDS_REVIEW", 0.60,
                             f"Battery SoH {soh}% is above the {policy.battery_min_soh_pct}% "
                             "replacement threshold (clause 3.2). Check BMS App, charging "
                             "behaviour, and telematics before accepting.",
                             clause_id="3.2", source="mock")

    # Motor with water submersion flag
    if component_key == "motor" and "water" in claim.failure_description.lower():
        return LLMResult("NEEDS_REVIEW", 0.58,
                         "Motor claim with possible water ingress. Confirm riding conditions "
                         "— water-logging voids coverage (clause 4.4).",
                         clause_id="4.4", source="mock")

    # Belt with riding condition flag
    if component_key == "drive-belt" and rules_result.undetermined:
        return LLMResult("NEEDS_REVIEW", 0.62,
                         "Belt failure may relate to riding conditions or misalignment. "
                         "Inspect pulley alignment and belt tension per SOP.",
                         clause_id="4.4", source="mock")

    # Undetermined generic case
    if rules_result.undetermined:
        return LLMResult("NEEDS_REVIEW", 0.58,
                         "Root cause not clearly established from available evidence. "
                         "Further investigation and possible PFR required.",
                         clause_id="1.1", source="mock", pfr_required=True)

    return LLMResult("VALID", 0.91,
                     "Described failure is consistent with a covered manufacturing or "
                     "material defect. Evidence supports the claim.",
                     clause_id="1.1", source="mock")


def assess(
    claim: Claim,
    policy: Policy,
    crm: CRMRecord,
    telematics: TelematicsSnapshot,
    rules_result: RulesResult,
) -> LLMResult:
    settings = get_settings()
    if not settings.llm_enabled:
        return _mock_assess(claim, policy, telematics, rules_result)
    try:
        return _claude_assess(claim, policy, crm, telematics, rules_result, settings)
    except Exception as exc:
        mock = _mock_assess(claim, policy, telematics, rules_result)
        mock.rationale = f"[LLM unavailable: {exc}] {mock.rationale}"
        return mock
