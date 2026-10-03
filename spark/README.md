# SPARK — Smart Platform for Automotive Repair Knowledge

An EV warranty-claims decisioning app for the after-sales service team. SPARK
decides whether warranty claims are valid against the policy terms & conditions,
and — when not — explains and categorizes the rejection. Every decision is
**auditable and grounded in real data**: it cites the exact policy clause and the
evidence (from Zoho CRM and Argus telematics) that drove it, and routes ambiguous
or anomalous cases to a human review queue.

## Repository layout

```
spark/
  backend/    # FastAPI + SQLModel decision engine + REST API (Python 3.14)
  frontend/   # Vite + React + TypeScript reviewer UI
```

## Architecture

**Hybrid decision engine** — deterministic rules (auditable T&C: coverage window,
km limit, exclusions, service schedule) + a Claude reasoning layer for narrative
judgment (defect vs. wear/misuse), merged by an orchestrator into one decision
with a confidence score and a full reasoning trace citing clause + evidence.
Anomaly detectors cross-check the claim narrative against telematics and route
suspect claims to a human queue. Runs fully without an API key (reasoning falls
back to a deterministic mock).

## Backend — run it

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- Config via `.env` (see `backend/.env.example`); `ANTHROPIC_API_KEY` is optional.
- Tests: `pytest`.  End-to-end demo: `python demo.py`.

## Frontend — run it

```bash
cd frontend
npm install
npm run dev          # dev server; /api is proxied to http://127.0.0.1:8000
npm run build        # production build
```

## Features

- Home dashboard with at-a-glance metrics and a live greeting.
- **Claims** — paginated, searchable, filterable table (server-side); click a row
  to open the claim detail, review evidence + reasoning trace, and approve / reject
  / request info on flagged claims.
- **Raise a claim** — submit a claim and get a live decision.
- **Analytics** — verdict distribution, rejection categories, and component
  failure-mode / reliability analysis.
- **Terms & Conditions** — versioned policy management (structured, file import, or
  AI-assisted extraction from a policy document).
- Light / dark theme (light default).
