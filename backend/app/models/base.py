"""Reusable column mixins shared by every model.

Portability notes:
- `Uuid` primary keys render as native UUID on Postgres and as CHAR(32) on
  databases without a UUID type (SQLite/MySQL), so the same code works
  everywhere and IDs are generated app-side (no DB sequence needed).
- Timestamps use `func.now()`, which each dialect maps to its own NOW().
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column


class UUIDMixin:
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
