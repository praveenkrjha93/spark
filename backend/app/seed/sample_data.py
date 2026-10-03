"""Oben Electric sample data for stub integrations + seeded demo claims.

Vehicles span:
  OBEN-VALID  → mostly VALID decisions (covered components, within limits)
  OBEN-REJECT → REJECTED by rules (mileage exceeded, tampering, extreme condition)
  OBEN-REVIEW → NEEDS_REVIEW (anomalies, unknown root cause, ambiguous)

Sold dates are chosen to exercise both old era (pre 01-May-25) and new era.
"""
from __future__ import annotations

from datetime import date

from app.integrations.base import CRMRecord, JobCard, TelematicsSnapshot

# VINs
VIN_VALID  = "OBEN1RORR000000001"   # new era, STD — mostly VALID
VIN_REJECT = "OBEN1RORR000000002"   # old era, STD — mileage-exceeded + rejections
VIN_REVIEW = "OBEN1RORR000000003"   # new era, COMP-560 — anomalies + PFR cases

SAMPLE_VEHICLES = [
    dict(vin=VIN_VALID,  model="Oben Rorr", variant="Standard",
         sale_date=date(2024, 6, 15),  owner_name="A. Sharma",   policy_code="OBEN-STD",
         production_date="2024-05-22", owner_phone="+91 98765 43210", owner_email="a.sharma@example.com",
         battery_serial="BATT-2024-A001", motor_serial="MOT-2024-A001",
         controller_serial="CTRL-2024-A001", charger_serial="CHR-2024-A001",
         registration_number="KA 01 EZ 1234", battery_type="NMC", battery_version="V2.1",
         vcu_id="VCU-2024-A001", hmi_number="HMI-2024-A001", sn_sku="RORR-STD-KIT-2024"),
    dict(vin=VIN_REJECT, model="Oben Rorr", variant="Standard",
         sale_date=date(2023, 9, 10),  owner_name="R. Iyer",     policy_code="OBEN-STD",
         production_date="2023-08-18", owner_phone="+91 91234 56789", owner_email="r.iyer@example.com",
         battery_serial="BATT-2023-B012", motor_serial="MOT-2023-B012",
         controller_serial="CTRL-2023-B012", charger_serial="CHR-2023-B012",
         registration_number="AP 09 BB 5678", battery_type="NMC", battery_version="V1.8",
         vcu_id="VCU-2023-B012", hmi_number="HMI-2023-B012", sn_sku="RORR-STD-KIT-2023"),
    dict(vin=VIN_REVIEW, model="Oben Rorr", variant="Standard",
         sale_date=date(2025, 6, 1),   owner_name="M. Verma",    policy_code="OBEN-COMP-560",
         production_date="2025-05-10", owner_phone="+91 87654 32109", owner_email="m.verma@example.com",
         battery_serial="BATT-2025-C007", motor_serial="MOT-2025-C007",
         controller_serial="CTRL-2025-C007", charger_serial="CHR-2025-C007",
         registration_number="MH 12 XY 9999", battery_type="NMC", battery_version="V2.2",
         vcu_id="VCU-2025-C007", hmi_number="HMI-2025-C007", sn_sku="RORR-COMP-KIT-2025"),
]

SAMPLE_CRM: dict[str, CRMRecord] = {
    VIN_VALID: CRMRecord(
        vin=VIN_VALID, sale_date=date(2024, 6, 15), owner_name="A. Sharma",
        policy_code="OBEN-STD",
        job_cards=[
            JobCard(date(2024, 12, 10), 5000,  "scheduled-service", "Free 1st service"),
            JobCard(date(2025, 6, 20),  12000, "scheduled-service", "10k service"),
        ],
        prior_claim_ids=[],
    ),
    VIN_REJECT: CRMRecord(
        vin=VIN_REJECT, sale_date=date(2023, 9, 10), owner_name="R. Iyer",
        policy_code="OBEN-STD",
        job_cards=[
            JobCard(date(2024, 3, 5),  8000,  "scheduled-service", "Free 1st service"),
            JobCard(date(2024, 9, 18), 18000, "scheduled-service", "Scheduled service"),
        ],
        prior_claim_ids=["CLM-2024-041"],
    ),
    VIN_REVIEW: CRMRecord(
        vin=VIN_REVIEW, sale_date=date(2025, 6, 1), owner_name="M. Verma",
        policy_code="OBEN-COMP-560",
        job_cards=[
            JobCard(date(2025, 10, 5), 4500, "scheduled-service", "Free 1st service"),
        ],
        prior_claim_ids=[],
    ),
}

