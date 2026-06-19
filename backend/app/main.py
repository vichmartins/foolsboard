"""FastAPI application entrypoint.

Wires CORS, the static media mount (local storage), and all routers. Schema
creation is handled by Alembic migrations, not here -- run `alembic upgrade
head` before first use.
"""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import update

from .config import settings
from .database import SessionLocal
from .models import Asset
from .routers import assets, boards, edges, links, nodes

app = FastAPI(title="foolsboard API", version="0.4.0")


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

app.include_router(boards.router)
app.include_router(nodes.router)
app.include_router(edges.router)
app.include_router(assets.router)
app.include_router(links.router)


@app.get("/api/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok", "database": settings.database_url.split("://", 1)[0]}
