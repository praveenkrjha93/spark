"""Request/response DTOs."""
from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field

from app.enums import HumanDecision


class ClaimCreate(BaseModel):
    vin: str
    component: str
    failure_description: str
    odometer_km: int = Field(ge=0)
    claim_date: date
    dealer: str = ""
    parts_genuine: bool = True
    warranty_package: str = "OBEN-STD"
    attachments: list[str] = Field(default_factory=list)
    # Structured fault details
    fault_title: str = ""
    fault_code: str = ""
    service_observation: str = ""
    # Vehicle snapshot
    registration_number: str = ""
    vehicle_reporting_time: str = ""
    last_service_date: str = ""
    last_service_odometer: int = 0
    battery_type: str = ""
    battery_version: str = ""
    vcu_id: str = ""
    hmi_number: str = ""
    sn_sku: str = ""
    is_first_visit: bool = False
    any_modification: bool = False
    modification_details: str = ""
    all_services_on_time: bool = True
    missed_service_detail: str = ""
    # Parts & PFR
    primary_part: str = ""
    product_code: str = ""
    secondary_part: str = ""
    old_serial_numbers: str = ""
    failure_type: str = ""
    elite_care_package: str = ""
    ho_review: bool = False
    back_data: bool = False
    pfr_name: str = ""
    # Responsible persons
    service_engineer: str = ""
    submitted_by: str = ""
    asm_name: str = ""
    asm_email: str = ""
    product_specialist_1: str = ""
    product_specialist_2: str = ""
    zone: str = ""
    location_type: str = ""
    service_role: str = ""
    # Extended fault details
    safety_severity: str = ""
    customer_voice: str = ""
    issue_reported_by: str = ""
    error_replication: bool = True
    service_team_feedback: str = ""
    severity_remarks: str = ""
    steps_to_replicate: str = ""
    fault_reported_date: str = ""


class ReviewDecisionIn(BaseModel):
    human_decision: HumanDecision
    override_notes: str = ""
    resolved_by: str


class PolicyCreate(BaseModel):
    """A new (or renewed) warranty policy version — the structured T&C the
    deterministic rules layer evaluates, plus citable clause text."""

    code: str = Field(min_length=1)                 # e.g. "EV-STD"
    version: str = Field(min_length=1)              # e.g. "2025.1"
    title: str = Field(min_length=1)

    coverage_years: int = Field(ge=0)
    coverage_km: int = Field(ge=0)
    battery_coverage_years: int = Field(ge=0)
    battery_coverage_km: int = Field(ge=0)
    battery_min_soh_pct: float = Field(ge=0, le=100)
    service_schedule_required: bool = True
    max_service_overdue_days: int = Field(default=30, ge=0)

    covered_components: list[str] = Field(default_factory=list)
    excluded_components: list[str] = Field(default_factory=list)
    clauses: dict[str, str] = Field(default_factory=dict)
