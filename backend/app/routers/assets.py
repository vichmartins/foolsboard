"""Asset (media) endpoints: upload, list, and delete files on a node.

Bytes go to the storage backend; only metadata is persisted in the DB. The
response includes a ready-to-use `url` resolved through the active backend.
"""
from __future__ import annotations

import hashlib
import io
import mimetypes
import shutil
import tempfile
import threading
from pathlib import Path
from uuid import UUID

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import log_event
from ..compression import compress
from ..config import settings
from ..database import SessionLocal, get_db
from ..deps import get_current_user, get_owned_node
from ..models import Asset, Board, Node, User
from ..schemas import AssetOut
from ..storage import storage
from ..thumbnails import generate_thumbnail

router = APIRouter(prefix="/api/nodes/{node_id}/assets", tags=["assets"])

# Cap concurrent background re-encodes so a burst of video/audio uploads doesn't
# thrash CPU/GPU (each ffmpeg/NVENC pass is heavy). Others wait their turn.
_ENCODE_SEM = threading.Semaphore(2)


class AssetReferenceIn(BaseModel):
    asset_ids: list[UUID]


def _resolve_type(content_type: str, filename: str) -> str:
    """Best-effort MIME type: fall back to the extension when the upload's type
    is missing or generic, so media files still classify (and get thumbnails)."""
    ct = (content_type or "").strip()
    if not ct or ct == "application/octet-stream":
        guessed, _ = mimetypes.guess_type(filename)
        if guessed:
            return guessed
    return ct or "application/octet-stream"


def _kind_from_content_type(content_type: str) -> str:
    """Coarse classification used by the UI to pick a renderer."""
    main = (content_type or "").split("/", 1)[0]
    if main in {"image", "video", "audio"}:
        return main
    if content_type in {
        "application/zip",
        "application/x-7z-compressed",
        "application/x-rar-compressed",
        "application/x-tar",
        "application/gzip",
    }:
        return "archive"
    return "file"


def _to_out(asset: Asset) -> AssetOut:
    out = AssetOut.model_validate(asset)
    out.url = storage.url_for(asset.storage_key)
    if asset.thumbnail_key:
        out.thumbnail_url = storage.url_for(asset.thumbnail_key)
    return out


@router.get("", response_model=list[AssetOut])
def list_assets(
    node: Node = Depends(get_owned_node), db: Session = Depends(get_db)
) -> list[AssetOut]:
    assets = db.scalars(select(Asset).where(Asset.node_id == node.id))
    return [_to_out(a) for a in assets]


def _local_path(key: str) -> Path:
    """Filesystem path of a stored object (local storage backend)."""
    return Path(settings.storage_local_dir) / key


def _hash_file(path: Path) -> str:
    """SHA-256 of a file, streamed so large videos don't load fully in memory."""
    h = hashlib.sha256()
    with path.open("rb") as f:
        while chunk := f.read(1024 * 1024):
            h.update(chunk)
    return h.hexdigest()


def _process_compression(asset_id: UUID) -> None:
    """Background pass: recompress an asset's stored file and swap it in when
    smaller. Runs in its own DB session after the upload response was sent."""
    db = SessionLocal()
    try:
        asset = db.get(Asset, asset_id)
        if asset is None:
            return
        src = _local_path(asset.storage_key)
        try:
            if src.exists():
                # Hold a slot only for the heavy encode itself.
                with _ENCODE_SEM:
                    result = compress(src, asset.content_type, asset.filename)
            else:
                result = None
        except Exception:
            result = None
        if result is not None:
            data, cname, cct = result
            if src.exists() and len(data) < src.stat().st_size:
                old_key = asset.storage_key
                asset.storage_key = storage.save(io.BytesIO(data), cname)
                asset.filename = cname
                asset.content_type = cct
                asset.kind = _kind_from_content_type(cct)
                asset.size = len(data)
                storage.delete(old_key)
        asset.processing = False
        db.commit()
    finally:
        db.close()


