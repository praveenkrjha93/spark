"""Spark — EV warranty claims decisioning API."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session

from app.db import engine, init_db
from app.routers import analytics, claims, health, policies, review, vehicles
from app.routers import uploads as uploads_router
from app.seed.loader import seed_all, seed_demo_claims


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    with Session(engine) as session:
        seed_all(session)
        seed_demo_claims(session)
    yield


app = FastAPI(
    title="Spark — EV Warranty Claims Decisioning",
    version="0.1.0",
    lifespan=lifespan,
)

# Allow the deployed frontend and local Vite development servers.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://ui-spark.vercel.app",  # Production UI
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1):\d+",  # Local dev (HTTP/HTTPS)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(claims.router)
app.include_router(review.router)
app.include_router(policies.router)
app.include_router(vehicles.router)
app.include_router(analytics.router)
app.include_router(uploads_router.router)


@app.get("/", tags=["health"])
def root() -> dict:
    return {"app": "spark", "docs": "/docs"}
