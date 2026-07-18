"""A Board is one storyboard / branching-storyline canvas."""
from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base
from .base import TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from .edge import Edge
    from .node import Node


class Board(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "boards"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # "Reusable template" is a *per-user* marking (see BoardTemplate), not a
    # property of the board itself -- a collaborator flagging a shared board as
    # their template must not turn it into a template for everyone else.

    # Manual sort order within the owner's board list (ascending; smaller = top).
    # New boards get a smaller value so they appear first; the reorder endpoint
    # rewrites these to 0..n-1.
    position: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )

    # Owner of this board. Nullable so the column can be added to a pre-auth
    # database; the first registered user claims any ownerless boards.
    owner_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )

    # Optional folder this board is organized under (null = unfiled). Deleting a
    # folder just unfiles its boards (SET NULL), never deletes them.
    folder_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("folders.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Optional category this board is filed directly under (null = uncategorized).
    # Deleting a category just uncategorizes its items (SET NULL).
    category_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True
    )

    nodes: Mapped[list["Node"]] = relationship(
        back_populates="board",
        cascade="all, delete-orphan",
    )
    edges: Mapped[list["Edge"]] = relationship(
        back_populates="board",
        cascade="all, delete-orphan",
    )
