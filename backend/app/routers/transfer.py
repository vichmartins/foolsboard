"""Export and import boards as a self-contained .zip bundle.

The bundle is built with the stdlib ``zipfile`` (no extra dependencies) and
carries ``manifest.json`` (the board graph) plus a ``media/`` folder with every
attached file -- so a board round-trips with its images/videos intact across
workspaces. Media bytes flow through the active storage backend on both ends.
"""
from __future__ import annotations

import json
import re
import tempfile
import zipfile
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import log_event
from ..database import get_db
from ..deps import get_current_user
from ..models import Asset, Board, Edge, Folder, Node, User
from ..schemas import BoardOut
from ..storage import storage

router = APIRouter(prefix="/api/boards", tags=["transfer"])

EXPORT_VERSION = 4  # v4 adds categories; v2/v3 bundles still import fine
MANIFEST_NAME = "manifest.json"
MAX_IMPORT_BYTES = 1024 * 1024 * 1024  # 1 GiB ceiling on an uploaded bundle


class ExportRequest(BaseModel):
    board_ids: list[UUID] = []
    folder_ids: list[UUID] = []  # exporting a folder includes every board inside it
    category_ids: list[str] = []  # exporting a category includes its folders + boards


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
    if not payload.board_ids and not payload.folder_ids and not payload.category_ids:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nothing selected to export")

    # Selected categories contribute their folders/boards to the export, and a
    # structural entry to the manifest. Category items are folder/board ids in the
    # user's per-user layout JSON; resolve each to a folder name or board id.
    folder_ids: list[UUID] = list(payload.folder_ids)
    board_ids: list[UUID] = list(payload.board_ids)
    category_specs: list[dict] = []  # {name, items:[{folder:name}|{board:<uuid str>}]}
    if payload.category_ids:
        try:
            layout = json.loads(user.categories) if user.categories else {}
        except (ValueError, TypeError):
            layout = {}
        for cat in layout.get("categories") or []:
            if not isinstance(cat, dict) or cat.get("id") not in payload.category_ids:
                continue
            spec_items: list[dict] = []
            for item_id in cat.get("items") or []:
                try:
                    uid = UUID(str(item_id))
                except ValueError:
                    continue
                fld = db.get(Folder, uid)
                if fld is not None and fld.owner_id == user.id:
                    folder_ids.append(uid)
                    spec_items.append({"folder": fld.name})
                    continue
                brd = db.get(Board, uid)
                if brd is not None and brd.owner_id == user.id:
                    board_ids.append(uid)
                    spec_items.append({"board": str(uid)})
            category_specs.append({"name": str(cat.get("name") or "Category"), "items": spec_items})

    # Resolve the selected folders into their boards (preserving which board
    # belongs to which folder), then append any individually-selected boards.
    # Deduped and owner-checked.
    manifest_folders: list[dict] = []
    board_folder: dict[UUID, str] = {}  # board id -> owning folder's name
    ordered_ids: list[UUID] = []
    chosen: set[UUID] = set()

    for fid in dict.fromkeys(folder_ids):
        folder = db.get(Folder, fid)
        if folder is None or folder.owner_id != user.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"Folder {fid} not found")
        manifest_folders.append({"name": folder.name})
        in_folder = db.scalars(
            select(Board)
            .where(Board.owner_id == user.id, Board.folder_id == folder.id)
            .order_by(Board.position.asc(), Board.created_at.desc())
        )
        for board in in_folder:
            if board.id not in chosen:
                chosen.add(board.id)
                ordered_ids.append(board.id)
                board_folder[board.id] = folder.name

    for bid in board_ids:
        if bid not in chosen:
            chosen.add(bid)
            ordered_ids.append(bid)

    # Gather everything from the DB up front so the streaming generator below
    # never touches the session (it only reads files + compresses).
    manifest_boards: list[dict] = []
    media: list[tuple[str, str]] = []  # (arcname, storage_key), deduped
    seen: set[str] = set()

    for bid in ordered_ids:
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
                "folder": board_folder.get(board.id),
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

    if not manifest_boards:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nothing to export")

    # Finalize category specs: a direct-board item references its board by index
    # into manifest_boards (folders stay by name). Drop items not in the export.
    board_index = {bid: i for i, bid in enumerate(ordered_ids)}
    manifest_categories: list[dict] = []
    for spec in category_specs:
        items: list[dict] = []
        for it in spec["items"]:
            if "folder" in it:
                items.append(it)
            elif "board" in it:
                try:
                    idx = board_index[UUID(it["board"])]
                except (KeyError, ValueError):
                    continue
                items.append({"board": idx})
        manifest_categories.append({"name": spec["name"], "items": items})

    manifest_json = json.dumps(
        {
            "foolsboard": "export",
            "version": EXPORT_VERSION,
            "folders": manifest_folders,
            "boards": manifest_boards,
            "categories": manifest_categories,
        },
        default=str,
        indent=2,
    )

    folder_note = f" in {len(manifest_folders)} folder(s)" if manifest_folders else ""
    log_event(
        db, user=user, action="board.export",
        summary=f"exported {len(manifest_boards)} board(s){folder_note}",
    )

    count = len(manifest_boards)
    if len(manifest_folders) == 1 and not payload.board_ids:
        fname = f"{_slug(manifest_folders[0]['name'])}.foolsboard.zip"
    elif count == 1:
        fname = f"{_slug(manifest_boards[0]['name'])}.foolsboard.zip"
    else:
        fname = f"foolsboard-{count}-boards.zip"

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
    with zf.open(arc) as src:  # streamed to storage in chunks, not read into RAM
        key = storage.save(src, fallback_name)
    key_map[arc] = key
    return key


