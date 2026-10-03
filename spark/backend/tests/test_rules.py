"""Unit tests for the deterministic rules layer and anomaly detectors."""
from __future__ import annotations

from datetime import date

from sqlmodel import Session, select

from app.engine import anomaly as anomaly_mod
from app.engine import rules as rules_mod
from app.enums import RejectionCategory
from app.integrations.zoho import StubZohoCRM
from app.integrations.argus import StubArgus
from app.models import Claim, Policy
from app.seed.sample_data import VIN_REJECT, VIN_REVIEW, VIN_VALID


def _policy(session: Session) -> Policy:
    return session.exec(select(Policy).where(Policy.code == "EV-STD")).first()


def test_excluded_component_hard_fails(session: Session):
    policy = _policy(session)
    crm = StubZohoCRM().get_vehicle(VIN_VALID)
    tele = StubArgus().get_snapshot(VIN_VALID)
    claim = Claim(vin=VIN_VALID, component="tyres", failure_description="worn out",
                  odometer_km=10000, claim_date=date(2025, 1, 1))
    result = rules_mod.evaluate(claim, policy, crm, tele)
    assert result.hard_fail
    assert result.fail_category == RejectionCategory.EXCLUDED_COMPONENT.value


def test_mileage_limit_hard_fails(session: Session):
    policy = _policy(session)
    crm = StubZohoCRM().get_vehicle(VIN_REJECT)
    tele = StubArgus().get_snapshot(VIN_REJECT)
    claim = Claim(vin=VIN_REJECT, component="infotainment", failure_description="dead",
                  odometer_km=72380, claim_date=date(2025, 6, 1))
    result = rules_mod.evaluate(claim, policy, crm, tele)
    assert result.hard_fail
    assert result.fail_category == RejectionCategory.MILEAGE_EXCEEDED.value


def test_covered_in_period_passes(session: Session):
    policy = _policy(session)
    crm = StubZohoCRM().get_vehicle(VIN_VALID)
    tele = StubArgus().get_snapshot(VIN_VALID)
    claim = Claim(vin=VIN_VALID, component="drive motor", failure_description="whine",
                  odometer_km=25120, claim_date=date(2025, 6, 1))
    result = rules_mod.evaluate(claim, policy, crm, tele)
    assert not result.hard_fail


def test_battery_component_uses_extended_window(session: Session):
    policy = _policy(session)
    crm = StubZohoCRM().get_vehicle(VIN_REJECT)  # 72,380 km
    tele = StubArgus().get_snapshot(VIN_REJECT)
    # Battery pack at 72k km must NOT hard-fail on mileage (limit 160k).
    claim = Claim(vin=VIN_REJECT, component="battery pack", failure_description="loss",
                  odometer_km=72380, claim_date=date(2025, 6, 1))
    result = rules_mod.evaluate(claim, policy, crm, tele)
    assert not result.hard_fail


def test_charging_contradiction_detected(session: Session):
    crm = StubZohoCRM().get_vehicle(VIN_REVIEW)
    tele = StubArgus().get_snapshot(VIN_REVIEW)
    claim = Claim(vin=VIN_REVIEW, component="battery pack",
                  failure_description="capacity loss, vehicle never DC fast charged",
                  odometer_km=30450, claim_date=date(2025, 6, 1))
    anomalies = anomaly_mod.detect(claim, crm, tele)
    assert any(a.type == "charging-contradiction" for a in anomalies)
