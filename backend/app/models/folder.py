"""A Folder groups a user's storyboards for organization. Boards reference a
folder via Board.folder_id (nullable -- a board can be unfiled)."""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base
from .base import TimestampMixin, UUIDMixin


class Folder(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "folders"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    owner_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Manual sort order within the owner's folder list (ascending).
    position: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