@router.post("/import", response_model=list[BoardOut])
def import_boards(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Board]:
    # Spool the upload to a temp file rather than reading the whole bundle into
    # RAM -- a large import no longer risks an OOM. TemporaryFile is always
    # seekable (zipfile needs that) and auto-deletes on close.
    with tempfile.TemporaryFile(suffix=".zip") as spool:
        total = 0
        while chunk := file.file.read(1024 * 1024):
            total += len(chunk)
            if total > MAX_IMPORT_BYTES:
                raise HTTPException(
                    status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Bundle is too large"
                )
            spool.write(chunk)
        spool.seek(0)
        try:
            zf = zipfile.ZipFile(spool)
        except zipfile.BadZipFile:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "That file isn’t a valid .zip bundle")
        with zf:
            return _do_import(zf, db, user)


def _do_import(zf: zipfile.ZipFile, db: Session, user: User) -> list[Board]:
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

    # Recreate folders referenced by the bundle (v3+) and file boards into them.
    # Always new folders, mirroring how boards always import as new. v2 bundles
    # have no folders, so this is a no-op for them.
    folder_names: list[str] = [
        str(f["name"]) for f in (manifest.get("folders") or [])
        if isinstance(f, dict) and f.get("name")
    ]
    folder_names += [
        str(b["folder"]) for b in boards_in if isinstance(b, dict) and b.get("folder")
    ]
    folder_map: dict[str, UUID] = {}
    for name in dict.fromkeys(folder_names):  # dedupe, preserve first-seen order
        fld = Folder(owner_id=user.id, name=name[:120])
        db.add(fld)
        db.flush()  # assign folder.id
        folder_map[name] = fld.id

    for b in boards_in:
        if not isinstance(b, dict):
            continue
        board = Board(
            owner_id=user.id,
            name=(str(b.get("name") or "Imported board"))[:300],
            description=b.get("description"),
            folder_id=folder_map.get(str(b["folder"])) if b.get("folder") else None,
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

    # Recreate categories (v4+), mapping folder names / board indices to the newly
    # created ids and appending them to the importer's per-user layout.
    cats_in = manifest.get("categories")
    if isinstance(cats_in, list) and cats_in:
        try:
            layout = json.loads(user.categories) if user.categories else {}
        except (ValueError, TypeError):
            layout = {}
        if not isinstance(layout, dict):
            layout = {}
        existing = layout.get("categories")
        if not isinstance(existing, list):
            existing = []
        for c in cats_in:
            if not isinstance(c, dict):
                continue
            items: list[str] = []
            for it in c.get("items") or []:
                if not isinstance(it, dict):
                    continue
                if "folder" in it and str(it["folder"]) in folder_map:
                    items.append(str(folder_map[str(it["folder"])]))
                elif "board" in it and isinstance(it["board"], int) and 0 <= it["board"] < len(created):
                    items.append(str(created[it["board"]].id))
            existing.append(
                {"id": str(uuid4()), "name": (str(c.get("name") or "Imported"))[:120], "items": items}
            )
        layout["categories"] = existing
        if not isinstance(layout.get("top"), list):
            layout["top"] = []
        user.categories = json.dumps(layout)

    db.commit()
    for board in created:
        db.refresh(board)
    log_event(
        db, user=user, action="board.import",
        summary=f"imported {len(created)} board(s)",
    )
    return created
