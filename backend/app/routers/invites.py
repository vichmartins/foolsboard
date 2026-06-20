"""Invite codes: the admin generates single-use codes that new users redeem to
register (the first account needs none)."""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import log_event
from ..database import get_db
from ..deps import get_current_admin
from ..models import InviteCode, User
from ..schemas import InviteCreate, InviteOut

router = APIRouter(prefix="/api/invites", tags=["invites"])

# Selectable code lifetimes, in minutes.
ALLOWED_MINUTES = {5, 10, 30, 60, 1440, 10080, 43200}


@router.get("", response_model=list[InviteOut])
def list_invites(
    _: User = Depends(get_current_admin), db: Session = Depends(get_db)
) -> list[InviteCode]:
    return list(db.scalars(select(InviteCode).order_by(InviteCode.created_at.desc())))


@router.post("", response_model=InviteOut, status_code=status.HTTP_201_CREATED)
def create_invite(
    payload: InviteCreate,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> InviteCode:
    minutes = payload.expires_in_minutes
    if minutes not in ALLOWED_MINUTES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unsupported expiry duration")
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    invite = InviteCode(
        code=secrets.token_urlsafe(9), created_by_id=admin.id, expires_at=expires_at
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    log_event(db, user=admin, action="invite.create", entity_type="invite", entity_id=invite.id,
              summary=f"generated an invite code (expires in {minutes} min)")
    return invite


@router.delete("/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_invite(
    invite_id: UUID, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)
) -> None:
    invite = db.get(InviteCode, invite_id)
    if invite is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invite not found")
    if invite.used_by_id is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That invite has already been used")
    db.delete(invite)
    db.commit()
    log_event(db, user=admin, action="invite.revoke", entity_type="invite",
              summary="revoked an invite code")
