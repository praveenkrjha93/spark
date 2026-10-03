"""Vehicle master record (mirrors the field-of-truth in Zoho CRM)."""
from __future__ import annotations

from datetime import date

from sqlmodel import Field, SQLModel


class Vehicle(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    vin: str = Field(index=True, unique=True)
    model: str
    variant: str = ""
    sale_date: date
    owner_name: str = ""
    policy_code: str = Field(index=True)   # links to Policy.code in force at sale
    # Extended fields populated from CRM / manufacturing data
    production_date: str = Field(default="")
    owner_phone: str = Field(default="")
    owner_email: str = Field(default="")
    battery_serial: str = Field(default="")
    motor_serial: str = Field(default="")
    controller_serial: str = Field(default="")
    charger_serial: str = Field(default="")
    # Extended technical IDs
    registration_number: str = Field(default="")
    battery_type: str = Field(default="")
    battery_version: str = Field(default="")
    vcu_id: str = Field(default="")
    hmi_number: str = Field(default="")
    sn_sku: str = Field(default="")
