"""Human-in-the-loop review task (the reviewer work queue)."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlmodel import Field, SQLModel

from app.enums import HumanDecision, ReviewStatus


class ReviewTask(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    claim_id: int = Field(index=True)
    decision_id: int = Field(index=True)

    routing_reason: str                     # RoutingReason value
    priority: int = 3                       # 1 (highest) .. 5
    sla_due_at: datetime | None = None
    assignee: str | None = None

    status: ReviewStatus = Field(default=ReviewStatus.OPEN, index=True)
    human_decision: HumanDecision | None = None
    override_notes: str = ""
    resolved_by: str | None = None
    resolved_at: datetime | None = None

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