@router.post("", response_model=AssetOut, status_code=status.HTTP_201_CREATED)
def upload_asset(
    background_tasks: BackgroundTasks,
    node: Node = Depends(get_owned_node),
    user: User = Depends(get_current_user),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> AssetOut:
    node_id = node.id

    filename = file.filename or "upload.bin"
    content_type = _resolve_type(file.content_type or "", filename)
    kind = _kind_from_content_type(content_type)

    # Stage the upload so ffmpeg/Pillow can read it by path.
    with tempfile.TemporaryDirectory() as td:
        src_path = Path(td) / ("src" + Path(filename).suffix)
        with src_path.open("wb") as f:
            shutil.copyfileobj(file.file, f)

        # Deduplicate: if this exact content was already uploaded and processed,
        # point the new node's asset at the same stored file (instant, no
        # re-compression). Only match finished assets so we never reference a
        # storage_key that a background pass is still about to swap.
        content_hash = _hash_file(src_path)
        existing = db.scalars(
            select(Asset)
            .where(Asset.content_hash == content_hash, Asset.processing.is_(False))
            .order_by(Asset.created_at)
        ).first()
        if existing is not None:
            asset = Asset(
                node_id=node_id,
                kind=existing.kind,
                filename=existing.filename,
                content_type=existing.content_type,
                size=existing.size,
                storage_key=existing.storage_key,
                thumbnail_key=existing.thumbnail_key,
                processing=False,
                content_hash=content_hash,
            )
            db.add(asset)
            db.commit()
            db.refresh(asset)
            log_event(db, user=user, action="media.upload", entity_type="media",
                      entity_id=asset.id, summary=f"uploaded “{filename}”")
            return _to_out(asset)

        store_path, store_name, store_ct, store_kind = src_path, filename, content_type, kind
        processing = False

        if kind == "image":
            # Images compress quickly -> do it inline.
            result = compress(src_path, content_type, filename)
            if result is not None:
                data, cname, cct = result
                if len(data) < src_path.stat().st_size:
                    comp_path = Path(td) / cname
                    comp_path.write_bytes(data)
                    store_path, store_name, store_ct = comp_path, cname, cct
                    store_kind = _kind_from_content_type(cct)
        elif kind in {"video", "audio"}:
            # Slow to encode -> store the original now, optimize in the background.
            processing = True

        with store_path.open("rb") as f:
            key = storage.save(f, store_name)

        # Thumbnail synchronously (a single frame / cover art -- fast).
        thumbnail_key: str | None = None
        if store_kind in {"video", "audio"}:
            thumb = generate_thumbnail(store_path, store_ct)
            if thumb:
                thumbnail_key = storage.save(io.BytesIO(thumb), "thumb.jpg")

        asset = Asset(
            node_id=node_id,
            kind=store_kind,
            filename=store_name,
            content_type=store_ct,
            size=store_path.stat().st_size,
            storage_key=key,
            thumbnail_key=thumbnail_key,
            processing=processing,
            content_hash=content_hash,
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)
        asset_id = asset.id
        out = _to_out(asset)

    log_event(db, user=user, action="media.upload", entity_type="media", entity_id=asset_id,
              summary=f"uploaded “{store_name}”")
    if processing:
        background_tasks.add_task(_process_compression, asset_id)
    return out


@router.post("/reference", response_model=list[AssetOut], status_code=status.HTTP_201_CREATED)
def reference_assets(
    payload: AssetReferenceIn,
    node: Node = Depends(get_owned_node),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AssetOut]:
    """Attach existing media (from other nodes) to this node by sharing their
    stored files -- the dedup mechanism, keyed by asset id instead of an upload.
    Lets the UI pull a nearby node's media into the node being edited instantly."""
    created: list[Asset] = []
    for source_id in payload.asset_ids:
        src = db.get(Asset, source_id)
        if src is None:
            continue
        # Only reference media the caller owns (the source node's board owner).
        src_node = db.get(Node, src.node_id)
        if src_node is None:
            continue
        src_board = db.get(Board, src_node.board_id)
        if src_board is None or src_board.owner_id != user.id:
            continue
        created.append(
            Asset(
                node_id=node.id,
                kind=src.kind,
                filename=src.filename,
                content_type=src.content_type,
                size=src.size,
                storage_key=src.storage_key,
                thumbnail_key=src.thumbnail_key,
                processing=False,
                content_hash=src.content_hash,
            )
        )
    for asset in created:
        db.add(asset)
    db.commit()
    for asset in created:
        db.refresh(asset)
    if created:
        log_event(db, user=user, action="media.reference", entity_type="media",
                  summary=f"referenced {len(created)} media item(s)")
    return [_to_out(asset) for asset in created]


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(
    asset_id: UUID,
    node: Node = Depends(get_owned_node),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    asset = db.get(Asset, asset_id)
    if asset is None or asset.node_id != node.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Asset not found")
    key, thumb, name = asset.storage_key, asset.thumbnail_key, asset.filename
    db.delete(asset)
    db.commit()
    # Files may be shared with other nodes via dedup -- only remove the last ref.
    if db.scalars(select(Asset.id).where(Asset.storage_key == key)).first() is None:
        storage.delete(key)
    if thumb and db.scalars(select(Asset.id).where(Asset.thumbnail_key == thumb)).first() is None:
        storage.delete(thumb)
    log_event(db, user=user, action="media.delete", entity_type="media", entity_id=asset_id,
              summary=f"removed “{name}”")
