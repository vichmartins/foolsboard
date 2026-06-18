"""A Board is one storyboard / branching-storyline canvas."""
from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import String, Text
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

    nodes: Mapped[list["Node"]] = relationship(
        back_populates="board",
        cascade="all, delete-orphan",
    )
    edges: Mapped[list["Edge"]] = relationship(
        back_populates="board",
        cascade="all, delete-orphan",
    )
