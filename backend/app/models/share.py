"""A Share grants another user access to one of your boards, folders or categories.

Exactly one of board_id / folder_id / category_id is set (enforced by the router).
A folder share grants access to every board in that folder; a category share grants
access to the category and everything filed in it (its folders and their boards,
plus any loose boards). status moves pending -> accepted / rejected; only accepted
shares grant access.
"""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base
from .base import TimestampMixin, UUIDMixin


class Share(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "shares"

    board_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("boards.id", ondelete="CASCADE"), nullable=True, index=True
    )
    folder_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("folders.id", ondelete="CASCADE"), nullable=True, index=True
    )
    category_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("categories.id", ondelete="CASCADE"), nullable=True, index=True
    )
    # Who shared it, and who it's shared with.
    owner_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    shared_with_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    permission: Mapped[str] = mapped_column(String(10), nullable=False, default="edit")
    status: Mapped[str] = mapped_column(String(10), nullable=False, default="pending")
