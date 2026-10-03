"""End-to-end demo: seed data and run three representative claims.

Run from the backend/ directory:  python demo.py
Works with no ANTHROPIC_API_KEY (reasoning layer uses a deterministic mock).
"""
from __future__ import annotations

from sqlmodel import Session

from app.db import engine, init_db
from app.engine.orchestrator import decide
from app.models import Claim, ReviewTask
from app.seed.loader import seed_all
from app.seed.sample_data import SAMPLE_CLAIMS


def _print_decision(claim: Claim, decision, session: Session) -> None:
    print("=" * 78)
    print(f"CLAIM #{claim.id}  VIN={claim.vin}  component={claim.component}")
    print(f"  odometer={claim.odometer_km} km  date={claim.claim_date}")
    print(f"  \"{claim.failure_description}\"")
    print("-" * 78)
    print(f"  VERDICT   : {decision.verdict.value}  (confidence {decision.confidence})")
    if decision.rejection_category:
        print(f"  CATEGORY  : {decision.rejection_category}")
    print(f"  SUMMARY   : {decision.summary}")
    if decision.anomalies:
        for a in decision.anomalies:
            print(f"  ANOMALY   : [{a['severity']}] {a['type']} — {a['detail']}")
    print("  REASONING TRACE:")
    for step in decision.reasoning_trace:
        clause = f" (clause {step.get('clause')})" if step.get("clause") else ""
        print(f"    - [{step['stage']}]{clause} {step['detail']}")
    print()


def main() -> None:
    init_db()
    with Session(engine) as session:
        seed_all(session)
        for data in SAMPLE_CLAIMS:
            claim = Claim(**data)
            session.add(claim)
            session.commit()
            session.refresh(claim)
            decision = decide(claim, session)
            _print_decision(claim, decision, session)

        # Show the resulting human-review queue.
        from sqlmodel import select
        from app.enums import ReviewStatus
        open_tasks = session.exec(
            select(ReviewTask).where(ReviewTask.status == ReviewStatus.OPEN)
        ).all()
        print("=" * 78)
        print(f"HUMAN REVIEW QUEUE: {len(open_tasks)} open task(s)")
        for t in open_tasks:
            print(f"  task #{t.id}  claim #{t.claim_id}  reason={t.routing_reason}  "
                  f"priority={t.priority}  sla_due={t.sla_due_at}")


if __name__ == "__main__":
    main()
