"""Warranty claim submitted by a dealer / service centre."""
from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel

from app.enums import ClaimStatus


class Claim(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    vin: str = Field(index=True)
    component: str                          # claimed failed component
    failure_description: str                # free-text narrative from technician
    odometer_km: int                        # reading at time of claim
    claim_date: date
    dealer: str = ""
    parts_genuine: bool = True              # dealer declaration
    # Warranty package active on this vehicle at time of claim.
    # Defaults to standard; dealer can upgrade to an extended package.
    warranty_package: str = Field(default="OBEN-STD")
    attachments: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    # Structured fault details filled by the technician at the service centre
    fault_title: str = Field(default="")
    fault_code: str = Field(default="")
    service_observation: str = Field(default="")

    # ── Vehicle snapshot (captured at claim time from VIN lookup) ─────────────
    registration_number: str = Field(default="")
    vehicle_reporting_time: str = Field(default="")
    last_service_date: str = Field(default="")
    last_service_odometer: int = Field(default=0)
    battery_type: str = Field(default="")
    battery_version: str = Field(default="")
    vcu_id: str = Field(default="")
    hmi_number: str = Field(default="")
    sn_sku: str = Field(default="")
    is_first_visit: bool = Field(default=False)
    any_modification: bool = Field(default=False)
    modification_details: str = Field(default="")
    all_services_on_time: bool = Field(default=True)
    missed_service_detail: str = Field(default="")

    # ── Parts & PFR ───────────────────────────────────────────────────────────
    primary_part: str = Field(default="")
    product_code: str = Field(default="")
    secondary_part: str = Field(default="")
    old_serial_numbers: str = Field(default="")
    failure_type: str = Field(default="")
    elite_care_package: str = Field(default="")
    ho_review: bool = Field(default=False)
    back_data: bool = Field(default=False)
    pfr_name: str = Field(default="")

    # ── Responsible persons ───────────────────────────────────────────────────
    service_engineer: str = Field(default="")
    submitted_by: str = Field(default="")
    asm_name: str = Field(default="")
    asm_email: str = Field(default="")
    product_specialist_1: str = Field(default="")
    product_specialist_2: str = Field(default="")
    zone: str = Field(default="")
    location_type: str = Field(default="")
    service_role: str = Field(default="")

    # ── Extended fault details ────────────────────────────────────────────────
    safety_severity: str = Field(default="")
    customer_voice: str = Field(default="")
    issue_reported_by: str = Field(default="")
    error_replication: bool = Field(default=True)
    service_team_feedback: str = Field(default="")
    severity_remarks: str = Field(default="")
    steps_to_replicate: str = Field(default="")
    fault_reported_date: str = Field(default="")

    status: ClaimStatus = Field(default=ClaimStatus.SUBMITTED, index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
