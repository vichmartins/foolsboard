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

from .config import settings
from .routers import assets, boards, edges, nodes

app = FastAPI(title="foolsboard API", version="0.1.0")

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


@app.get("/api/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok", "database": settings.database_url.split("://", 1)[0]}
