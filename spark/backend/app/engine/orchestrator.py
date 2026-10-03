"""Decision orchestrator: enrich -> rules -> anomaly -> reasoning -> merge/route.

Produces a single auditable Decision and, when needed, a human ReviewTask.
Policy selection priority: claim.warranty_package > crm.policy_code > vehicle.policy_code.
Era (old vs new limits) is determined by crm.sale_date vs policy.era_boundary.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlmodel import Session, select

from app.config import get_settings
from app.enums import ClaimStatus, RejectionCategory, RoutingReason, Verdict
from app.integrations import get_crm_adapter, get_telematics_adapter
from app.models import Claim, Decision, Policy, ReviewTask, Vehicle
from app.engine import anomaly as anomaly_mod
from app.engine import reasoning as reasoning_mod
from app.engine import rules as rules_mod
from app.engine.categorize import normalize_category


def decide(claim: Claim, session: Session) -> Decision:
    settings = get_settings()
    crm_adapter = get_crm_adapter()
    tele_adapter = get_telematics_adapter()

    # --- 1. Enrich ----------------------------------------------------------
    crm = crm_adapter.get_vehicle(claim.vin)
    telematics = tele_adapter.get_snapshot(claim.vin)
    vehicle = session.exec(select(Vehicle).where(Vehicle.vin == claim.vin)).first()

    # Policy lookup: claim package > CRM record > vehicle default > fallback
    package = (
        getattr(claim, "warranty_package", None)
        or crm.policy_code
        or (vehicle.policy_code if vehicle else None)
        or "OBEN-STD"
    )
    policy = session.exec(
        select(Policy).where(Policy.code == package).order_by(Policy.version.desc())
    ).first()
    # If the requested package doesn't exist in DB, fall back to OBEN-STD
    if policy is None and package != "OBEN-STD":
        policy = session.exec(
            select(Policy).where(Policy.code == "OBEN-STD").order_by(Policy.version.desc())
        ).first()

    trace: list[dict] = [{
        "stage": "enrichment",
        "detail": (
            f"CRM found={crm.found}, telematics found={telematics.found}, "
            f"policy={policy.code if policy else 'MISSING'}"
        ),
    }]

    if policy is None:
        return _finalize(
            session, claim, verdict=Verdict.NEEDS_REVIEW, confidence=0.0,
            category=None, summary="No policy on file for this vehicle.",
            routing_reason=RoutingReason.DATA_ANOMALY, trace=trace,
            rules_dict={}, llm_dict={}, anomalies=[], crm=crm,
            telematics=telematics, pfr_required=False,
        )

    # --- 2. Deterministic rules --------------------------------------------
    rules_result = rules_mod.evaluate(claim, policy, crm, telematics)
    for c in rules_result.checks:
        trace.append({"stage": "rule", "detail": f"{c.name}: {c.detail}",
                      "clause": c.clause_id, "severity": "warn" if c.passed is None else None})

    # --- 3. Anomaly detection ----------------------------------------------
    anomalies = anomaly_mod.detect(claim, crm, telematics, vehicle)
    for a in anomalies:
        trace.append({"stage": "anomaly", "detail": a.detail, "severity": a.severity})

    # --- 4. Hard rule failure is authoritative -> REJECTED ------------------
    if rules_result.hard_fail:
        cat = rules_result.fail_category
        from app.engine.categorize import CATEGORY_DESCRIPTIONS
        cat_desc = CATEGORY_DESCRIPTIONS.get(cat or "", cat or "")
        summary = (
            f"Rejected — {cat_desc} "
            f"(clause {rules_result.fail_clause})"
        )
        return _finalize(
            session, claim, verdict=Verdict.REJECTED, confidence=0.96,
            category=cat, summary=summary, routing_reason=None, trace=trace,
            rules_dict=rules_result.as_dict(), llm_dict={},
            anomalies=[a.as_dict() for a in anomalies], crm=crm,
            telematics=telematics, pfr_required=False,
        )

    # --- 5. Reasoning layer (narrative judgment) ----------------------------
    llm = reasoning_mod.assess(claim, policy, crm, telematics, rules_result)
    trace.append({
        "stage": "reasoning",
        "detail": f"[{llm.source}] {llm.verdict} ({llm.confidence:.2f}) — {llm.rationale}",
        "clause": llm.clause_id,
    })

    # --- 6. Merge & route ---------------------------------------------------
    verdict, confidence, category, routing, summary = _merge(
        llm, anomalies, rules_result, settings
    )
    trace.append({"stage": "decision", "detail": summary})

    return _finalize(
        session, claim, verdict=verdict, confidence=confidence, category=category,
        summary=summary, routing_reason=routing, trace=trace,
        rules_dict=rules_result.as_dict(), llm_dict=llm.as_dict(),
        anomalies=[a.as_dict() for a in anomalies], crm=crm,
        telematics=telematics, pfr_required=llm.pfr_required,
    )


def _merge(llm, anomalies, rules_result, settings):
    """Return (verdict, confidence, category, routing_reason, summary)."""
    if anomalies:
        detail = "; ".join(a.type for a in anomalies)
        return (Verdict.NEEDS_REVIEW, min(llm.confidence, 0.5), None,
                RoutingReason.DATA_ANOMALY,
                f"Routed to review: data anomalies ({detail}).")

    threshold = settings.confidence_review_threshold

    if llm.verdict == "REJECTED" and llm.confidence >= threshold:
        category = normalize_category(llm.category) or RejectionCategory.INSUFFICIENT_EVIDENCE.value
        from app.engine.categorize import CATEGORY_DESCRIPTIONS
        cat_desc = CATEGORY_DESCRIPTIONS.get(category, category)
        return (Verdict.REJECTED, llm.confidence, category, None,
                f"Rejected — {cat_desc}: {llm.rationale}")

    if llm.verdict == "VALID" and llm.confidence >= threshold:
        note = " Eligible for auto-approval." if llm.confidence >= settings.auto_approve_threshold else ""
        return (Verdict.VALID, llm.confidence, None, None,
                f"Valid claim.{note} {llm.rationale}")

    # Route to review — PFR if root cause unknown, ambiguous-clause if component unlisted
    if llm.pfr_required:
        routing = RoutingReason.PFR_REQUIRED
    elif rules_result.undetermined:
        routing = RoutingReason.AMBIGUOUS_CLAUSE
    else:
        routing = RoutingReason.LOW_CONFIDENCE

    return (Verdict.NEEDS_REVIEW, llm.confidence, None, routing,
            f"Routed to review ({routing.value}): {llm.rationale}")


def _finalize(session, claim, *, verdict, confidence, category, summary,
              routing_reason, trace, rules_dict, llm_dict, anomalies,
              crm, telematics, pfr_required: bool = False) -> Decision:
    evidence = {
        "crm": {
            "found": crm.found,
            "sale_date": str(crm.sale_date) if crm.sale_date else None,
            "owner_name": crm.owner_name,
            "job_cards": len(crm.job_cards),
            "prior_claim_ids": crm.prior_claim_ids,
        },
        "telematics": {
            "found": telematics.found,
            "running_status": telematics.running_status,
            "total_km": telematics.total_km,
            "battery_soh_pct": telematics.battery_soh_pct,
            "battery_voltage_v": telematics.battery_voltage_v,
            "dc_fast_charge_cycles": telematics.dc_fast_charge_cycles,
            "ac_charge_cycles": telematics.ac_charge_cycles,
            "total_charge_cycles": telematics.total_charge_cycles,
        },
    }
    decision = Decision(
        claim_id=claim.id, verdict=verdict, confidence=round(confidence, 3),
        rejection_category=category, summary=summary, reasoning_trace=trace,
        rules_result=rules_dict, llm_result=llm_dict, anomalies=anomalies,
        evidence=evidence, created_by="system",
    )
    session.add(decision)
    session.commit()
    session.refresh(decision)

    if verdict == Verdict.NEEDS_REVIEW:
        claim.status = ClaimStatus.IN_REVIEW
        # PFR cases get P1 priority; anomalies P1; else P3
        if pfr_required:
            priority = 1
            sla_days = 2
        elif any(a.get("severity") == "high" for a in anomalies):
            priority = 1
            sla_days = 2
        else:
            priority = 3
            sla_days = 5
        routing_val = routing_reason.value if routing_reason else "review"
        if pfr_required:
            routing_val = RoutingReason.PFR_REQUIRED.value
        session.add(ReviewTask(
            claim_id=claim.id, decision_id=decision.id,
            routing_reason=routing_val,
            priority=priority,
            sla_due_at=datetime.now(timezone.utc) + timedelta(days=sla_days),
        ))
    else:
        claim.status = ClaimStatus.DECIDED
    session.add(claim)
    session.commit()
    session.refresh(decision)
    return decision
