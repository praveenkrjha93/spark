"""Extract a structured warranty-policy draft from raw T&C document text.

Used by the "upload a T&C document" provision. When an ANTHROPIC_API_KEY is
configured, Claude reads the document and fills the structured fields via
tool-use; otherwise we return a defaults-filled template with a note. Either
way the result is a *draft for human review* — it is never saved automatically.
"""
from __future__ import annotations

import json

from app.config import get_settings

_TOOL = {
    "name": "record_policy",
    "description": "Record the structured warranty policy extracted from the T&C text.",
    "input_schema": {
        "type": "object",
        "properties": {
            "code": {"type": "string", "description": "Short policy code, e.g. EV-STD."},
            "version": {"type": "string", "description": "Version label, e.g. 2025.1."},
            "title": {"type": "string"},
            "coverage_years": {"type": "integer", "description": "Vehicle warranty window in years."},
            "coverage_km": {"type": "integer", "description": "Vehicle warranty odometer limit in km."},
            "battery_coverage_years": {"type": "integer"},
            "battery_coverage_km": {"type": "integer"},
            "battery_min_soh_pct": {
                "type": "number",
                "description": "Battery State-of-Health % below which it is replaced.",
            },
            "service_schedule_required": {"type": "boolean"},
            "max_service_overdue_days": {"type": "integer"},
            "covered_components": {
                "type": "array", "items": {"type": "string"},
                "description": "Lowercase component nouns explicitly covered.",
            },
            "excluded_components": {
                "type": "array", "items": {"type": "string"},
                "description": "Lowercase component nouns explicitly excluded.",
            },
            "clauses": {
                "type": "object",
                "description": "Map of clause id (e.g. '4.2') to the clause text.",
                "additionalProperties": {"type": "string"},
            },
        },
        "required": ["title", "coverage_years", "coverage_km"],
    },
}

_SYSTEM = (
    "You extract structured EV warranty terms from raw T&C text so a human can "
    "review them before saving. Fill every field you can justify from the text; "
    "use conservative defaults only when the text is silent. Component names "
    "should be lowercase nouns. Clause ids should match the document's own "
    "numbering where present. Never invent coverage the text does not state."
)

# Sensible standard EV defaults so the reviewer starts from a plausible draft.
_TEMPLATE: dict = {
    "code": "",
    "version": "",
    "title": "",
    "coverage_years": 3,
    "coverage_km": 60000,
    "battery_coverage_years": 8,
    "battery_coverage_km": 160000,
    "battery_min_soh_pct": 70.0,
    "service_schedule_required": True,
    "max_service_overdue_days": 30,
    "covered_components": [],
    "excluded_components": [],
    "clauses": {},
}


def extract_policy(text: str) -> dict:
    """Return a draft policy dict (never persisted). Includes `_note` /
    `_source_excerpt` metadata for the UI; the caller strips these before save."""
    settings = get_settings()
    if not settings.llm_enabled:
        draft = dict(_TEMPLATE)
        draft["title"] = "Draft policy — review required"
        draft["_note"] = (
            "No ANTHROPIC_API_KEY is configured, so terms were not auto-extracted. "
            "This template is pre-filled with standard EV defaults — review and "
            "correct every field against the uploaded document before saving."
        )
        draft["_source_excerpt"] = text[:800]
        return draft
    try:
        return _claude_extract(text, settings)
    except Exception as exc:  # degrade gracefully — never 500 the upload
        draft = dict(_TEMPLATE)
        draft["title"] = "Draft policy — extraction failed"
        draft["_note"] = f"Automatic extraction failed ({exc}). Edit the fields manually."
        draft["_source_excerpt"] = text[:800]
        return draft


def _claude_extract(text: str, settings) -> dict:
    import anthropic

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    resp = client.messages.create(
        model=settings.claude_model,
        max_tokens=2048,
        system=_SYSTEM,
        tools=[_TOOL],
        tool_choice={"type": "tool", "name": "record_policy"},
        messages=[{
            "role": "user",
            "content": f"Extract the warranty terms from this T&C document:\n\n{text[:20000]}",
        }],
    )
    payload = None
    for block in resp.content:
        if getattr(block, "type", None) == "tool_use":
            payload = block.input
            break
    if payload is None:
        raise ValueError("Claude returned no tool_use block")
    if isinstance(payload, str):
        payload = json.loads(payload)

    draft = dict(_TEMPLATE)
    draft.update(payload)
    draft["_note"] = (
        "Auto-extracted by Claude from the uploaded document — review every "
        "field before saving."
    )
    draft["_source_excerpt"] = text[:800]
    return draft
