"""A Node is any object on the canvas: character, scene, dialog, event, ...

`type` is a free-form string rather than a DB enum so you can invent new
object kinds from the UI without a migration. `content` is a JSON blob holding
the per-type body (rich text, fields, etc.) -- on Postgres this is JSON, on
SQLite it is stored as TEXT transparently, keeping the model portable.
"""
from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Float, ForeignKey, String
from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base
from .base import TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from .asset import Asset
    from .board import Board


class Node(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "nodes"

    board_id: Mapped[UUID] = mapped_column(
        ForeignKey("boards.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    type: Mapped[str] = mapped_column(String(50), nullable=False, default="note")
    title: Mapped[str] = mapped_column(String(300), nullable=False, default="")

    # Arbitrary structured body for the object (text, fields, metadata...).
    content: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    # Canvas geometry.
    x: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    y: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    width: Mapped[float | None] = mapped_column(Float, nullable=True)
    height: Mapped[float | None] = mapped_column(Float, nullable=True)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)

    board: Mapped["Board"] = relationship(back_populates="nodes")
    assets: Mapped[list["Asset"]] = relationship(
        back_populates="node",
        cascade="all, delete-orphan",
    )
