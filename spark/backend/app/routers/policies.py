"""Policies router: view versioned warranty T&C, and author or renew a version.

Three provisions for creating a new version:
  - POST /policies          — structured JSON (the form / renew flow)
  - POST /policies/import   — upload a YAML/JSON policy file matching the schema
  - POST /policies/extract  — upload a raw T&C document (PDF/text); Claude
                              extracts a *draft* for human review (not saved)
"""
from __future__ import annotations

import io

import yaml
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlmodel import Session, select

from app.db import get_session
from app.engine.policy_extract import extract_policy
from app.models import Policy
from app.schemas import PolicyCreate

router = APIRouter(prefix="/policies", tags=["policies"])


@router.get("")
def list_policies(session: Session = Depends(get_session)) -> list[Policy]:
    return list(session.exec(select(Policy).order_by(Policy.code, Policy.version)).all())


@router.get("/{policy_id}")
def get_policy(policy_id: int, session: Session = Depends(get_session)) -> Policy:
    policy = session.get(Policy, policy_id)
    if policy is None:
        raise HTTPException(404, "Policy not found")
    return policy


def _persist(session: Session, payload: PolicyCreate) -> Policy:
    exists = session.exec(
        select(Policy).where(
            Policy.code == payload.code, Policy.version == payload.version
        )
    ).first()
    if exists:
        raise HTTPException(
            409, f"Policy {payload.code} v{payload.version} already exists — bump the version."
        )
    policy = Policy(**payload.model_dump())
    session.add(policy)
    session.commit()
    session.refresh(policy)
    return policy


@router.post("", status_code=201)
def create_policy(
    payload: PolicyCreate, session: Session = Depends(get_session)
) -> Policy:
    """Create / renew a policy version from structured terms."""
    return _persist(session, payload)


@router.post("/import", status_code=201)
async def import_policy(
    file: UploadFile = File(...), session: Session = Depends(get_session)
) -> list[Policy]:
    """Upload a YAML/JSON policy file (one entry or a list) matching the schema."""
    raw = (await file.read()).decode("utf-8", errors="replace")
    try:
        data = yaml.safe_load(raw)  # YAML is a superset of JSON
    except yaml.YAMLError as exc:
        raise HTTPException(400, f"Could not parse the file: {exc}")
    if data is None:
        raise HTTPException(400, "The uploaded file is empty.")

    entries = data if isinstance(data, list) else [data]
    created: list[Policy] = []
    for entry in entries:
        if not isinstance(entry, dict):
            raise HTTPException(422, "Each policy entry must be an object.")
        entry.pop("id", None)  # ignore any exported primary key
        try:
            payload = PolicyCreate(**entry)
        except Exception as exc:
            raise HTTPException(422, f"Invalid policy entry: {exc}")
        created.append(_persist(session, payload))
    return created


@router.post("/extract")
async def extract_policy_doc(file: UploadFile = File(...)) -> dict:
    """Read a raw T&C document (PDF or text) and return a structured *draft* for
    human review. Nothing is saved — the reviewer edits then POSTs /policies."""
    raw = await file.read()
    text = _document_text(file.filename or "", raw)
    if not text.strip():
        raise HTTPException(400, "Could not read any text from the uploaded document.")
    return extract_policy(text)


def _document_text(filename: str, raw: bytes) -> str:
    is_pdf = filename.lower().endswith(".pdf") or raw[:5] == b"%PDF-"
    if is_pdf:
        try:
            from pypdf import PdfReader
        except ImportError:
            raise HTTPException(
                400,
                "PDF upload needs the 'pypdf' package (pip install pypdf), or "
                "paste the T&C as a .txt file instead.",
            )
        try:
            reader = PdfReader(io.BytesIO(raw))
            return "\n".join((page.extract_text() or "") for page in reader.pages)
        except Exception as exc:
            raise HTTPException(400, f"Could not extract text from the PDF: {exc}")
    return raw.decode("utf-8", errors="replace")
