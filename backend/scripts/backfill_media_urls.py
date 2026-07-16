"""One-off (re-runnable) cleanup: rewrite media nodes' cached url/filename to
match their live asset.

A media node caches its asset's url/filename/kind in ``node.content`` at upload
time, but audio/video are re-encoded in the background (e.g. an .m4a becomes an
.ogg and the original file is deleted). The canvas already resolves the live
asset at render time, so this is cosmetic -- it just makes the stored content
consistent and avoids a brief flicker (the stale/deleted url is shown for an
instant before the live asset loads). Only touches nodes whose cached values
actually differ from the asset. Assumes the local storage backend.

Run from backend/ with the app virtualenv:
    python -m scripts.backfill_media_urls --dry-run   # preview only
    python -m scripts.backfill_media_urls             # apply
"""
from __future__ import annotations

import sys
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Asset, Node
from app.storage import storage


def _media_kind(content_type: str) -> str:
    """The frontend's coarse media kind (image/video/audio/file) for content.mediaKind."""
    main = (content_type or "").split("/", 1)[0]
    return main if main in {"image", "video", "audio"} else "file"


def backfill(db: Session, dry_run: bool = True) -> list[tuple[str, str]]:
    """Rewrite each media node's cached url/filename/kind to its live asset.
    Returns (node_id, filename) pairs that were (or would be) updated."""
    changed: list[tuple[str, str]] = []
    for node in db.scalars(select(Node)):
        content = node.content or {}
        asset_id = content.get("assetId")
        if not isinstance(asset_id, str):
            continue
        try:
            asset = db.get(Asset, UUID(asset_id))
        except ValueError:
            continue  # malformed id in content
        if asset is None:
            continue
        fresh = {
            "url": storage.url_for(asset.storage_key),
            "filename": asset.filename,
            "contentType": asset.content_type,
            "thumbnailUrl": storage.url_for(asset.thumbnail_key) if asset.thumbnail_key else None,
            "mediaKind": _media_kind(asset.content_type),
        }
        if all(content.get(k) == v for k, v in fresh.items()):
            continue  # already consistent
        changed.append((str(node.id), asset.filename))
        if not dry_run:
            node.content = {**content, **fresh}
            db.commit()
    return changed


def main() -> None:
    dry = "--dry-run" in sys.argv[1:]
    db = SessionLocal()
    try:
        changed = backfill(db, dry_run=dry)
        for _, fn in changed:
            print(f"  ~ {fn}")
        verb = "would update" if dry else "updated"
        print(f"Done. {verb} {len(changed)} media node(s){' (dry run)' if dry else ''}.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
