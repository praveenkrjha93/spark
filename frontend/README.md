# Spark Reviewer UI

A modern, dark, futuristic React + TypeScript console for the after-sales
warranty team — a **Dashboard** (analytics) and a **Review Queue** (human-in-the
-loop) on top of the Spark decisioning API.

## Stack
- **Vite** + **React 18** + **TypeScript**
- **Tailwind CSS v4** (via `@tailwindcss/vite`) + a small custom design-token
  layer in [src/index.css](src/index.css)
- **Recharts** for the analytics visuals
- **react-router-dom** for routing

## Run

The UI talks to the backend at `/api`, which Vite proxies to
`http://127.0.0.1:8000` (see [vite.config.ts](vite.config.ts)).

```bash
# 1. Start the backend (in ../backend)
cd ../backend && source .venv/bin/activate && uvicorn app.main:app --reload

# 2. Start the UI (here)
cd ../frontend
npm install
npm run dev            # http://127.0.0.1:5173
```

To point at a non-proxied API, set `VITE_API_BASE` (e.g. `VITE_API_BASE=http://host:8000`).

## What's here
- **Dashboard** ([src/pages/Dashboard.tsx](src/pages/Dashboard.tsx)) — KPI tiles
  (total claims, auto-approval rate, open reviews, avg confidence, anomalies),
  a verdict-distribution donut, and a "why claims are rejected" category bar.
- **Review Queue** ([src/pages/ReviewQueue.tsx](src/pages/ReviewQueue.tsx)) —
  master-detail: the routed-to-human queue on the left; on the right the full
  claim with verdict, confidence meter, flagged anomalies, grounding evidence
  (Zoho CRM + Argus telematics), the step-by-step reasoning trace, and the
  reviewer actions (approve / reject / request info) that write back an
  auditable override.

## Design notes
Colors use the dataviz reference palette's **validated dark steps**. Verdict is a
*status* encoding (good / critical / warning) shown with labels, never color
alone; rejection categories are a single-hue *magnitude* chart. Both charts ship
hover tooltips and legends/labels per the visualization method.

## Layout
```
src/
  api/        client.ts, types.ts        # typed API client
  components/ Layout, StatTile, VerdictBadge, ConfidenceMeter,
              EvidencePanel, ReasoningTrace, ClaimDetailPanel,
              charts/VerdictDonut, charts/CategoryBar
  pages/      Dashboard.tsx, ReviewQueue.tsx
  lib/        format.ts                   # verdict meta, labels, formatting
  index.css   App.tsx  main.tsx
```
