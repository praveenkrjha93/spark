"""Database engine and session management."""
from __future__ import annotations

import os
from collections.abc import Iterator
from pathlib import Path

from sqlmodel import Session, SQLModel, create_engine

from app.config import get_settings

_settings = get_settings()

_database_url = _settings.database_url

# Vercel's deployed filesystem is read-only except for temporary storage.
# Use /tmp for SQLite when no database URL is explicitly configured.
if os.getenv("VERCEL") and _database_url.startswith("sqlite"):
    if not os.getenv("DATABASE_URL"):
        _database_url = "sqlite:////tmp/spark.db"

_connect_args = (
    {"check_same_thread": False}
    if _database_url.startswith("sqlite")
    else {}
)

engine = create_engine(
    _database_url,
    echo=False,
    connect_args=_connect_args,
)


def init_db() -> None:
    """Create all tables. Import models so they register on SQLModel.metadata."""
    from app import models  # noqa: F401

    # Ensure the parent directory exists for file-based SQLite databases.
    if _database_url.startswith("sqlite:///") and ":memory:" not in _database_url:
        db_path = _database_url.removeprefix("sqlite:///")
        if db_path and not db_path.startswith("file:"):
            Path(db_path).expanduser().resolve().parent.mkdir(
                parents=True,
                exist_ok=True,
            )

    SQLModel.metadata.create_all(engine)


def get_session() -> Iterator[Session]:
    """Provide a database session for a request."""
    with Session(engine, expire_on_commit=False) as session:
        yield session
