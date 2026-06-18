"""An Edge links two nodes, forming the branching storyline graph.

`label` lets you annotate a branch (e.g. "if hero refuses"), and `data` holds
any extra per-edge metadata (style, condition, ordering).
"""
from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, String
from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base
from .base import TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from .board import Board
    from .node import Node


class Edge(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "edges"

    board_id: Mapped[UUID] = mapped_column(
        ForeignKey("boards.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_id: Mapped[UUID] = mapped_column(
        ForeignKey("nodes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    target_id: Mapped[UUID] = mapped_column(
        ForeignKey("nodes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    label: Mapped[str | None] = mapped_column(String(300), nullable=True)
    data: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    board: Mapped["Board"] = relationship(back_populates="edges")
    source: Mapped["Node"] = relationship(foreign_keys=[source_id])
    target: Mapped["Node"] = relationship(foreign_keys=[target_id])
