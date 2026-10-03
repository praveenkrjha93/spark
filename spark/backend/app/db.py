"""Database engine and session management."""
from __future__ import annotations

from collections.abc import Iterator

from sqlmodel import Session, SQLModel, create_engine

from app.config import get_settings

_settings = get_settings()

# check_same_thread only matters for SQLite; harmless default otherwise.
_connect_args = (
    {"check_same_thread": False}
    if _settings.database_url.startswith("sqlite")
    else {}
)

engine = create_engine(_settings.database_url, echo=False, connect_args=_connect_args)


def init_db() -> None:
    """Create all tables. Import models so they register on SQLModel.metadata."""
    from app import models  # noqa: F401  (side-effect import registers tables)

    SQLModel.metadata.create_all(engine)


def get_session() -> Iterator[Session]:
    # expire_on_commit=False keeps ORM objects readable after commit, so route
    # handlers can serialize them without a stale/expired-attribute reload.
    with Session(engine, expire_on_commit=False) as session:
        yield session
