"""One-off (re-runnable) backfill: recompress already-stored assets in place.

Walks every Asset, runs the same compression + thumbnail pipeline used on
upload, and -- only when the result is smaller -- replaces the stored file and
updates the DB row, deleting the original. Also fills in missing thumbnails for
audio/video. Assumes the local storage backend.

Run from the backend directory:
    .venv\\Scripts\\python.exe -m scripts.recompress_existing
"""
from __future__ import annotations

import io
from pathlib import Path

from sqlalchemy import select

from app.compression import compress
from app.config import settings
from app.database import SessionLocal
from app.models import Asset
from app.routers.assets import _kind_from_content_type
from app.storage import storage
from app.thumbnails import generate_thumbnail

# NOTE: compress() returns a temp-file *path* (not bytes) -- stream it to storage.


def _local_path(key: str) -> Path:
    return Path(settings.storage_local_dir) / key


def main() -> None:
    db = SessionLocal()
    before_total = 0
    after_total = 0
    changed = 0
    thumbed = 0
    try:
        assets = list(db.scalars(select(Asset)))
        print(f"Scanning {len(assets)} asset(s)...")
        for a in assets:
            src = _local_path(a.storage_key)
            if not src.exists():
                print(f"  ! {a.filename}: stored file missing, skipping")
                continue

            orig_size = src.stat().st_size
            before_total += orig_size
            new_size = orig_size

            result = compress(src, a.content_type, a.filename)
            if result is not None:
                out_path, cname, cct = result
                try:
                    result_size = out_path.stat().st_size
                    if result_size < orig_size:
                        old_key = a.storage_key
                        with out_path.open("rb") as f:  # streamed to storage
                            a.storage_key = storage.save(f, cname)
                        a.filename = cname
                        a.content_type = cct
                        a.kind = _kind_from_content_type(cct)
                        a.size = result_size
                        db.flush()  # so this asset no longer counts as a referrer of old_key
                        # Dedup-safe: only drop the old file if nothing else uses it.
                        if db.scalars(
                            select(Asset.id).where(Asset.storage_key == old_key)
                        ).first() is None:
                            storage.delete(old_key)
                        new_size = result_size
                        changed += 1
                        pct = round(100 * (1 - new_size / orig_size))
                        print(f"  ~ {cname}: {orig_size:,} -> {new_size:,} bytes (-{pct}%)")
                finally:
                    out_path.unlink(missing_ok=True)

            # Backfill a thumbnail for audio/video that lacks one.
            if a.kind in {"video", "audio"} and not a.thumbnail_key:
                thumb = generate_thumbnail(_local_path(a.storage_key), a.content_type)
                if thumb:
                    a.thumbnail_key = storage.save(io.BytesIO(thumb), "thumb.jpg")
                    thumbed += 1
                    print(f"    + thumbnail for {a.filename}")

            after_total += new_size
            db.commit()

        saved = before_total - after_total
        print(
            f"\nDone. Recompressed {changed} file(s), added {thumbed} thumbnail(s).\n"
            f"Total: {before_total:,} -> {after_total:,} bytes "
            f"(saved {saved:,} bytes)"
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
