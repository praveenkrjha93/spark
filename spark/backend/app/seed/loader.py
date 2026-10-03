"""Load seed policies from YAML into the database."""
from __future__ import annotations

from pathlib import Path

import yaml
from sqlmodel import Session, select

from app.models import Policy, Vehicle
from app.seed.sample_data import DEMO_CLAIMS, SAMPLE_VEHICLES

_POLICIES_YAML = Path(__file__).parent / "policies.yaml"


def load_policies(session: Session) -> None:
    data = yaml.safe_load(_POLICIES_YAML.read_text())
    for entry in data:
        exists = session.exec(
            select(Policy).where(
                Policy.code == entry["code"], Policy.version == entry["version"]
            )
        ).first()
        if exists:
            continue
        session.add(Policy(**entry))
    session.commit()


def load_vehicles(session: Session) -> None:
    for v in SAMPLE_VEHICLES:
        exists = session.exec(select(Vehicle).where(Vehicle.vin == v["vin"])).first()
        if exists:
            continue
        session.add(Vehicle(**v))
    session.commit()


def seed_demo_claims(session: Session) -> None:
    """Run the demo claim batch through the engine (only if none exist yet),
    so the dashboard and analytics have populated data on first launch."""
    from app.engine.orchestrator import decide  # lazy: avoids import cycle
    from app.models import Claim

    if session.exec(select(Claim)).first() is not None:
        return
    for data in DEMO_CLAIMS:
        claim = Claim(**data)
        session.add(claim)
        session.commit()
        session.refresh(claim)
        decide(claim, session)


def seed_all(session: Session) -> None:
    load_policies(session)
    load_vehicles(session)
