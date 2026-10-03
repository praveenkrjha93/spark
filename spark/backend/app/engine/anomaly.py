"""Anomaly detectors: cross-check the claim narrative + CRM against telematics.

These surface data inconsistencies (possible fraud/error) that should route a
claim to a human rather than being auto-decided.
"""
from __future__ import annotations

import re

from app.integrations.base import CRMRecord, TelematicsSnapshot
from app.models import Claim, Vehicle
from app.engine.types import Anomaly

_FAST_CHARGE_THRESHOLD = 5      # cycles above which "never fast charged" is false
_ODO_MISMATCH_KM = 2500         # claim vs telematics odometer tolerance


def _claims_no_fast_charge(text: str) -> bool:
    t = text.lower()
    negation = any(w in t for w in ("never", "no ", "not ", "without", "only ac"))
    fast = any(w in t for w in ("fast charg", "dc charg", "dc fast", "supercharg"))
    return negation and fast


def detect(
    claim: Claim,
    crm: CRMRecord,
    telematics: TelematicsSnapshot,
    vehicle: Vehicle | None = None,
) -> list[Anomaly]:
    anomalies: list[Anomaly] = []

    # 1. Charging-pattern contradiction.
    if telematics.found and _claims_no_fast_charge(claim.failure_description):
        if telematics.dc_fast_charge_cycles > _FAST_CHARGE_THRESHOLD:
            anomalies.append(Anomaly(
                "charging-contradiction",
                f"Claim states no DC fast charging, but telematics records "
                f"{telematics.dc_fast_charge_cycles} DC fast-charge cycles.",
                "high",
            ))

    # 2. Odometer rollback (non-monotonic history).
    hist = telematics.odometer_history
    if any(b < a for a, b in zip(hist, hist[1:])):
        anomalies.append(Anomaly(
            "odometer-rollback",
            f"Telematics odometer history is non-monotonic: {hist}.",
            "high",
        ))

    # 3. Claim odometer vs telematics odometer mismatch.
    if telematics.found and abs(claim.odometer_km - telematics.total_km) > _ODO_MISMATCH_KM:
        anomalies.append(Anomaly(
            "odometer-mismatch",
            f"Claim odometer {claim.odometer_km} km differs from telematics "
            f"{telematics.total_km} km by more than {_ODO_MISMATCH_KM} km.",
            "medium",
        ))

    # 4. Sale-date mismatch between CRM and vehicle master.
    if vehicle is not None and crm.sale_date and vehicle.sale_date != crm.sale_date:
        anomalies.append(Anomaly(
            "sale-date-mismatch",
            f"CRM sale date {crm.sale_date} differs from vehicle record "
            f"{vehicle.sale_date}.",
            "medium",
        ))

    # 5. Missing ground-truth data (can't substantiate per clause 6.1).
    if not telematics.found:
        anomalies.append(Anomaly(
            "no-telematics",
            "No telematics data available to substantiate the claim.",
            "medium",
        ))
    if not crm.found:
        anomalies.append(Anomaly(
            "no-crm-record",
            "No CRM record found for this VIN.",
            "high",
        ))

    return anomalies
