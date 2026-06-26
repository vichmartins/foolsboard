"""Admin-only endpoints: manage accounts (role / suspension / deletion) and read
the activity and request logs. New accounts are created via invite codes, not
here."""
from __future__ import annotations

import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..appsettings import ORPHAN_RETENTION_DAYS, get_int, set_value
from ..audit import log_event
from ..config import settings
from ..database import get_db
from ..deps import get_current_admin
from ..storage_gc import gc_orphans
from ..sysstats import collect as collect_sysstats
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


@router.get("/stats")
def system_stats(
    _: User = Depends(get_current_admin), db: Session = Depends(get_db)
) -> dict:
    """Server vitals (CPU/memory/disk/storage/DB + app counts) for the admin
    System tab. Best-effort: fields unavailable on the host come back null."""
    return collect_sysstats(db)


@router.post("/storage/gc")
def storage_gc(
    dry_run: bool = Query(default=True),
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Reclaim orphaned media: files in the storage directory that no asset
    thumbnail or avatar references anymore (e.g. leaked by deletes from before
    the cleanup landed). Defaults to a dry run that only reports; pass
    dry_run=false to actually delete. A manual run removes ALL orphans regardless
    of age -- the age grace period only applies to the automatic startup sweep.
    Local storage backend only."""
    if settings.storage_backend != "local":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "GC only supports local storage")
    result = gc_orphans(db, dry_run=dry_run, min_age_days=0)
    if not dry_run and result["orphans"]:
        log_event(db, user=admin, action="admin.storage.gc",
                  summary=f"reclaimed {result['orphans']} orphaned file(s)")
    return result


class AdminSettings(BaseModel):
    orphan_retention_days: int


@router.get("/settings", response_model=AdminSettings)
def get_admin_settings(
    _: User = Depends(get_current_admin), db: Session = Depends(get_db)
) -> AdminSettings:
    """Admin-tunable runtime settings (falls back to env config defaults)."""
    return AdminSettings(
        orphan_retention_days=get_int(db, ORPHAN_RETENTION_DAYS, settings.orphan_retention_days)
    )


@router.patch("/settings", response_model=AdminSettings)
def update_admin_settings(
    payload: AdminSettings,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> AdminSettings:
    days = payload.orphan_retention_days
    if days < 0 or days > 3650:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Retention must be 0–3650 days (0 disables the automatic sweep)",
        )
    set_value(db, ORPHAN_RETENTION_DAYS, str(days))
    db.commit()
    log_event(db, user=admin, action="admin.settings.update",
              summary=f"orphan auto-removal grace set to {days} day(s)")
    return AdminSettings(orphan_retention_days=days)


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
    status_class: int | None = Query(None, ge=1, le=5),  # 2=2xx, 4=4xx, 5=5xx...
) -> list[RequestLog]:
    q = select(RequestLog).order_by(RequestLog.created_at.desc())
    if user_id:
        q = q.where(RequestLog.user_id == user_id)
    if status_code:
        q = q.where(RequestLog.status_code == status_code)
    if status_class:
        q = q.where(
            RequestLog.status_code >= status_class * 100,
            RequestLog.status_code < (status_class + 1) * 100,
        )
    return list(db.scalars(q.limit(limit).offset(offset)))


@router.get("/logs/errors", response_model=list[ErrorLogOut])
def list_errors(
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    user_id: UUID | None = None,
) -> list[ErrorLog]:
    q = select(ErrorLog).order_by(ErrorLog.created_at.desc())
    if user_id:
        q = q.where(ErrorLog.user_id == user_id)
    return list(db.scalars(q.limit(limit).offset(offset)))


@router.get("/logs/actions", response_model=list[str])
def list_log_actions(
    _: User = Depends(get_current_admin), db: Session = Depends(get_db)
) -> list[str]:
    """Distinct activity-log action names, for the Logs filter dropdown."""
    rows = db.execute(select(ActivityLog.action).distinct().order_by(ActivityLog.action)).all()
    return [r[0] for r in rows]


class BackupItem(BaseModel):
    name: str
    kind: str  # "database" | "media"
    size: int
    created_at: datetime


class BackupStatus(BaseModel):
    dir: str
    exists: bool
    last_run: str | None = None
    retention_days: int | None = None
    total_bytes: int = 0
    items: list[BackupItem] = []


def _read_backup_status() -> BackupStatus:
    """Read the nightly backup directory (written by foolsboard-backup.timer):
    the dump/archive files + the status.json summary. The app can read this dir
    because it's setgid root:foolsboard (see postinst)."""
    bdir = Path(settings.backup_dir)
    try:
        entries = list(bdir.iterdir())
    except OSError:
        return BackupStatus(dir=str(bdir), exists=False)

    items: list[BackupItem] = []
    total = 0
    for p in entries:
        if p.name.startswith("db-"):
            kind = "database"
        elif p.name.startswith("media-") and p.name.endswith(".tar.gz"):
            kind = "media"
        else:
            continue
        try:
            st = p.stat()
        except OSError:
            continue
        total += st.st_size
        items.append(
            BackupItem(
                name=p.name,
                kind=kind,
                size=st.st_size,
                created_at=datetime.fromtimestamp(st.st_mtime, tz=timezone.utc),
            )
        )
    items.sort(key=lambda i: i.created_at, reverse=True)

    last_run: str | None = None
    retention: int | None = None
    sp = bdir / "status.json"
    if sp.is_file():
        try:
            data = json.loads(sp.read_text())
            last_run = data.get("last_run")
            retention = data.get("retention_days")
        except (OSError, ValueError):
            pass

    return BackupStatus(
        dir=str(bdir),
        exists=True,
        last_run=last_run,
        retention_days=retention,
        total_bytes=total,
        items=items[:50],
    )


@router.get("/backups", response_model=BackupStatus)
def backup_status(_: User = Depends(get_current_admin)) -> BackupStatus:
    return _read_backup_status()


@router.post("/backups/run", response_model=BackupStatus)
def run_backup(
    admin: User = Depends(get_current_admin), db: Session = Depends(get_db)
) -> BackupStatus:
    """Run a backup on demand -- invokes the same script the nightly timer uses
    (the backup dir is group-writable so the app can run it). Sync def, so FastAPI
    runs it in a threadpool and the few-second dump doesn't block the event loop."""
    script = settings.backup_script
    if not (os.path.isfile(script) and os.access(script, os.X_OK)):
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Backups aren’t configured on this host"
        )
    try:
        proc = subprocess.run([script], capture_output=True, text=True, timeout=600)
    except (OSError, subprocess.SubprocessError) as exc:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR, f"Couldn’t start backup: {exc}"
        )
    if proc.returncode != 0:
        tail = (proc.stderr or proc.stdout or "").strip().splitlines()
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"Backup failed: {tail[-1] if tail else 'unknown error'}"[:400],
        )
    log_event(db, user=admin, action="admin.backup.run", summary="ran a manual backup")
    return _read_backup_status()
