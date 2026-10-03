"""Shared enums for the domain model and decision engine."""
from __future__ import annotations

from enum import Enum


class Verdict(str, Enum):
    VALID = "VALID"
    REJECTED = "REJECTED"
    NEEDS_REVIEW = "NEEDS_REVIEW"


class ClaimStatus(str, Enum):
    SUBMITTED = "SUBMITTED"
    DECIDED = "DECIDED"          # system produced a VALID/REJECTED decision
    IN_REVIEW = "IN_REVIEW"      # routed to a human
    RESOLVED = "RESOLVED"        # human closed it


class RejectionCategory(str, Enum):
    # Coverage failures
    OUT_OF_COVERAGE_PERIOD = "out-of-coverage-period"
    MILEAGE_EXCEEDED = "mileage-exceeded"
    EXCLUDED_COMPONENT = "excluded-component"
    LAPSED_SERVICE_SCHEDULE = "lapsed-service-schedule"
    # Oben Annexure A categories (numbered 1-7 in bulletin)
    PART_FOUND_OK = "part-found-ok"            # Category 1: no defect found
    EXTERNAL_DAMAGE = "external-damage"         # Category 2: physical mishandling
    EXTERNAL_REPAIR = "external-repair"         # Category 3: tampering / unauthorised rework
    DUPLICATE_LOCAL_PART = "duplicate-local-part"  # Category 4: non-listed-vendor parts
    EXTREME_CONDITION = "extreme-condition"     # Category 5: stunts / overload / extreme weather
    NON_GENUINE_ACCESSORY = "non-genuine-accessory"  # Category 6: non-genuine accessories added
    CLAIM_MISMATCH = "claim-mismatch"           # Category 7: admin / paperwork issue
    # Narrative / evidence rejections
    WEAR_AND_TEAR = "wear-and-tear"
    MISUSE_ABUSE = "misuse-abuse"
    NON_GENUINE_PARTS = "non-genuine-parts"
    INSUFFICIENT_EVIDENCE = "insufficient-evidence"
    DUPLICATE_CLAIM = "duplicate-claim"
    DATA_ANOMALY = "data-anomaly"


class ReviewStatus(str, Enum):
    OPEN = "OPEN"
    RESOLVED = "RESOLVED"


class HumanDecision(str, Enum):
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    INFO_REQUESTED = "INFO_REQUESTED"


class RoutingReason(str, Enum):
    LOW_CONFIDENCE = "low-confidence"
    RULES_LLM_CONFLICT = "rules-llm-conflict"
    DATA_ANOMALY = "data-anomaly"
    AMBIGUOUS_CLAUSE = "ambiguous-clause"
    PFR_REQUIRED = "pfr-required"   # Unknown root cause — detailed investigation needed
