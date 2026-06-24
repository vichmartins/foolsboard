"""FastAPI application entrypoint.

Wires CORS, the static media mount (local storage), and all routers. Schema
creation is handled by Alembic migrations, not here -- run `alembic upgrade
head` before first use.
"""
from __future__ import annotations

import time
import traceback
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, update
from starlette.concurrency import run_in_threadpool

from .config import settings
from .database import SessionLocal
from .models import Asset, ErrorLog, RequestLog, User
from .realtime import PALETTE, color_for
from .routers import (
    admin,
    assets,
    auth,
    boards,
    edges,
    folders,
    invites,
    links,
    nodes,
    shares,
    transfer,
    ws,
)
from .security import decode_token

app = FastAPI(title="foolsboard API", version="0.4.0")

# Content-Security-Policy. Now enforced (was Report-Only through v0.73.0, which
# confirmed no legitimate resource was wrongly blocked on a real deploy). script-src
# stays 'self' (the SPA loads only same-origin bundles -- no inline scripts);
# style-src allows inline styles (React/React Flow set them); img-src allows
# external link-preview thumbnails; connect-src 'self' covers the API + the
# same-origin WebSocket.
_CSP = (
    "default-src 'self'; "
    "img-src 'self' data: blob: https:; "
    "media-src 'self' blob:; "
    "script-src 'self'; "
    "style-src 'self' 'unsafe-inline'; "
    "font-src 'self' data:; "
    "connect-src 'self'; "
    "object-src 'none'; "
    "base-uri 'self'; "
    "form-action 'self'; "
    "frame-ancestors 'none'"
)

# Uploaded files whose content type a browser would execute as a top-level
# document (stored XSS via an SVG/HTML upload). We force these to download; they
# still render normally when loaded as an <img>/<video> subresource.
_RISKY_MEDIA_TYPES = {
    "image/svg+xml",
    "text/html",
    "application/xhtml+xml",
    "text/xml",
    "application/xml",
}


@app.middleware("http")
async def _security_headers(request: Request, call_next):
    response = await call_next(request)
    h = response.headers
    h.setdefault("X-Content-Type-Options", "nosniff")
    h.setdefault("X-Frame-Options", "DENY")
    h.setdefault("Referrer-Policy", "no-referrer")
    h.setdefault("Content-Security-Policy", _CSP)
    if request.url.path.startswith(settings.storage_public_url):
        ct = h.get("content-type", "").split(";", 1)[0].strip().lower()
        if ct in _RISKY_MEDIA_TYPES:
            h["Content-Disposition"] = "attachment"
        # Stored keys are content-addressed and never mutated in place (a
        # recompress writes a brand-new key), so media bytes are immutable.
        # Let the browser cache them hard and skip per-load revalidation.
        if response.status_code < 400:
            h.setdefault("Cache-Control", "public, max-age=31536000, immutable")
    return response


def _write_request_log(
    method: str,
    path: str,
    status_code: int,
    duration_ms: int,
    user_id,
    ip: str | None,
    error: tuple[str, str] | None = None,
) -> None:
    db = SessionLocal()
    try:
        db.add(
            RequestLog(
                method=method, path=path[:500], status_code=status_code,
                duration_ms=duration_ms, user_id=user_id, ip=ip,
            )
        )
        if error is not None:
            message, tb = error
            db.add(
                ErrorLog(
                    method=method, path=path[:500], user_id=user_id,
                    message=message[:500], traceback=tb,
                )
            )
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


@app.middleware("http")
async def _log_requests(request: Request, call_next):
    """Record every API request, and capture unhandled exceptions (with their
    stack trace) before re-raising. Skips the log-viewing endpoints themselves."""
    start = time.monotonic()
    path = request.url.path
    logged = path.startswith("/api") and not path.startswith("/api/admin/logs")
    header = request.headers.get("Authorization", "")
    user_id = decode_token(header[7:]) if header.startswith("Bearer ") else None
    ip = request.client.host if request.client else None
    try:
        response = await call_next(request)
    except Exception as exc:
        if logged:
            await run_in_threadpool(
                _write_request_log, request.method, path, 500,
                int((time.monotonic() - start) * 1000), user_id, ip,
                (f"{type(exc).__name__}: {exc}", traceback.format_exc()),
            )
        raise
    if logged:
        await run_in_threadpool(
            _write_request_log, request.method, path, response.status_code,
            int((time.monotonic() - start) * 1000), user_id, ip,
        )
    return response


@app.on_event("startup")
def _clear_stuck_processing() -> None:
    """A restart kills any in-flight background compression; clear the flag so
    those assets don't show "optimizing" forever (they keep their originals)."""
    db = SessionLocal()
    try:
        db.execute(update(Asset).where(Asset.processing.is_(True)).values(processing=False))
        db.commit()
    finally:
        db.close()


@app.on_event("startup")
def _backfill_content_hashes() -> None:
    """Assets created before content-hash dedup have no hash, so re-uploading the
    same media can't dedup against them. Hash each one's stored file once so it
    becomes dedup-capable. Best-effort: it matches a fresh upload when the stored
    bytes equal the original (uncompressed media, or video whose recompression
    was skipped)."""
    if settings.storage_backend != "local":
        return
    db = SessionLocal()
    try:
        pending = db.scalars(select(Asset).where(Asset.content_hash.is_(None))).all()
        changed = False
        for asset in pending:
            path = assets._local_path(asset.storage_key)
            if not path.exists():
                continue
            try:
                asset.content_hash = assets._hash_file(path)
                changed = True
            except OSError:
                continue
        if changed:
            db.commit()
    finally:
        db.close()


@app.on_event("startup")
def _backfill_user_colors() -> None:
    """Give users created before the color feature a distinct collaborator color
    (so highlights/cursors differ), preferring palette colors not already taken."""
    db = SessionLocal()
    try:
        users = db.scalars(select(User).order_by(User.created_at)).all()
        taken = {u.color for u in users if u.color}
        changed = False
        for u in users:
            if u.color:
                continue
            free = [c for c in PALETTE if c not in taken]
            u.color = free[0] if free else color_for(u.id)
            taken.add(u.color)
            changed = True
        if changed:
            db.commit()
    finally:
        db.close()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve locally-stored media. (A cloud backend would serve its own URLs.)
if settings.storage_backend == "local":
    media_root = Path(settings.storage_local_dir)
    media_root.mkdir(parents=True, exist_ok=True)
    app.mount(
        settings.storage_public_url,
        StaticFiles(directory=media_root),
        name="media",
    )

app.include_router(auth.router)
app.include_router(invites.router)
app.include_router(admin.router)
app.include_router(folders.router)
app.include_router(shares.router)
app.include_router(ws.router)
app.include_router(boards.router)
app.include_router(transfer.router)
app.include_router(nodes.router)
app.include_router(edges.router)
app.include_router(assets.router)
app.include_router(links.router)


@app.get("/api/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok", "database": settings.database_url.split("://", 1)[0]}


# --- Serve the built frontend (production single-port deployment) -----------
# When STATIC_DIR points at the built SPA, uvicorn serves the app, its hashed
# assets, and the API/WebSocket from one origin/port -- no separate web server.
# Registered last so every /api and /media route is matched first.
if settings.static_dir and Path(settings.static_dir).is_dir():
    _dist = Path(settings.static_dir)
    if (_dist / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=_dist / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa(full_path: str):
        # Unknown API paths should still 404 as JSON, not fall back to the SPA.
        if full_path.startswith(("api/", "media/")):
            raise HTTPException(status_code=404)
        candidate = _dist / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_dist / "index.html")  # client-side routing fallback
