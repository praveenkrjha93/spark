"""Zoho CRM adapter.

`StubZohoCRM` serves bundled sample data so the app runs with zero setup.
`ZohoCRMAdapter` is a real-shaped skeleton: fill in credentials + endpoints
(see .env.example) and flip INTEGRATIONS_MODE=live.
"""
from __future__ import annotations

from app.config import get_settings
from app.integrations.base import CRMAdapter, CRMRecord


class StubZohoCRM(CRMAdapter):
    def get_vehicle(self, vin: str) -> CRMRecord:
        from app.seed.sample_data import SAMPLE_CRM  # lazy: avoids import cycle

        record = SAMPLE_CRM.get(vin)
        if record is None:
            return CRMRecord(
                vin=vin, sale_date=None, owner_name="", policy_code="", found=False
            )
        return record


class ZohoCRMAdapter(CRMAdapter):
    """Live Zoho CRM client skeleton.

    Zoho uses OAuth2 refresh-token flow; sale/job-card/claim data typically
    live in custom modules. Map those module records into CRMRecord here.
    """

    def __init__(self) -> None:
        self.settings = get_settings()

    def _access_token(self) -> str:
        # TODO: POST to https://accounts.zoho.com/oauth/v2/token with
        # refresh_token / client_id / client_secret and cache until expiry.
        raise NotImplementedError("Configure Zoho OAuth before using live mode")

    def get_vehicle(self, vin: str) -> CRMRecord:
        # TODO: GET {zoho_api_domain}/crm/v3/{VehiclesModule}/search?criteria=(VIN:equals:{vin})
        #       then fetch related JobCards / Claims and map into CRMRecord.
        raise NotImplementedError("Implement Zoho CRM fetch for live mode")
