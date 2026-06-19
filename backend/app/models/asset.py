"""An Asset is a media file (image, video, audio, document, archive) attached
to a node.

Only metadata lives in the database; the bytes live in the storage backend
(local disk now, S3-compatible later) addressed by `storage_key`. This keeps
the DB small and the storage layer swappable.
"""
from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import BigInteger, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base
from .base import TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from .node import Node


class Asset(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "assets"

    node_id: Mapped[UUID] = mapped_column(
        ForeignKey("nodes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    kind: Mapped[str] = mapped_column(String(30), nullable=False, default="file")
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    content_type: Mapped[str] = mapped_column(String(150), nullable=False)
    size: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)

    # Opaque key understood by the active storage backend.
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)

    # Optional generated preview image (video frame / audio cover art),
    # addressed by its own storage key. Null when none could be produced.
    thumbnail_key: Mapped[str | None] = mapped_column(String(500), nullable=True)

    node: Mapped["Node"] = relationship(back_populates="assets")