SAMPLE_TELEMATICS: dict[str, TelematicsSnapshot] = {
    VIN_VALID: TelematicsSnapshot(
        vin=VIN_VALID, running_status="active", total_km=13200,
        odometer_history=[5000, 9000, 12000, 13200],
        dc_fast_charge_cycles=22, ac_charge_cycles=210, total_charge_cycles=232,
        battery_soh_pct=95.4, battery_voltage_v=72.1,
        avg_trip_km=18.5, trips_last_30d=38,
    ),
    VIN_REJECT: TelematicsSnapshot(
        vin=VIN_REJECT, running_status="active", total_km=42800,
        odometer_history=[8000, 20000, 35000, 42800],
        dc_fast_charge_cycles=95,  ac_charge_cycles=420, total_charge_cycles=515,
        battery_soh_pct=86.2, battery_voltage_v=71.4,
        avg_trip_km=38.0, trips_last_30d=29,
    ),
    # Anomaly: claim will say "mostly AC charged" — telematics shows 280 DC cycles.
    VIN_REVIEW: TelematicsSnapshot(
        vin=VIN_REVIEW, running_status="active", total_km=6300,
        odometer_history=[4500, 5800, 6300],
        dc_fast_charge_cycles=280, ac_charge_cycles=40, total_charge_cycles=320,
        battery_soh_pct=82.0, battery_voltage_v=71.8,
        avg_trip_km=22.0, trips_last_30d=45,
    ),
}

# ── 3 representative scenarios for demo.py ───────────────────────────────────
SAMPLE_CLAIMS = [
    # 1. VALID — covered motor failure, within limits, clean history
    dict(
        vin=VIN_VALID, component="motor",
        failure_description=(
            "Motor showing M-sign error on HMI (Error 49X). Intermittent loss of "
            "power at speed. No accident history; vehicle maintained as per schedule."
        ),
        odometer_km=13200, claim_date=date(2025, 9, 1),
        dealer="Oben Care Centre Bengaluru", parts_genuine=True,
        warranty_package="OBEN-STD",
    ),
    # 2. REJECTED — old-era STD, mileage exceeded for motor controller (1Y/10000km old era)
    dict(
        vin=VIN_REJECT, component="motor controller",
        failure_description=(
            "Controller throwing continuous M-sign; bike does not move. "
            "No external modifications or accessories."
        ),
        odometer_km=42800, claim_date=date(2025, 9, 5),
        dealer="Oben Care Centre Hyderabad", parts_genuine=True,
        warranty_package="OBEN-STD",
    ),
    # 3. NEEDS_REVIEW — anomaly: DC fast-charge cycles contradict narrative
    dict(
        vin=VIN_REVIEW, component="battery",
        failure_description=(
            "Sudden charge drop — battery shows 40% on HMI but drops to 0 suddenly. "
            "Owner states vehicle is mostly AC charged at home; rarely uses fast charge."
        ),
        odometer_km=6300, claim_date=date(2025, 9, 10),
        dealer="Oben Care Centre Mumbai", parts_genuine=True,
        warranty_package="OBEN-COMP-560",
    ),
]

