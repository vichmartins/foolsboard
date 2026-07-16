"""One-off (re-runnable) pass: re-transcode stored media that isn't
browser-playable in its current container.

Older uploads that predate the container-aware skip logic can sit in the store
as an H.264 `.mkv` or an AAC `.m4a` -- codecs a browser might support, but in a
container it can't play. This walks every audio/video asset, and for any that
isn't web-playable as-is, transcodes it to a web format (MP4 H.264 / Ogg-Opus)
and swaps it in -- regardless of size, since the goal is playability, not bytes.
Already-playable files (mp4/webm/mp3/ogg/wav) are left untouched.

The canvas resolves a media node's URL from the live asset, so nodes self-heal
on their next load; no node edits are needed here. Assumes local storage.

Run from backend/ with the app virtualenv:
    python -m scripts.retranscode_unplayable --dry-run   # preview only
    python -m scripts.retranscode_unplayable             # apply
"""
from __future__ import annotations

import sys
from pathlib import Path

from sqlalchemy import select

from app.compression import _is_web_audio, _is_web_video, _probe, compress
from app.config import settings
from app.database import SessionLocal
from app.models import Asset
from app.routers.assets import _kind_from_content_type
from app.storage import storage


def _local_path(key: str) -> Path:
    return Path(settings.storage_local_dir) / key


def _needs_retranscode(src: Path, kind: str) -> bool:
    info = _probe(src)
    if not info:
        return False  # unprobeable -> leave it alone rather than risk a bad convert
    if kind == "video":
        return not _is_web_video(info)
    if kind == "audio":
        return not _is_web_audio(info)
    return False


def main() -> None:
    dry = "--dry-run" in sys.argv[1:]
    db = SessionLocal()
    done = 0
    failed = 0
    try:
        assets = list(db.scalars(select(Asset).where(Asset.kind.in_(["video", "audio"]))))
        print(f"Scanning {len(assets)} audio/video asset(s){' (dry run)' if dry else ''}...")
        for a in assets:
            src = _local_path(a.storage_key)
            if not src.exists():
                print(f"  ! {a.filename}: stored file missing, skipping")
                continue
            if not _needs_retranscode(src, a.kind):
                continue
            print(f"  * {a.filename} ({a.content_type}) not web-playable", end="")
            if dry:
                print(" -> would re-transcode")
                done += 1
                continue
            result = compress(src, a.content_type, a.filename)
            if result is None:
                print(" -> re-transcode FAILED, left as-is")
                failed += 1
                continue
            out_path, cname, cct = result
            try:
                old_key = a.storage_key
                with out_path.open("rb") as f:  # streamed to storage
                    a.storage_key = storage.save(f, cname)
                a.filename = cname
                a.content_type = cct
                a.kind = _kind_from_content_type(cct)
                a.size = out_path.stat().st_size
                db.flush()  # so this asset no longer counts as a referrer of old_key
                still_used = db.scalars(
                    select(Asset.id).where(Asset.storage_key == old_key)
                ).first()
                if still_used is None:
                    storage.delete(old_key)
                db.commit()
                done += 1
                print(f" -> {cname}")
            finally:
                out_path.unlink(missing_ok=True)
        verb = "would convert" if dry else "converted"
        tail = f" ({failed} failed)" if failed else ""
        print(f"\nDone. {verb} {done} file(s){tail}.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
