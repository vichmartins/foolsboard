"""Pytest harness for the foolsboard API.

Points the app at an isolated temp SQLite database + temp media storage BEFORE
importing it (env vars override backend/.env), creates a fresh schema per test,
and exposes a TestClient plus a few helpers.
"""
from __future__ import annotations

import os
import pathlib
import tempfile
import uuid

# --- Isolate the environment before the app (and its settings) are imported ---
_TMP = pathlib.Path(tempfile.mkdtemp(prefix="foolsboard-tests-"))
(_TMP / "storage").mkdir(parents=True, exist_ok=True)
os.environ["DATABASE_URL"] = f"sqlite:///{(_TMP / 'test.db').as_posix()}"
os.environ["STORAGE_BACKEND"] = "local"
os.environ["STORAGE_LOCAL_DIR"] = str(_TMP / "storage")
os.environ["JWT_SECRET"] = "test-secret"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Asset  # noqa: E402


@pytest.fixture(autouse=True)
def _fresh_db():
    """Each test runs against a clean schema."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client() -> TestClient:
    # Plain TestClient (not a context manager) so the app's startup backfills/GC
    # don't run during tests.
    return TestClient(app)


@pytest.fixture
def db():
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


# --- helpers ---------------------------------------------------------------
def register(client: TestClient, username: str, password: str = "password123", invite: str | None = None):
    body = {"email": f"{username}@example.com", "username": username, "password": password}
    if invite is not None:
        body["invite_code"] = invite
    return client.post("/api/auth/register", json=body)


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def make_asset(db, node_id, *, filename="pic.png", content_hash="hash-1", storage_key=None) -> Asset:
    """Insert an Asset row directly (skips the upload pipeline)."""
    a = Asset(
        node_id=node_id,
        kind="image",
        filename=filename,
        content_type="image/png",
        size=10,
        storage_key=storage_key or f"sk-{uuid.uuid4().hex}",
        content_hash=content_hash,
        processing=False,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


@pytest.fixture
def admin(client):
    """First registered user is the admin. Returns (token, user dict)."""
    r = register(client, "admin")
    assert r.status_code == 201, r.text
    data = r.json()
    return data["access_token"], data["user"]


def new_board(client, token, name="Board") -> str:
    r = client.post("/api/boards", json={"name": name}, headers=auth(token))
    assert r.status_code == 201, r.text
    return r.json()["id"]


def new_node(client, token, board_id, *, type="scene", title="Node", content=None, x=0, y=0) -> str:
    r = client.post(
        f"/api/boards/{board_id}/nodes",
        json={"type": type, "title": title, "content": content or {}, "x": x, "y": y},
        headers=auth(token),
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]
