"""Adapter selection: return stub or live implementations based on config."""
from __future__ import annotations

from app.config import get_settings
from app.integrations.base import CRMAdapter, TelematicsAdapter
from app.integrations.zoho import StubZohoCRM, ZohoCRMAdapter
from app.integrations.argus import ArgusAdapter, StubArgus


def get_crm_adapter() -> CRMAdapter:
    settings = get_settings()
    if settings.integrations_mode == "live":
        return ZohoCRMAdapter()
    return StubZohoCRM()


def get_telematics_adapter() -> TelematicsAdapter:
    settings = get_settings()
    if settings.integrations_mode == "live":
        return ArgusAdapter()
    return StubArgus()


__all__ = ["get_crm_adapter", "get_telematics_adapter"]
