"""Failed-claim taxonomy — aligned with Oben Annexure A bulletin categories."""
from __future__ import annotations

from app.enums import RejectionCategory

CATEGORY_DESCRIPTIONS: dict[str, str] = {
    # Coverage failures
    RejectionCategory.OUT_OF_COVERAGE_PERIOD.value:
        "Claim raised after the warranty time window for this component elapsed.",
    RejectionCategory.MILEAGE_EXCEEDED.value:
        "Odometer exceeds the coverage kilometre limit for this component.",
    RejectionCategory.EXCLUDED_COMPONENT.value:
        "Component is a wear/consumable item excluded from warranty coverage.",
    RejectionCategory.LAPSED_SERVICE_SCHEDULE.value:
        "Prescribed service schedule was not adhered to (beyond 30-day grace).",
    # Oben Annexure A categories
    RejectionCategory.PART_FOUND_OK.value:
        "No defect found at HO analysis — part functions as normal. "
        "Duplicate the failure before claiming; video evidence required.",
    RejectionCategory.EXTERNAL_DAMAGE.value:
        "Physical damage due to mishandling — not a manufacturing defect.",
    RejectionCategory.EXTERNAL_REPAIR.value:
        "Tampering or unauthorised rework by non-Oben personnel voids warranty.",
    RejectionCategory.DUPLICATE_LOCAL_PART.value:
        "Non-listed vendor / duplicate part was used — not covered.",
    RejectionCategory.EXTREME_CONDITION.value:
        "Failure due to extreme usage: stunts, overloading, or severe weather/mud.",
    RejectionCategory.NON_GENUINE_ACCESSORY.value:
        "Non-genuine accessory fitted to vehicle, altering electrical/mechanical system.",
    RejectionCategory.CLAIM_MISMATCH.value:
        "Administrative mismatch: missing backup sheet, GST registration, or ASM sign-off.",
    # Narrative / evidence rejections
    RejectionCategory.WEAR_AND_TEAR.value:
        "Failure is normal wear and tear, not a manufacturing defect.",
    RejectionCategory.MISUSE_ABUSE.value:
        "Damage from misuse, abuse, accident, or unauthorised modification.",
    RejectionCategory.NON_GENUINE_PARTS.value:
        "Non-genuine replacement parts used in repair, voiding coverage.",
    RejectionCategory.INSUFFICIENT_EVIDENCE.value:
        "Evidence does not substantiate the claim; root cause not established.",
    RejectionCategory.DUPLICATE_CLAIM.value:
        "A prior claim already covers this failure.",
    RejectionCategory.DATA_ANOMALY.value:
        "Telematics / CRM data is inconsistent with the claim narrative.",
}

_VALID_CATEGORIES = {c.value for c in RejectionCategory}


def normalize_category(raw: str | None) -> str | None:
    """Map a free-form category string (e.g. from the LLM) onto the taxonomy."""
    if not raw:
        return None
    key = raw.strip().lower().replace("_", "-").replace(" ", "-")
    if key in _VALID_CATEGORIES:
        return key
    # Loose keyword mapping for LLM-provided wording.
    if "found-ok" in key or "no defect" in key or "part ok" in key:
        return RejectionCategory.PART_FOUND_OK.value
    if "external-damage" in key or "physical damage" in key or "mishandl" in key:
        return RejectionCategory.EXTERNAL_DAMAGE.value
    if "external-repair" in key or "tamper" in key or "unauthori" in key or "rework" in key:
        return RejectionCategory.EXTERNAL_REPAIR.value
    if "duplicate" in key or "local-part" in key or "local part" in key:
        return RejectionCategory.DUPLICATE_LOCAL_PART.value
    if "extreme" in key or "overload" in key or "stunt" in key:
        return RejectionCategory.EXTREME_CONDITION.value
    if "accessory" in key or "non-genuine-acc" in key:
        return RejectionCategory.NON_GENUINE_ACCESSORY.value
    if "mismatch" in key or "admin" in key or "paperwork" in key:
        return RejectionCategory.CLAIM_MISMATCH.value
    if "wear" in key:
        return RejectionCategory.WEAR_AND_TEAR.value
    if "misuse" in key or "abuse" in key or "accident" in key or "modif" in key:
        return RejectionCategory.MISUSE_ABUSE.value
    if "evidence" in key or "insufficient" in key or "root cause" in key:
        return RejectionCategory.INSUFFICIENT_EVIDENCE.value
    if "genuine" in key or "aftermarket" in key or "non-genuine-part" in key:
        return RejectionCategory.NON_GENUINE_PARTS.value
    if "exclud" in key:
        return RejectionCategory.EXCLUDED_COMPONENT.value
    return RejectionCategory.INSUFFICIENT_EVIDENCE.value
