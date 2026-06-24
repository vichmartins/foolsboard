"""Admin-only endpoints: manage accounts (role / suspension / deletion) and read
the activity and request logs. New accounts are created via invite codes, not
here."""
from __future__ import annotations

from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..audit import log_event
from ..config import settings
from ..database import get_db
from ..deps import get_current_admin
from ..models import ActivityLog, Asset, Board, ErrorLog, Node, RequestLog, User
from ..schemas import (
    ActivityLogOut,
    AdminUserOut,
    AdminUserUpdate,
    ErrorLogOut,
    RequestLogOut,
)
from .assets import gc_orphan_files

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users", response_model=list[AdminUserOut])
def list_users(
    _: User = Depends(get_current_admin), db: Session = Depends(get_db)
) -> list[User]:
    return list(db.scalars(select(User).order_by(User.created_at)))


@router.patch("/users/{user_id}", response_model=AdminUserOut)
def update_user(
    user_id: UUID,
    payload: AdminUserUpdate,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> User:
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if target.id == admin.id and (payload.is_admin is False or payload.is_active is False):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "You can't suspend or demote your own account"
        )
    if payload.is_admin is False and target.is_admin:
        admins = db.scalar(select(func.count()).select_from(User).where(User.is_admin.is_(True)))
        if (admins or 0) <= 1:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "At least one admin is required")

    changed: list[str] = []
    if payload.is_admin is not None and payload.is_admin != target.is_admin:
        target.is_admin = payload.is_admin
        changed.append("admin" if payload.is_admin else "removed admin")
    if payload.is_active is not None and payload.is_active != target.is_active:
        target.is_active = payload.is_active
        changed.append("activated" if payload.is_active else "suspended")
    db.commit()
    db.refresh(target)
    if changed:
        log_event(
            db,
            user=admin,
            action="admin.user.update",
            entity_type="user",
            entity_id=target.id,
            summary=f"{', '.join(changed)} {target.username}",
        )
    return target


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: UUID,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> None:
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if target.id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You can't delete your own account")
    name = target.username
    # Collect every media key under the user's owned boards before the cascade
    # deletes the asset rows, then GC files no longer referenced (dedup-safe:
    # a file shared with another user's asset is kept).
    board_ids = list(db.scalars(select(Board.id).where(Board.owner_id == target.id)))
    keys: set[tuple[str, str | None]] = set()
    if board_ids:
        node_ids = list(db.scalars(select(Node.id).where(Node.board_id.in_(board_ids))))
        if node_ids:
            keys = {
                (a.storage_key, a.thumbnail_key)
                for a in db.scalars(select(Asset).where(Asset.node_id.in_(node_ids)))
            }
    db.delete(target)  # cascades the user's boards and their nodes/edges/assets
    db.commit()
    gc_orphan_files(db, keys)
    log_event(
        db, user=admin, action="admin.user.delete", entity_type="user", summary=f"deleted {name}"
    )


@router.post("/storage/gc")
def storage_gc(
    dry_run: bool = Query(default=True),
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Reclaim orphaned media: files in the storage directory that no asset
    thumbnail or avatar references anymore (e.g. leaked by deletes from before
    the cleanup landed). Defaults to a dry run that only reports; pass
    dry_run=false to actually delete. Local storage backend only."""
    if settings.storage_backend != "local":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "GC only supports local storage")
    referenced: set[str] = set()
    for col in (Asset.storage_key, Asset.thumbnail_key, User.avatar_key):
        referenced.update(k for (k,) in db.execute(select(col)).all() if k)

    root = Path(settings.storage_local_dir)
    removed = 0
    freed = 0
    sample: list[str] = []
    for p in root.iterdir():
        if not p.is_file() or p.name in referenced:
            continue
        try:
            freed += p.stat().st_size
        except OSError:
            pass
        if len(sample) < 20:
            sample.append(p.name)
        if not dry_run:
            p.unlink(missing_ok=True)
        removed += 1

    if not dry_run and removed:
        log_event(db, user=admin, action="admin.storage.gc",
                  summary=f"reclaimed {removed} orphaned file(s)")
    return {"dry_run": dry_run, "orphans": removed, "freed_bytes": freed, "sample": sample}


@router.get("/logs/events", response_model=list[ActivityLogOut])
def list_events(
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    action: str | None = None,
    user_id: UUID | None = None,
) -> list[ActivityLog]:
    q = select(ActivityLog).order_by(ActivityLog.created_at.desc())
    if action:
        q = q.where(ActivityLog.action == action)
    if user_id:
        q = q.where(ActivityLog.user_id == user_id)
    return list(db.scalars(q.limit(limit).offset(offset)))


@router.get("/logs/requests", response_model=list[RequestLogOut])
def list_requests(
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    user_id: UUID | None = None,
    status_code: int | None = None,
) -> list[RequestLog]:
    q = select(RequestLog).order_by(RequestLog.created_at.desc())
    if user_id:
        q = q.where(RequestLog.user_id == user_id)
    if status_code:
        q = q.where(RequestLog.status_code == status_code)
    return list(db.scalars(q.limit(limit).offset(offset)))


@router.get("/logs/errors", response_model=list[ErrorLogOut])
def list_errors(
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[ErrorLog]:
    q = select(ErrorLog).order_by(ErrorLog.created_at.desc())
    return list(db.scalars(q.limit(limit).offset(offset)))
