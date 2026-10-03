"""Decision record — the auditable output of the decision engine."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel

from app.enums import Verdict


class Decision(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    claim_id: int = Field(index=True)

    verdict: Verdict = Field(index=True)
    confidence: float                       # 0..1
    rejection_category: str | None = None   # RejectionCategory value when rejected

    # Human-readable summary plus a structured, replayable trace.
    summary: str = ""
    reasoning_trace: list[dict] = Field(default_factory=list, sa_column=Column(JSON))
    rules_result: dict = Field(default_factory=dict, sa_column=Column(JSON))
    llm_result: dict = Field(default_factory=dict, sa_column=Column(JSON))
    anomalies: list[dict] = Field(default_factory=list, sa_column=Column(JSON))

    # Evidence snapshot used to reach the decision (CRM + telematics at decision time).
    evidence: dict = Field(default_factory=dict, sa_column=Column(JSON))

    created_by: str = "system"              # "system" or a reviewer id
    overridden: bool = False                # true once a human changes the verdict
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
