"""A tiny key->value store for admin-tunable runtime settings.

Anything that must change without a redeploy (unlike the env-based `Settings`)
lives here, keyed by a short string. Values are stored as text and parsed by the
caller (see app/appsettings.py).
"""
from __future__ import annotations

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base
from .base import TimestampMixin


class AppSetting(TimestampMixin, Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str] = mapped_column(String(500), nullable=False)
