"""Asset (media) endpoints: upload, list, and delete files on a node.

Bytes go to the storage backend; only metadata is persisted in the DB. The
response includes a ready-to-use `url` resolved through the active backend.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Asset, Node
from ..schemas import AssetOut
from ..storage import storage

router = APIRouter(prefix="/api/nodes/{node_id}/assets", tags=["assets"])


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

    key = storage.save(file.file, file.filename or "upload.bin")
    content_type = file.content_type or "application/octet-stream"
    asset = Asset(
        node_id=node_id,
        kind=_kind_from_content_type(content_type),
        filename=file.filename or "upload.bin",
        content_type=content_type,
        size=file.size or 0,
        storage_key=key,
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
    db.delete(asset)
    db.commit()
