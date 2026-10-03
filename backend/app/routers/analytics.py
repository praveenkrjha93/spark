"""Analytics router: aggregate decision metrics for the dashboard."""
from __future__ import annotations

from collections import Counter
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.config import get_settings
from app.db import get_session
from app.enums import ReviewStatus, Verdict
from app.models import Claim, Decision, ReviewTask

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary")
def summary(session: Session = Depends(get_session)) -> dict:
    settings = get_settings()
    decisions = list(session.exec(select(Decision)).all())
    claims = list(session.exec(select(Claim)).all())

    verdict_counts: Counter = Counter(d.verdict for d in decisions)
    category_counts: Counter = Counter(
        d.rejection_category for d in decisions if d.rejection_category
    )
    anomaly_count = sum(1 for d in decisions if d.anomalies)

    decided = [d for d in decisions if d.verdict in (Verdict.VALID, Verdict.REJECTED)]
    valid = [d for d in decisions if d.verdict == Verdict.VALID]
    auto_approved = [
        d for d in valid if d.confidence >= settings.auto_approve_threshold
    ]
    avg_conf = round(sum(d.confidence for d in decisions) / len(decisions), 3) if decisions else 0.0

    open_reviews = len(session.exec(
        select(ReviewTask).where(ReviewTask.status == ReviewStatus.OPEN)
    ).all())

    return {
        "totals": {
            "claims": len(claims),
            "valid": verdict_counts.get(Verdict.VALID, 0),
            "rejected": verdict_counts.get(Verdict.REJECTED, 0),
            "needs_review": verdict_counts.get(Verdict.NEEDS_REVIEW, 0),
        },
        "open_reviews": open_reviews,
        "anomaly_count": anomaly_count,
        "avg_confidence": avg_conf,
        "auto_approval_rate": round(len(auto_approved) / len(decided), 3) if decided else 0.0,
        "verdict_distribution": [
            {"verdict": v.value, "count": verdict_counts.get(v, 0)} for v in Verdict
        ],
        "rejection_categories": sorted(
            [{"category": c, "count": n} for c, n in category_counts.items()],
            key=lambda x: x["count"], reverse=True,
        ),
    }


@router.get("/failure-modes")
def failure_modes(session: Session = Depends(get_session)) -> dict:
    """Per-component reliability + failure-mode breakdown for the analyst's
    failure-data analysis: claim volume, verdict split, approval rate, the
    dominant rejection reason, and average odometer at failure."""
    claims = list(session.exec(select(Claim)).all())
    decisions = list(session.exec(select(Decision).order_by(Decision.created_at)).all())

    # Latest decision per claim (decisions are ordered oldest→newest above).
    latest: dict[int, Decision] = {}
    for d in decisions:
        latest[d.claim_id] = d

    groups: dict[str, dict] = {}
    for claim in claims:
        comp = (claim.component or "unknown").strip().lower()
        g = groups.setdefault(comp, {
            "component": comp, "total": 0, "valid": 0, "rejected": 0,
            "needs_review": 0, "anomalies": 0, "_odo_sum": 0,
            "_categories": Counter(),
        })
        g["total"] += 1
        g["_odo_sum"] += claim.odometer_km
        d = latest.get(claim.id)
        if d is None:
            continue
        if d.verdict == Verdict.VALID:
            g["valid"] += 1
        elif d.verdict == Verdict.REJECTED:
            g["rejected"] += 1
        else:
            g["needs_review"] += 1
        if d.anomalies:
            g["anomalies"] += 1
        if d.rejection_category:
            g["_categories"][d.rejection_category] += 1

    components = []
    for g in groups.values():
        decided = g["valid"] + g["rejected"]
        cats = g.pop("_categories")
        odo_sum = g.pop("_odo_sum")
        top = cats.most_common(1)[0][0] if cats else None
        components.append({
            **g,
            "approval_rate": round(g["valid"] / decided, 3) if decided else None,
            "avg_odometer_km": round(odo_sum / g["total"]) if g["total"] else 0,
            "top_rejection": top,
            "rejection_breakdown": [
                {"category": c, "count": n}
                for c, n in cats.most_common()
            ],
        })
    components.sort(key=lambda c: c["total"], reverse=True)

    return {
        "components": components,
        "total_components": len(components),
        "total_claims": len(claims),
    }


@router.get("/trends")
def trends(session: Session = Depends(get_session)) -> dict:
    """Warranty-dashboard trends: monthly failures, top parts, top failure
    modes, top dealers — mirrors the Excel PFR dashboard."""
    claims = list(session.exec(select(Claim)).all())

    # Monthly failure counts, sorted chronologically
    month_counts: Counter = Counter()
    for c in claims:
        if c.claim_date:
            try:
                # claim_date may be a date object or an ISO string
                raw = c.claim_date
                if hasattr(raw, "strftime"):
                    month_counts[raw.strftime("%Y-%m")] += 1
                else:
                    dt = datetime.fromisoformat(str(raw)[:10])
                    month_counts[dt.strftime("%Y-%m")] += 1
            except (ValueError, AttributeError):
                pass
    monthly_failures = [
        {"month": m, "count": n}
        for m, n in sorted(month_counts.items())
    ]

    # Top 10 primary parts (using primary_part field; fall back to component)
    part_counts: Counter = Counter()
    for c in claims:
        part = (c.primary_part or c.component or "").strip()
        if part:
            part_counts[part] += 1
    top_parts = [
        {"part": p, "count": n}
        for p, n in part_counts.most_common(10)
    ]

    # Top 10 failure modes (failure_type field)
    mode_counts: Counter = Counter()
    for c in claims:
        mode = (c.failure_type or "").strip()
        if mode:
            mode_counts[mode] += 1
    top_failure_modes = [
        {"mode": m, "count": n}
        for m, n in mode_counts.most_common(10)
    ]

    # Top 10 dealers / locations
    dealer_counts: Counter = Counter()
    for c in claims:
        dealer = (c.dealer or "").strip()
        if dealer:
            dealer_counts[dealer] += 1
    top_dealers = [
        {"dealer": d, "count": n}
        for d, n in dealer_counts.most_common(10)
    ]

    # Top 10 components by total claim count
    component_counts: Counter = Counter()
    for c in claims:
        comp = (c.component or "").strip()
        if comp:
            component_counts[comp] += 1
    top_components = [
        {"component": comp, "count": n}
        for comp, n in component_counts.most_common(10)
    ]

    return {
        "total_claims": len(claims),
        "monthly_failures": monthly_failures,
        "top_parts": top_parts,
        "top_failure_modes": top_failure_modes,
        "top_dealers": top_dealers,
        "top_components": top_components,
    }
