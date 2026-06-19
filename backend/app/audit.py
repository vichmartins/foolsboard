"""Record a curated activity event. Writes (and commits) one ActivityLog row.

Call this after the action's own commit; the actor's username is denormalized so
the entry stays readable even if the user is later deleted.
"""
from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from .models import ActivityLog, User


def log_event(
    db: Session,
    *,
    user: User | None,
    action: str,
    summary: str = "",
    entity_type: str | None = None,
    entity_id: UUID | None = None,
) -> None:
    db.add(
        ActivityLog(
            user_id=user.id if user else None,
            username=user.username if user else None,
            action=action,
            summary=summary[:500],
            entity_type=entity_type,
            entity_id=entity_id,
        )
    )
    db.commit()