# ── Extended demo batch (seeded at startup for analytics + UI testing) ────────
DEMO_CLAIMS = SAMPLE_CLAIMS + [
    # --- Additional VALID ---
    dict(vin=VIN_VALID, component="hmi",
         failure_description="HMI not turning ON; 72V battery output normal; 12V DCDC checked ok. "
                             "No external accessories fitted. First occurrence.",
         odometer_km=12800, claim_date=date(2025, 8, 20),
         dealer="Oben Care Centre Bengaluru", parts_genuine=True,
         warranty_package="OBEN-STD"),
    dict(vin=VIN_VALID, component="dcdc converter",
         failure_description="12V system dropping intermittently; lights flickering. "
                             "No external accessories. No modifications.",
         odometer_km=11500, claim_date=date(2025, 8, 15),
         dealer="Oben Care Centre Bengaluru", parts_genuine=True,
         warranty_package="OBEN-STD"),
    dict(vin=VIN_VALID, component="wire harness",
         failure_description="Intermittent horn not working; wiring harness found chafed at frame "
                             "junction. No external accessories or modifications.",
         odometer_km=13000, claim_date=date(2025, 9, 2),
         dealer="Oben Care Centre Bengaluru", parts_genuine=True,
         warranty_package="OBEN-STD"),

    # --- REJECTED: Excluded component (wear item) ---
    dict(vin=VIN_VALID, component="brake pads",
         failure_description="Front brake pads worn below minimum thickness.",
         odometer_km=13200, claim_date=date(2025, 9, 3),
         dealer="Oben Care Centre Bengaluru", parts_genuine=True,
         warranty_package="OBEN-STD"),

    # --- REJECTED: External repair / tampering ---
    dict(vin=VIN_REJECT, component="charger",
         failure_description="Charger not working after external rework done at local shop. "
                             "Evidence of soldering on PCB and cut wires observed.",
         odometer_km=38000, claim_date=date(2025, 8, 10),
         dealer="Oben Care Centre Hyderabad", parts_genuine=True,
         warranty_package="OBEN-STD"),

    # --- REJECTED: Mileage exceeded (belt - old era 1Y/10000km) ---
    dict(vin=VIN_REJECT, component="drive belt",
         failure_description="Belt broken; vehicle not moving. Belt worn out.",
         odometer_km=42800, claim_date=date(2025, 8, 5),
         dealer="Oben Care Centre Hyderabad", parts_genuine=True,
         warranty_package="OBEN-STD"),

    # --- REJECTED: Extreme condition ---
    dict(vin=VIN_VALID, component="mono shock",
         failure_description="Rear shock completely damaged after riding through deep "
                             "waterlogged roads and overloaded with heavy cargo.",
         odometer_km=11000, claim_date=date(2025, 7, 28),
         dealer="Oben Care Centre Bengaluru", parts_genuine=True,
         warranty_package="OBEN-STD"),

    # --- REJECTED: Duplicate/local part ---
    dict(vin=VIN_VALID, component="horn",
         failure_description="Local horn installed by customer; original horn now also "
                             "not working. Non-genuine part in circuit.",
         odometer_km=12000, claim_date=date(2025, 8, 1),
         dealer="Oben Care Centre Bengaluru", parts_genuine=True,
         warranty_package="OBEN-STD"),

    # --- NEEDS_REVIEW: Unknown root cause (PFR required) ---
    dict(vin=VIN_REVIEW, component="indicators",
         failure_description="All indicators stopped working suddenly. No external "
                             "accessories, no visible damage. Root cause not established.",
         odometer_km=5800, claim_date=date(2025, 9, 8),
         dealer="Oben Care Centre Mumbai", parts_genuine=True,
         warranty_package="OBEN-COMP-560"),

    # --- NEEDS_REVIEW: Non-genuine accessory affecting motor controller ---
    dict(vin=VIN_VALID, component="motor controller",
         failure_description="Controller error after customer added USB charging socket "
                             "and extra LED lights — possible short circuit.",
         odometer_km=10500, claim_date=date(2025, 7, 15),
         dealer="Oben Care Centre Bengaluru", parts_genuine=True,
         warranty_package="OBEN-STD"),
]
