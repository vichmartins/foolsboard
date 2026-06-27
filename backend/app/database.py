"""SQLAlchemy engine, session factory, and declarative Base.

This module is the single place that knows how to talk to *a* database. The
rest of the app depends only on the ORM models and the `get_db` dependency,
which is what keeps the project portable across Postgres / MySQL / SQLite.
"""
from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings

# SQLite needs this flag when used from a threadpool (FastAPI runs sync DB
# calls in a worker thread). It is harmless to omit for other databases.
connect_args = {"check_same_thread": False} if settings.is_sqlite else {}

engine = create_engine(
    settings.database_url,
    connect_args=connect_args,
    pool_pre_ping=True,  # transparently recover dropped connections
    future=True,
)

# SQLite ignores foreign keys (so ON DELETE CASCADE / SET NULL are no-ops) unless
# enabled per connection. Turn it on so a SQLite-backed deployment behaves like
# Postgres: deleting a node removes its edges, deleting a folder unfiles its
# boards, etc. -- otherwise those leave orphaned/dangling rows.
if settings.is_sqlite:

    @event.listens_for(engine, "connect")
    def _sqlite_enable_foreign_keys(dbapi_connection, _record):  # noqa: ANN001
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    """Declarative base shared by every model and by Alembic's autogenerate."""


def get_db() -> Iterator[Session]:
    """FastAPI dependency that yields a request-scoped session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
