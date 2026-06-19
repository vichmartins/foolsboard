"""A User account. The first account created becomes the admin; subsequent
accounts require a valid invite code (see InviteCode). Each user owns their own
boards (Board.owner_id)."""
from __future__ import annotations

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base
from .base import TimestampMixin, UUIDMixin


class User(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True, index=True)
    username: Mapped[str] = mapped_column(String(60), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Suspended accounts can't authenticate (set by an admin).
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Storage key of the profile image (avatar), if one was uploaded.
    avatar_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
