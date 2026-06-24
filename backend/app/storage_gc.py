"""Orphaned-file garbage collection.

An orphan is a file in the storage directory that no asset, thumbnail, or avatar
references anymore (e.g. left behind by an edge case, or from before the
delete-time cleanup landed). Shared by the manual Admin GC (removes all orphans
on demand) and the startup auto-sweep (only removes orphans older than a grace
window). Local storage backend only.
"""
from __future__ import annotations

import time
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .models import Asset, User


def _referenced_keys(db: Session) -> set[str]:
    keys: set[str] = set()
    for col in (Asset.storage_key, Asset.thumbnail_key, User.avatar_key):
        keys.update(k for (k,) in db.execute(select(col)).all() if k)
    return keys


def gc_orphans(db: Session, *, dry_run: bool, min_age_days: int = 0) -> dict:
    """Find (and, unless dry_run, delete) orphaned storage files.

    min_age_days > 0 skips files modified within that window -- the grace period
    for the automatic sweep. Files are content-addressed and never modified in
    place, so mtime is effectively the upload time. Returns a summary dict.
    """
    if settings.storage_backend != "local":
        return {"dry_run": dry_run, "orphans": 0, "freed_bytes": 0, "sample": []}

    referenced = _referenced_keys(db)
    root = Path(settings.storage_local_dir)
    cutoff = time.time() - min_age_days * 86400 if min_age_days > 0 else None

    removed = 0
    freed = 0
    sample: list[str] = []
    for p in root.iterdir():
        if not p.is_file() or p.name in referenced:
            continue
        try:
            st = p.stat()
        except OSError:
            continue
        if cutoff is not None and st.st_mtime > cutoff:
            continue  # newer than the grace window -- leave it for now
        freed += st.st_size
        if len(sample) < 20:
            sample.append(p.name)
        if not dry_run:
            p.unlink(missing_ok=True)
        removed += 1

    return {"dry_run": dry_run, "orphans": removed, "freed_bytes": freed, "sample": sample}
