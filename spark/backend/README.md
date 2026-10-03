# Spark — EV Warranty Claims Decisioning

Decides whether an EV warranty claim is valid against the warranty terms &
conditions, explains and categorizes rejections, flags data anomalies, and keeps
a human in the loop by design. Grounded in **Zoho CRM** (sale + job-card data)
and **Argus** telematics (km, charging cycles, battery SoH/voltage, trips).

Every decision is **auditable**: it cites the exact policy clause and the
evidence that drove it, and records a full reasoning trace.

## Why a hybrid engine
- **Deterministic rules** ([app/engine/rules.py](app/engine/rules.py)) evaluate
  the quantitative T&C — coverage period, km limit (standard vs. extended battery
  window), excluded components, genuine parts, service-schedule adherence. These
  are testable and never hallucinate; a hard rule failure is the authoritative,
  legally-defensible rejection.
- **Claude reasoning** ([app/engine/reasoning.py](app/engine/reasoning.py))
  judges the *narrative*: defect vs. wear-and-tear vs. misuse, and evidence
  consistency. It returns structured JSON (verdict, confidence, clause,
  rationale) via tool-use. **No API key needed to run** — it falls back to a
  deterministic mock so the whole pipeline stays functional and testable.
- **Orchestrator** ([app/engine/orchestrator.py](app/engine/orchestrator.py))
  enriches → runs rules → detects anomalies → reasons → merges into one decision
  with a confidence score, routing anomalous / low-confidence / conflicting
  claims to the human queue.

## Pipeline
```
Claim ─▶ Enrich (Zoho + Argus) ─▶ Rules ─▶ Anomaly detect ─▶ Claude reasoning
                                                                    │
              REJECTED (hard rule)   VALID (high conf)   NEEDS_REVIEW ─▶ HITL queue
                                                                    │
                                              Human approve / reject / request-info
                                                       (recorded as audit override)
```

## Requirements mapping
| Requirement | Where |
|---|---|
| Valid/invalid decision | [orchestrator.py](app/engine/orchestrator.py) + [rules.py](app/engine/rules.py) |
| Rejection reason (clause + evidence) | `Decision.summary` / `reasoning_trace` in [models/decision.py](app/models/decision.py) |
| Categorize failed claims | [engine/categorize.py](app/engine/categorize.py), `RejectionCategory` in [enums.py](app/enums.py) |
| Human-in-the-loop | [models/review.py](app/models/review.py) + [routers/review.py](app/routers/review.py) |
| Ambiguity / anomaly flagging | [engine/anomaly.py](app/engine/anomaly.py) + confidence routing |
| Zoho CRM connector | [integrations/zoho.py](app/integrations/zoho.py) |
| Argus telematics connector | [integrations/argus.py](app/integrations/argus.py) |

## Run it

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# End-to-end demo (3 representative claims) — no API key needed
python demo.py

# Tests
pytest

# API
uvicorn app.main:app --reload      # docs at http://127.0.0.1:8000/docs
```

### Configuration
Copy [.env.example](.env.example) to `.env`. Key switches:
- `ANTHROPIC_API_KEY` — set to use live Claude reasoning; unset uses the mock.
- `INTEGRATIONS_MODE` — `stub` (bundled sample data) or `live` (real Zoho/Argus).
- `CONFIDENCE_REVIEW_THRESHOLD` / `AUTO_APPROVE_THRESHOLD` — routing thresholds.

## Key endpoints
- `POST /claims` — submit a claim; runs the pipeline, returns claim + decision.
- `GET /claims/{id}` — claim + latest decision + reasoning trace.
- `GET /review/queue` — human review work queue (by status/priority).
- `POST /review/{task_id}/decision` — reviewer approve/reject/request-info; the
  human outcome is recorded on the decision as an auditable override.
- `GET /policies` — versioned warranty T&C.

## Going live with integrations
`ZohoCRMAdapter` and `ArgusAdapter` are real-shaped skeletons implementing the
`CRMAdapter` / `TelematicsAdapter` protocols in
[integrations/base.py](app/integrations/base.py). Fill in auth + endpoint calls,
set credentials in `.env`, and flip `INTEGRATIONS_MODE=live` — the engine is
unchanged.

## Roadmap (one-stop after-sales tool)
Built next, on top of these interfaces:
- **Reviewer web UI** (React + TypeScript) — queue, SLA timers, side-by-side
  evidence, one-click override.
- **Analytics** — failure-category trends, component-reliability signals for
  engineering/quality, dealer/region fraud patterns, cycle-time, auto-approval rate.
- **T&C version management** — upload/diff policies; each vehicle judged against
  the policy in force at its sale date.
- **Telematics fraud scoring** — beyond the current anomaly detectors.
- **Auto-generated customer/dealer letters** — rejection + info-request drafts.
- **Human-override feedback loop** — refine rules/prompts from reviewer decisions;
  track model-vs-human agreement.
- **Payout/cost estimation** from job-card parts & labour.
- **RBAC**, notifications (email/Slack/Teams), Postgres + Alembic migrations.

## Project layout
```
backend/app/
  engine/        rules, reasoning, anomaly, categorize, orchestrator, types
  integrations/  base (interfaces), zoho, argus (stub + live skeletons)
  models/        vehicle, policy, claim, decision, review (SQLModel tables)
  routers/       claims, review, policies, health
  seed/          policies.yaml (T&C), sample_data.py, loader
  config.py db.py enums.py main.py
backend/demo.py  backend/tests/
```
