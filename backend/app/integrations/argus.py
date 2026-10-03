"""Argus telematics adapter.

`StubArgus` serves bundled sample telematics so the app runs with zero setup.
`ArgusAdapter` is a real-shaped skeleton for the live API.
"""
from __future__ import annotations

from app.config import get_settings
from app.integrations.base import TelematicsAdapter, TelematicsSnapshot


class StubArgus(TelematicsAdapter):
    def get_snapshot(self, vin: str) -> TelematicsSnapshot:
        from app.seed.sample_data import SAMPLE_TELEMATICS  # lazy: avoids import cycle

        snap = SAMPLE_TELEMATICS.get(vin)
        if snap is None:
            return TelematicsSnapshot(
                vin=vin, running_status="offline", total_km=0, found=False
            )
        return snap


class ArgusAdapter(TelematicsAdapter):
    """Live Argus client skeleton.

    Map the live payload (running status, odometer, charging cycles, battery
    SoH / voltage, trip aggregates) into TelematicsSnapshot here.
    """

    def __init__(self) -> None:
        self.settings = get_settings()

    def get_snapshot(self, vin: str) -> TelematicsSnapshot:
        # TODO: GET {argus_base_url}/vehicles/{vin}/telemetry with API key header;
        #       aggregate trip/charging history into TelematicsSnapshot.
        raise NotImplementedError("Implement Argus fetch for live mode")
