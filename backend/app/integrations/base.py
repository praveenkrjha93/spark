"""Integration adapter interfaces + shared data shapes.

The decision engine depends only on these Protocols, so the bundled stubs and
the real Zoho / Argus clients are interchangeable.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Protocol


# ---- CRM (Zoho) shapes -------------------------------------------------------
@dataclass
class JobCard:
    date: date
    odometer_km: int
    work_type: str            # "scheduled-service" | "repair" | ...
    notes: str = ""


@dataclass
class CRMRecord:
    vin: str
    sale_date: date | None
    owner_name: str
    policy_code: str
    job_cards: list[JobCard] = field(default_factory=list)
    prior_claim_ids: list[str] = field(default_factory=list)
    found: bool = True


# ---- Telematics (Argus) shapes ----------------------------------------------
@dataclass
class TelematicsSnapshot:
    vin: str
    running_status: str               # "active" | "parked" | "offline"
    total_km: int
    odometer_history: list[int] = field(default_factory=list)  # chronological
    dc_fast_charge_cycles: int = 0
    ac_charge_cycles: int = 0
    total_charge_cycles: int = 0
    battery_soh_pct: float = 100.0    # state of health
    battery_voltage_v: float = 0.0
    avg_trip_km: float = 0.0
    trips_last_30d: int = 0
    found: bool = True


# ---- Adapter interfaces ------------------------------------------------------
class CRMAdapter(Protocol):
    def get_vehicle(self, vin: str) -> CRMRecord: ...


class TelematicsAdapter(Protocol):
    def get_snapshot(self, vin: str) -> TelematicsSnapshot: ...
