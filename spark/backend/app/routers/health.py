"""Health check router."""
from __future__ import annotations

from fastapi import APIRouter

from app.config import get_settings

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict:
    s = get_settings()
    return {
        "status": "ok",
        "integrations_mode": s.integrations_mode,
        "llm_enabled": s.llm_enabled,
    }
