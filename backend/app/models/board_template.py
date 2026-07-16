"""A per-user marking that a board is one of *that user's* reusable templates.

Template status is deliberately per-account, not a property of the board: on a
shared board, one collaborator marking it as their template must not put a
template star on it for everyone else. A board is a template *for user X* iff a
(user_id=X, board_id) row exists here."""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base
from .base import TimestampMixin, UUIDMixin


class BoardTemplate(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "board_templates"
    __table_args__ = (
        UniqueConstraint("user_id", "board_id", name="uq_board_template_user_board"),
    )

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    board_id: Mapped[UUID] = mapped_column(
        ForeignKey("boards.id", ondelete="CASCADE"), nullable=False, index=True
    )
