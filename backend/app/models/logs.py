"""Audit logs.

ActivityLog is the curated, human-readable event stream (who did what). The
actor is denormalized (username) so an entry survives the user's deletion.

RequestLog is the raw per-request stream (every API call), written by an HTTP
middleware so nothing is missed.
"""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base
from .base import TimestampMixin, UUIDMixin


class ActivityLog(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "activity_logs"

    user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    username: Mapped[str | None] = mapped_column(String(60), nullable=True)
    action: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    entity_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    entity_id: Mapped[UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
    summary: Mapped[str] = mapped_column(String(500), nullable=False, default="")


class RequestLog(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "request_logs"

    user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    method: Mapped[str] = mapped_column(String(10), nullable=False)
    path: Mapped[str] = mapped_column(String(500), nullable=False)
    status_code: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)


class ErrorLog(UUIDMixin, TimestampMixin, Base):
    """An unhandled server exception, captured with its stack trace."""

    __tablename__ = "error_logs"

    user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    method: Mapped[str] = mapped_column(String(10), nullable=False)
    path: Mapped[str] = mapped_column(String(500), nullable=False)
    message: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    traceback: Mapped[str] = mapped_column(Text, nullable=False, default="")
