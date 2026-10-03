"""Claims router: submit a claim (runs the decision pipeline) and read it back."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_
from sqlmodel import Session, select

from app.db import get_session
from app.engine.orchestrator import decide
from app.enums import ReviewStatus, Verdict
from app.models import Claim, Decision, ReviewTask
from app.schemas import ClaimCreate

router = APIRouter(prefix="/claims", tags=["claims"])


@router.post("/suggest")
def suggest_fields(payload: dict) -> dict:
    """Rule-based smart-fill suggestions based on component + fault code + description.
    No LLM required — uses Oben Annexure C knowledge to pre-fill 5 form fields."""
    component_raw = (payload.get("component") or "").lower().strip()
    fault_code = (payload.get("fault_code") or "").lower().strip()
    description = (payload.get("failure_description") or "").lower().strip()

    # Normalize component to canonical key (mirror the rules engine aliases)
    _ALIASES: dict[str, str] = {
        "motor": "motor", "motor controller": "motor-controller",
        "motor-controller": "motor-controller", "bms": "battery",
        "battery": "battery", "charger": "charger", "hmi": "hmi",
        "display": "hmi", "screen": "hmi", "belt": "drive-belt",
        "drive belt": "drive-belt", "drive-belt": "drive-belt",
        "dcdc": "dcdc-converter", "dcdc converter": "dcdc-converter",
        "dc-dc converter": "dcdc-converter",
        "wire harness": "wire-harness", "wiring": "wire-harness",
        "shock": "mono-shock", "mono shock": "mono-shock",
        "fork": "front-fork", "front fork": "front-fork",
        "frame": "main-frame",
    }
    component = _ALIASES.get(component_raw, component_raw.replace(" ", "-") or "unknown")

    FAILURE_TYPES = {
        "battery": "Manufacturing Defect",
        "motor": "Manufacturing Defect",
        "motor-controller": "Manufacturing Defect",
        "charger": "Manufacturing Defect",
        "hmi": "Manufacturing Defect",
        "dcdc-converter": "Manufacturing Defect",
        "main-frame": "Manufacturing Defect",
        "wire-harness": "Manufacturing Defect",
        "drive-belt": "Wear and Tear",
        "mono-shock": "Wear and Tear",
        "front-fork": "Wear and Tear",
        "switches": "Wear and Tear",
        "horn": "Wear and Tear",
        "brake pads": "Wear and Tear",
        "tyres": "Wear and Tear",
    }

    SAFETY_SEVERITY = {
        "battery": "High",
        "motor": "Medium",
        "motor-controller": "High",
        "main-frame": "Critical",
        "front-fork": "Critical",
        "wire-harness": "Medium",
        "charger": "Medium",
        "hmi": "Low",
        "drive-belt": "Medium",
        "dcdc-converter": "Medium",
        "mono-shock": "Medium",
    }

    STEPS: dict[str, str] = {
        "battery": (
            "1. Open BMS App and check for protect error codes.\n"
            "2. Measure battery output voltage at HTC-60 connector.\n"
            "3. Check DC fast-charge cycle count in Argus telematics.\n"
            "4. Inspect harness connector for rat bite or corrosion.\n"
            "5. Check for external physical damage or deep discharge history."
        ),
        "motor": (
            "1. Read error codes via Gtk Tool (19X = encoder/horn; 49X = MCU).\n"
            "2. For 49X: check MCU diode values per Oben datasheet.\n"
            "3. Run motor without drive belt — listen for abnormal noise.\n"
            "4. Check motor temperature via Gtk Tool.\n"
            "5. Verify autotuning sync angle; re-autotune if out of spec."
        ),
        "motor-controller": (
            "1. Read controller error code via Gtk Tool.\n"
            "2. Check MCU temperature — overtemp threshold is 90°C.\n"
            "3. Inspect for external accessories (USB charger, extra LEDs) causing current overload.\n"
            "4. Check for water ingress or short circuit on PCB.\n"
            "5. Swap with known-good controller to isolate fault."
        ),
        "hmi": (
            "1. Check for external physical impact on HMI screen.\n"
            "2. Test 72V battery output and 12V DCDC output.\n"
            "3. Check ignition 12V in ON state; test 12V direct supply to HMI.\n"
            "4. Inspect for water entry through seals; confirm anti-static gloves worn.\n"
            "5. Flash latest firmware version and retest."
        ),
        "charger": (
            "1. Duplicate fault on another vehicle to rule out vehicle issue.\n"
            "2. Check loose connections and dust accumulation on PCB.\n"
            "3. Inspect for external rework / unauthorised board modifications.\n"
            "4. Check wiring harness for rat bite or burned connectors.\n"
            "5. Test with a different power outlet. Mandatory: video evidence of failure mode."
        ),
        "drive-belt": (
            "1. Check belt alignment per SOP — pulley must be coplanar.\n"
            "2. Inspect pulley condition for wear grooves.\n"
            "3. Measure belt tension; compare to spec range.\n"
            "4. Assess riding conditions: dusty/muddy roads, overloading.\n"
            "5. Check sprocket tooth condition."
        ),
        "dcdc-converter": (
            "1. Measure 72V input and 12V output at DCDC connector.\n"
            "2. Check all 12V consumers (HMI, lights, horn) to isolate load fault.\n"
            "3. Inspect connectors for corrosion or loose pins.\n"
            "4. Swap with known-good DCDC unit to confirm fault."
        ),
        "wire-harness": (
            "1. Inspect harness routing for chafing at frame contact points.\n"
            "2. Check connector locking clips; re-seat any partially seated connectors.\n"
            "3. Inspect for rat bite — check entry points around battery tray.\n"
            "4. Use multimeter to check continuity on suspected circuits."
        ),
    }

    FEEDBACK: dict[str, str] = {
        "battery": "BMS App checked; protect codes documented. HTC-60 voltage measured. Argus DC cycle count verified against claim narrative.",
        "motor": "Error code read via Gtk Tool and photographed. MCU diode test completed. Motor noise test without belt performed.",
        "motor-controller": "Controller error code captured. MCU temperature logged. External accessories audit completed.",
        "hmi": "72V and 12V DCDC supply confirmed. Water ingress inspection completed. Latest firmware version verified.",
        "charger": "Fault duplicated on second vehicle — result: [DUPLICATE / NOT DUPLICATED]. All connector checks performed. Video evidence captured.",
        "drive-belt": "Belt alignment checked per SOP. Pulley and sprocket condition inspected. Belt tension measured.",
        "dcdc-converter": "72V input and 12V output measured at connector. All 12V consumers individually tested.",
        "wire-harness": "Harness routing inspected along full length. Connector re-seat completed. Rat-bite audit done.",
    }

    # Override for abuse/misuse keywords
    abuse_kw = ("fell", "dropped", "flooded", "submerged", "stunt", "overload",
                "accident", "collision", "rash", "fire", "burnt", "modified")
    is_abuse = any(kw in description for kw in abuse_kw)

    if is_abuse:
        failure_type = "User Abuse / External Damage"
        severity = "Low"
    else:
        failure_type = FAILURE_TYPES.get(component, "Manufacturing Defect")
        severity = SAFETY_SEVERITY.get(component, "Low")

    # Escalate severity for critical keywords
    if any(kw in description for kw in ("fire", "smoke", "burn", "burst", "explod")):
        severity = "Critical"
    elif any(kw in description for kw in ("sudden", "complete failure", "no movement", "will not start")):
        if severity == "Low":
            severity = "Medium"

    return {
        "failure_type": failure_type,
        "safety_severity": severity,
        "steps_to_replicate": STEPS.get(
            component,
            "1. Replicate fault under controlled conditions.\n"
            "2. Document all evidence with photos and video.\n"
            "3. Check all connectors and related sub-systems.\n"
            "4. Cross-reference Argus telematics for any anomalies."
        ),
        "service_team_feedback": FEEDBACK.get(
            component,
            "Component inspected per service manual. Fault documented with photo evidence."
        ),
        "severity_remarks": (
            f"Auto-assessed: component '{component_raw}' | fault code '{payload.get('fault_code', '')}'. "
            "Review and adjust severity if required."
        ),
    }

@router.post("")
def create_claim(payload: ClaimCreate, session: Session = Depends(get_session)) -> dict:
    claim = Claim(**payload.model_dump())
    session.add(claim)
    session.commit()
    session.refresh(claim)

    decision = decide(claim, session)
    return {"claim": claim, "decision": decision}


def _latest_decision(session: Session, claim_id: int) -> Decision | None:
    return session.exec(
        select(Decision).where(Decision.claim_id == claim_id)
        .order_by(Decision.created_at.desc())
    ).first()


def _open_task(session: Session, claim_id: int) -> ReviewTask | None:
    return session.exec(
        select(ReviewTask).where(
            ReviewTask.claim_id == claim_id,
            ReviewTask.status == ReviewStatus.OPEN,
        ).order_by(ReviewTask.created_at.desc())
    ).first()


@router.get("/{claim_id}")
def get_claim(claim_id: int, session: Session = Depends(get_session)) -> dict:
    claim = session.get(Claim, claim_id)
    if claim is None:
        raise HTTPException(404, "Claim not found")
    return {
        "claim": claim,
        "decision": _latest_decision(session, claim_id),
        "task": _open_task(session, claim_id),
    }


@router.get("")
def list_claims(
    session: Session = Depends(get_session),
    status: str = "ALL",       # ALL | REVIEW | VALID | REJECTED | NEEDS_REVIEW
    q: str = "",
    page: int = 1,
    page_size: int = 25,
) -> dict:
    """Paginated, filterable claim list. Returns one page of claims (each with its
    latest decision + any open review task) plus dataset-wide counts for the tabs —
    so the browser only ever holds a single page, not the whole table."""
    needle = (q or "").strip().lower()
    page = max(1, page)
    page_size = max(1, min(page_size, 200))

    def apply_q(stmt):
        if needle:
            like = f"%{needle}%"
            stmt = stmt.where(or_(
                func.lower(Claim.vin).like(like),
                func.lower(Claim.component).like(like),
                func.lower(Claim.dealer).like(like),
            ))
        return stmt

    # ---- tab counts: respect the search, span every status ----
    all_count = session.exec(apply_q(select(func.count(Claim.id)))).one()
    review_count = session.exec(
        apply_q(
            select(func.count(func.distinct(ReviewTask.claim_id)))
            .select_from(ReviewTask)
            .join(Claim, Claim.id == ReviewTask.claim_id)
            .where(ReviewTask.status == ReviewStatus.OPEN)
        )
    ).one()
    verdict_rows = session.exec(
        apply_q(
            select(Decision.verdict, func.count(Decision.id))
            .select_from(Decision)
            .join(Claim, Claim.id == Decision.claim_id)
        ).group_by(Decision.verdict)
    ).all()
    vcounts = {v: n for v, n in verdict_rows}
    counts = {
        "ALL": all_count,
        "REVIEW": review_count,
        "VALID": vcounts.get(Verdict.VALID, 0),
        "REJECTED": vcounts.get(Verdict.REJECTED, 0),
        "NEEDS_REVIEW": vcounts.get(Verdict.NEEDS_REVIEW, 0),
    }

    # ---- the filtered page ----
    stmt = apply_q(select(Claim))
    if status == "REVIEW":
        stmt = stmt.where(Claim.id.in_(
            select(ReviewTask.claim_id).where(ReviewTask.status == ReviewStatus.OPEN)
        ))
    elif status in ("VALID", "REJECTED", "NEEDS_REVIEW"):
        stmt = stmt.where(Claim.id.in_(
            select(Decision.claim_id).where(Decision.verdict == Verdict(status))
        ))

    total = session.exec(select(func.count()).select_from(stmt.subquery())).one()
    claims = session.exec(
        stmt.order_by(Claim.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    ).all()

    items = [
        {
            "claim": claim,
            "decision": _latest_decision(session, claim.id),
            "task": _open_task(session, claim.id),
        }
        for claim in claims
    ]
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "counts": counts,
    }
