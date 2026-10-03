"""Vehicles router: known vehicles (from the CRM master) for the claim form's
VIN picker and detail enrichment."""
from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_session
from app.integrations import get_crm_adapter, get_telematics_adapter
from app.models import Vehicle

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


@router.get("")
def list_vehicles(session: Session = Depends(get_session)) -> list[Vehicle]:
    return list(session.exec(select(Vehicle).order_by(Vehicle.vin)).all())


@router.get("/{vin}")
def get_vehicle_detail(vin: str, session: Session = Depends(get_session)) -> dict:
    """Return the full vehicle profile: DB record + CRM job-card history + telematics."""
    vehicle = session.exec(select(Vehicle).where(Vehicle.vin == vin)).first()
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    crm = get_crm_adapter().get_vehicle(vin)
    tele = get_telematics_adapter().get_snapshot(vin)

    return {
        "vehicle": vehicle,
        "job_cards": [asdict(jc) for jc in crm.job_cards],
        "prior_claim_ids": crm.prior_claim_ids,
        "telematics": {
            "found": tele.found,
            "total_km": tele.total_km,
            "battery_soh_pct": tele.battery_soh_pct,
            "battery_voltage_v": tele.battery_voltage_v,
            "dc_fast_charge_cycles": tele.dc_fast_charge_cycles,
            "ac_charge_cycles": tele.ac_charge_cycles,
            "running_status": tele.running_status,
        },
    }
