"""Asset (media) endpoints: upload, list, and delete files on a node.

Bytes go to the storage backend; only metadata is persisted in the DB. The
response includes a ready-to-use `url` resolved through the active backend.
"""
from __future__ import annotations

import io
import mimetypes
import shutil
import tempfile
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..compression import compress
from ..database import get_db
from ..models import Asset, Node
from ..schemas import AssetOut
from ..storage import storage
from ..thumbnails import generate_thumbnail

router = APIRouter(prefix="/api/nodes/{node_id}/assets", tags=["assets"])


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


def _get_node(node_id: UUID, db: Session) -> Node:
    node = db.get(Node, node_id)
    if node is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Node not found")
    return node


def _to_out(asset: Asset) -> AssetOut:
    out = AssetOut.model_validate(asset)
    out.url = storage.url_for(asset.storage_key)
    if asset.thumbnail_key:
        out.thumbnail_url = storage.url_for(asset.thumbnail_key)
    return out


@router.get("", response_model=list[AssetOut])
def list_assets(node_id: UUID, db: Session = Depends(get_db)) -> list[AssetOut]:
    _get_node(node_id, db)
    assets = db.scalars(select(Asset).where(Asset.node_id == node_id))
    return [_to_out(a) for a in assets]


@router.post("", response_model=AssetOut, status_code=status.HTTP_201_CREATED)
def upload_asset(
    node_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> AssetOut:
    _get_node(node_id, db)

    filename = file.filename or "upload.bin"
    content_type = _resolve_type(file.content_type or "", filename)

    # Stage the upload on disk so ffmpeg/Pillow can read it by path. Try to
    # recompress it; adopt the result only when it is actually smaller.
    with tempfile.TemporaryDirectory() as td:
        src_path = Path(td) / ("src" + Path(filename).suffix)
        with src_path.open("wb") as f:
            shutil.copyfileobj(file.file, f)

        store_path, store_name, store_ct = src_path, filename, content_type
        result = compress(src_path, content_type, filename)
        if result is not None:
            data, cname, cct = result
            if len(data) < src_path.stat().st_size:
                comp_path = Path(td) / cname
                comp_path.write_bytes(data)
                store_path, store_name, store_ct = comp_path, cname, cct

        kind = _kind_from_content_type(store_ct)
        with store_path.open("rb") as f:
            key = storage.save(f, store_name)

        thumbnail_key: str | None = None
        if kind in {"video", "audio"}:
            thumb = generate_thumbnail(store_path, store_ct)
            if thumb:
                thumbnail_key = storage.save(io.BytesIO(thumb), "thumb.jpg")

        asset = Asset(
            node_id=node_id,
            kind=kind,
            filename=store_name,
            content_type=store_ct,
            size=store_path.stat().st_size,
            storage_key=key,
            thumbnail_key=thumbnail_key,
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)
        return _to_out(asset)


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(
    node_id: UUID, asset_id: UUID, db: Session = Depends(get_db)
) -> None:
    asset = db.get(Asset, asset_id)
    if asset is None or asset.node_id != node_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Asset not found")
    storage.delete(asset.storage_key)
    if asset.thumbnail_key:
        storage.delete(asset.thumbnail_key)
    db.delete(asset)
    db.commit()
