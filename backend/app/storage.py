"""Pluggable media storage.

Call sites use the `Storage` protocol only, so adding an S3 backend later means
writing one class and flipping STORAGE_BACKEND -- no router changes.

A "key" is an opaque relative path the backend understands; the DB stores the
key, and `url_for` turns it into something the browser can fetch.
"""
from __future__ import annotations

import uuid
from pathlib import Path
from typing import BinaryIO, Protocol

from .config import settings


def _safe_key(filename: str) -> str:
    """Generate a collision-free storage key while preserving the extension."""
    suffix = Path(filename).suffix.lower()
    return f"{uuid.uuid4().hex}{suffix}"


class Storage(Protocol):
    def save(self, fileobj: BinaryIO, filename: str) -> str:
        """Persist a stream and return its storage key."""

    def delete(self, key: str) -> None:
        """Remove the object for a key (no-op if missing)."""

    def url_for(self, key: str) -> str:
        """Return a browser-fetchable URL for a key."""

    def open(self, key: str) -> BinaryIO:
        """Open the stored object for reading (raises if missing)."""


class LocalStorage:
    """Stores files under a local directory, served by a static mount."""

    def __init__(self, root: str, public_url: str) -> None:
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)
        self.public_url = public_url.rstrip("/")

    def save(self, fileobj: BinaryIO, filename: str) -> str:
        key = _safe_key(filename)
        dest = self.root / key
        with dest.open("wb") as out:
            # Stream in chunks so large videos don't load fully into memory.
            while chunk := fileobj.read(1024 * 1024):
                out.write(chunk)
        return key

    def delete(self, key: str) -> None:
        (self.root / key).unlink(missing_ok=True)

    def url_for(self, key: str) -> str:
        return f"{self.public_url}/{key}"

    def open(self, key: str) -> BinaryIO:
        return (self.root / key).open("rb")


def build_storage() -> Storage:
    if settings.storage_backend == "local":
        return LocalStorage(settings.storage_local_dir, settings.storage_public_url)
    raise ValueError(f"Unknown STORAGE_BACKEND: {settings.storage_backend!r}")


storage: Storage = build_storage()
