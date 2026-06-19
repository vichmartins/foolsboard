"""Export and import boards as a self-contained .zip bundle.

The bundle is built with the stdlib ``zipfile`` (no extra dependencies) and
carries ``manifest.json`` (the board graph) plus a ``media/`` folder with every
attached file -- so a board round-trips with its images/videos intact across
workspaces. Media bytes flow through the active storage backend on both ends.
"""
from __future__ import annotations

import io
import json
import re
import zipfile
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import log_event
from ..database import get_db
from ..deps import get_current_user
from ..models import Asset, Board, Edge, Node, User
from ..schemas import BoardOut
from ..storage import storage

router = APIRouter(prefix="/api/boards", tags=["transfer"])

EXPORT_VERSION = 2
MANIFEST_NAME = "manifest.json"
MAX_IMPORT_BYTES = 1024 * 1024 * 1024  # 1 GiB ceiling on an uploaded bundle


class ExportRequest(BaseModel):
    board_ids: list[UUID]


def _slug(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")
    return s or "board"


class _StreamBuffer:
    """A write-only sink that ``zipfile`` writes into, drained chunk-by-chunk so
    the archive can be streamed to the client as it's produced (rather than held
    fully in memory and sent at the end). Reports no ``seek``/``tell`` -- zipfile
    detects the non-seekable stream and emits data descriptors accordingly."""

    def __init__(self) -> None:
        self._parts: list[bytes] = []

    def write(self, data: bytes) -> int:
        self._parts.append(bytes(data))
        return len(data)

    def flush(self) -> None:  # called by zipfile on close
        pass

    def drain(self) -> bytes:
        if not self._parts:
            return b""
        out = b"".join(self._parts)
        self._parts.clear()
        return out


@router.post("/export")
def export_boards(
    payload: ExportRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StreamingResponse:
    if not payload.board_ids:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No boards selected")

    # Gather everything from the DB up front so the streaming generator below
    # never touches the session (it only reads files + compresses).
    manifest_boards: list[dict] = []
    media: list[tuple[str, str]] = []  # (arcname, storage_key), deduped
    seen: set[str] = set()

    for bid in payload.board_ids:
        board = db.get(Board, bid)
        if board is None or board.owner_id != user.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"Board {bid} not found")

        nodes = list(db.scalars(select(Node).where(Node.board_id == board.id)))
        edges = list(db.scalars(select(Edge).where(Edge.board_id == board.id)))
        node_ids = [n.id for n in nodes]
        assets = (
            list(db.scalars(select(Asset).where(Asset.node_id.in_(node_ids))))
            if node_ids
            else []
        )

        assets_by_node: dict[str, list[dict]] = {}
        for a in assets:
            for key in filter(None, (a.storage_key, a.thumbnail_key)):
                arc = f"media/{key}"
                if arc not in seen:
                    seen.add(arc)
                    media.append((arc, key))
            assets_by_node.setdefault(str(a.node_id), []).append(
                {
                    "kind": a.kind,
                    "filename": a.filename,
                    "content_type": a.content_type,
                    "size": a.size,
                    "content_hash": a.content_hash,
                    "file": f"media/{a.storage_key}",
                    "thumb": f"media/{a.thumbnail_key}" if a.thumbnail_key else None,
                }
            )

        manifest_boards.append(
            {
                "name": board.name,
                "description": board.description,
                "nodes": [
                    {
                        "id": str(n.id),
                        "type": n.type,
                        "title": n.title,
                        "content": n.content,
                        "x": n.x,
                        "y": n.y,
                        "width": n.width,
                        "height": n.height,
                        "color": n.color,
                        "assets": assets_by_node.get(str(n.id), []),
                    }
                    for n in nodes
                ],
                "edges": [
                    {
                        "source_id": str(e.source_id),
                        "target_id": str(e.target_id),
                        "label": e.label,
                        "data": e.data,
                    }
                    for e in edges
                ],
            }
        )

    manifest_json = json.dumps(
        {"foolsboard": "export", "version": EXPORT_VERSION, "boards": manifest_boards},
        default=str,
        indent=2,
    )

    log_event(
        db, user=user, action="board.export",
        summary=f"exported {len(manifest_boards)} board(s)",
    )

    count = len(manifest_boards)
    fname = (
        f"{_slug(manifest_boards[0]['name'])}.foolsboard.zip"
        if count == 1
        else f"foolsboard-{count}-boards.zip"
    )

    def generate():
        buf = _StreamBuffer()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr(MANIFEST_NAME, manifest_json)
            if chunk := buf.drain():
                yield chunk
            for arc, key in media:
                try:
                    with storage.open(key) as fh:
                        data = fh.read()
                except FileNotFoundError:
                    continue  # bytes gone; manifest still references the entry
                # Media is already compressed -- store it as-is, no re-deflate.
                zf.writestr(arc, data, zipfile.ZIP_STORED)
                if chunk := buf.drain():
                    yield chunk
        if chunk := buf.drain():
            yield chunk  # central directory / end record

    return StreamingResponse(
        generate(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


def _restore_file(
    zf: zipfile.ZipFile,
    names: set[str],
    arc: str | None,
    fallback_name: str,
    key_map: dict[str, str],
) -> str | None:
    """Write a bundled file into storage, returning its new key (or None)."""
    if not arc or arc not in names:
        return None
    if arc in key_map:  # shared file already restored this import
        return key_map[arc]
    data = zf.read(arc)
    key = storage.save(io.BytesIO(data), fallback_name)
    key_map[arc] = key
    return key


@router.post("/import", response_model=list[BoardOut])
def import_boards(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Board]:
    raw = file.file.read(MAX_IMPORT_BYTES + 1)
    if len(raw) > MAX_IMPORT_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Bundle is too large")
    try:
        zf = zipfile.ZipFile(io.BytesIO(raw))
    except zipfile.BadZipFile:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That file isn’t a valid .zip bundle")

    try:
        manifest = json.loads(zf.read(MANIFEST_NAME))
    except KeyError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bundle is missing manifest.json")
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bundle manifest is corrupt")

    boards_in = manifest.get("boards")
    if not isinstance(boards_in, list) or not boards_in:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bundle contains no boards")

    names = set(zf.namelist())
    key_map: dict[str, str] = {}
    created: list[Board] = []

    for b in boards_in:
        if not isinstance(b, dict):
            continue
        board = Board(
            owner_id=user.id,
            name=(str(b.get("name") or "Imported board"))[:300],
            description=b.get("description"),
        )
        db.add(board)
        db.flush()  # assign board.id

        id_map: dict[str, UUID] = {}
        for n in b.get("nodes") or []:
            content = n.get("content")
            node = Node(
                board_id=board.id,
                type=(str(n.get("type") or "note"))[:50],
                title=(str(n.get("title") or ""))[:300],
                content=content if isinstance(content, dict) else {},
                x=float(n.get("x") or 0),
                y=float(n.get("y") or 0),
                width=n.get("width"),
                height=n.get("height"),
                color=n.get("color"),
            )
            db.add(node)
            db.flush()  # assign node.id
            if n.get("id"):
                id_map[str(n["id"])] = node.id

            for a in n.get("assets") or []:
                if not isinstance(a, dict):
                    continue
                key = _restore_file(zf, names, a.get("file"), a.get("filename") or "file", key_map)
                if key is None:
                    continue  # bytes weren't in the bundle; skip this asset
                thumb = (
                    _restore_file(zf, names, a.get("thumb"), "thumb.jpg", key_map)
                    if a.get("thumb")
                    else None
                )
                db.add(
                    Asset(
                        node_id=node.id,
                        kind=(str(a.get("kind") or "file"))[:30],
                        filename=(str(a.get("filename") or "file"))[:500],
                        content_type=(str(a.get("content_type") or "application/octet-stream"))[:150],
                        size=int(a.get("size") or 0),
                        storage_key=key,
                        thumbnail_key=thumb,
                        content_hash=a.get("content_hash"),
                    )
                )

        for e in b.get("edges") or []:
            if not isinstance(e, dict):
                continue
            s = id_map.get(str(e.get("source_id")))
            t = id_map.get(str(e.get("target_id")))
            if not s or not t:
                continue
            data = e.get("data")
            db.add(
                Edge(
                    board_id=board.id,
                    source_id=s,
                    target_id=t,
                    label=e.get("label"),
                    data=data if isinstance(data, dict) else {},
                )
            )

        created.append(board)

    if not created:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No importable boards in the bundle")

    db.commit()
    for board in created:
        db.refresh(board)
    log_event(
        db, user=user, action="board.import",
        summary=f"imported {len(created)} board(s)",
    )
    return created
