"""Review router: the human-in-the-loop work queue and decision recording."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_session
from app.enums import ClaimStatus, HumanDecision, ReviewStatus, Verdict
from app.models import Claim, Decision, ReviewTask
from app.schemas import ReviewDecisionIn

router = APIRouter(prefix="/review", tags=["review"])


@router.get("/queue")
def queue(
    status: ReviewStatus = ReviewStatus.OPEN,
    session: Session = Depends(get_session),
) -> list[dict]:
    tasks = session.exec(
        select(ReviewTask).where(ReviewTask.status == status)
        .order_by(ReviewTask.priority, ReviewTask.created_at)
    ).all()
    out: list[dict] = []
    for t in tasks:
        claim = session.get(Claim, t.claim_id)
        decision = session.get(Decision, t.decision_id)
        out.append({"task": t, "claim": claim, "decision": decision})
    return out


@router.post("/{task_id}/decision")
def record_decision(
    task_id: int, payload: ReviewDecisionIn, session: Session = Depends(get_session)
) -> dict:
    task = session.get(ReviewTask, task_id)
    if task is None:
        raise HTTPException(404, "Review task not found")
    if task.status == ReviewStatus.RESOLVED:
        raise HTTPException(409, "Review task already resolved")

    task.human_decision = payload.human_decision
    task.override_notes = payload.override_notes
    task.resolved_by = payload.resolved_by
    task.resolved_at = datetime.now(timezone.utc)
    task.status = ReviewStatus.RESOLVED

    claim = session.get(Claim, task.claim_id)
    decision = session.get(Decision, task.decision_id)

    # Record the human outcome on the decision as an auditable override.
    if payload.human_decision == HumanDecision.APPROVED:
        decision.verdict = Verdict.VALID
        claim.status = ClaimStatus.RESOLVED
    elif payload.human_decision == HumanDecision.REJECTED:
        decision.verdict = Verdict.REJECTED
        claim.status = ClaimStatus.RESOLVED
    else:  # INFO_REQUESTED — keep open for the dealer to respond
        claim.status = ClaimStatus.IN_REVIEW

    decision.overridden = True
    decision.created_by = payload.resolved_by
    decision.reasoning_trace = list(decision.reasoning_trace) + [{
        "stage": "human-review",
        "detail": f"{payload.resolved_by} -> {payload.human_decision.value}: "
                  f"{payload.override_notes}",
    }]

    session.add_all([task, claim, decision])
    session.commit()
    session.refresh(task)
    session.refresh(decision)
    return {"task": task, "decision": decision}
