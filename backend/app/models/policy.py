"""Versioned warranty policy (T&C encoded as rules + citable clause text)."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class Policy(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    code: str = Field(index=True)          # e.g. "OBEN-STD"
    version: str                            # e.g. "2025.1"
    title: str

    # Top-level fallback limits (used when a component is not in part_limits).
    coverage_years: int
    coverage_km: int
    # Battery-specific fallback (used when "battery" not found in part_limits).
    battery_coverage_years: int
    battery_coverage_km: int
    battery_min_soh_pct: float = 70.0
    service_schedule_required: bool = True
    max_service_overdue_days: int = 30

    # Per-component limits: {component_key: {years|months: int, km: int}}
    # "new" era limits apply to vehicles sold on/after era_boundary.
    part_limits: dict[str, dict] = Field(default_factory=dict, sa_column=Column(JSON))
    # "old" era limits apply to vehicles sold before era_boundary.
    old_part_limits: dict[str, dict] = Field(default_factory=dict, sa_column=Column(JSON))
    # ISO date string for era boundary; empty means always use part_limits.
    era_boundary: str = Field(default="")

    covered_components: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    excluded_components: list[str] = Field(default_factory=list, sa_column=Column(JSON))

    # Full clause text keyed by clause id (e.g. "4.2"), for LLM citation + UI.
    clauses: dict[str, str] = Field(default_factory=dict, sa_column=Column(JSON))

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
