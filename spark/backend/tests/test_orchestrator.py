"""Tests for the orchestrator routing across the three representative scenarios."""
from __future__ import annotations

from sqlmodel import Session, select

from app.engine.orchestrator import decide
from app.enums import ClaimStatus, RejectionCategory, ReviewStatus, Verdict
from app.models import Claim, ReviewTask
from app.seed.sample_data import SAMPLE_CLAIMS, VIN_REJECT, VIN_REVIEW, VIN_VALID


def _submit(session: Session, data: dict) -> Claim:
    claim = Claim(**data)
    session.add(claim)
    session.commit()
    session.refresh(claim)
    return claim


def _claim_for(vin: str) -> dict:
    return next(c for c in SAMPLE_CLAIMS if c["vin"] == vin)


def test_valid_claim_is_approved(session: Session):
    claim = _submit(session, _claim_for(VIN_VALID))
    decision = decide(claim, session)
    assert decision.verdict == Verdict.VALID
    assert decision.confidence >= 0.75
    assert claim.status == ClaimStatus.DECIDED


def test_mileage_exceeded_is_rejected(session: Session):
    claim = _submit(session, _claim_for(VIN_REJECT))
    decision = decide(claim, session)
    assert decision.verdict == Verdict.REJECTED
    assert decision.rejection_category == RejectionCategory.MILEAGE_EXCEEDED.value
    # cited evidence should mention the odometer/limit
    assert "km" in decision.summary.lower() or decision.rules_result["fail_clause"]


def test_anomaly_routes_to_review(session: Session):
    claim = _submit(session, _claim_for(VIN_REVIEW))
    decision = decide(claim, session)
    assert decision.verdict == Verdict.NEEDS_REVIEW
    assert any(a["type"] == "charging-contradiction" for a in decision.anomalies)
    # a review task must have been opened
    task = session.exec(
        select(ReviewTask).where(ReviewTask.claim_id == claim.id)
    ).first()
    assert task is not None
    assert task.status == ReviewStatus.OPEN
    assert claim.status == ClaimStatus.IN_REVIEW
