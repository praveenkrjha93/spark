"""Shared value types for the decision engine."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field


@dataclass
class RuleCheck:
    name: str
    clause_id: str | None
    passed: bool | None          # True=pass, False=fail, None=not applicable / undetermined
    detail: str
    category: str | None = None  # RejectionCategory value if this check fails

    def as_dict(self) -> dict:
        return asdict(self)


@dataclass
class RulesResult:
    checks: list[RuleCheck] = field(default_factory=list)
    hard_fail: bool = False
    fail_category: str | None = None
    fail_clause: str | None = None
    undetermined: bool = False   # e.g. component neither covered nor excluded

    def as_dict(self) -> dict:
        return {
            "checks": [c.as_dict() for c in self.checks],
            "hard_fail": self.hard_fail,
            "fail_category": self.fail_category,
            "fail_clause": self.fail_clause,
            "undetermined": self.undetermined,
        }


@dataclass
class Anomaly:
    type: str
    detail: str
    severity: str = "medium"     # low | medium | high

    def as_dict(self) -> dict:
        return asdict(self)


@dataclass
class LLMResult:
    verdict: str                 # VALID | REJECTED | NEEDS_REVIEW
    confidence: float
    rationale: str
    category: str | None = None
    clause_id: str | None = None
    source: str = "mock"         # "claude" | "mock"
    pfr_required: bool = False   # Unknown root cause — PFR + Why-Why analysis needed

    def as_dict(self) -> dict:
        return asdict(self)
