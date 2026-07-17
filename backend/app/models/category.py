"""A Category is a top-level grouping in a user's explorer, holding folders and/or
loose boards (a folder or board references it via `category_id`, nullable -- an
item can be uncategorized). Categories are owned and, like folders, can be shared
with other users (Share.category_id); a category share grants the recipient the
category and everything filed in it."""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base
from .base import TimestampMixin, UUIDMixin


class Category(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "categories"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    owner_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Manual sort order within the owner's category list (ascending).
    position: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    # Display order of member ids (folder/board ids, interleaved) as a JSON list.
    # Membership itself is authoritative via Folder.category_id / Board.category_id;
    # this only preserves the manual interleaved ordering. Missing members fall
    # back to their own position.
    item_order: Mapped[str | None] = mapped_column(Text, nullable=True)
