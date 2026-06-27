"""Orphan-file garbage collection: removes unreferenced files, keeps referenced."""
import pathlib
import uuid

from conftest import make_asset, new_board, new_node

from app.config import settings
from app.storage_gc import gc_orphans


def test_gc_removes_orphans_but_keeps_referenced_files(client, admin, db):
    token, _ = admin
    nid = new_node(client, token, new_board(client, token))
    make_asset(db, uuid.UUID(nid), storage_key="kept.bin", content_hash="h-kept")

    store = pathlib.Path(settings.storage_local_dir)
    (store / "kept.bin").write_bytes(b"referenced")  # an asset points at this
    (store / "orphan.bin").write_bytes(b"nobody references me")

    # Dry run reports orphans but deletes nothing.
    dry = gc_orphans(db, dry_run=True)
    assert dry["orphans"] >= 1
    assert (store / "orphan.bin").exists()
    assert (store / "kept.bin").exists()

    # Real run removes the orphan and leaves the referenced file.
    gc_orphans(db, dry_run=False)
    assert not (store / "orphan.bin").exists()
    assert (store / "kept.bin").exists()


def test_gc_grace_window_skips_recent_files(client, admin, db):
    """A min_age_days window leaves freshly-written orphans alone."""
    store = pathlib.Path(settings.storage_local_dir)
    (store / "fresh-orphan.bin").write_bytes(b"just uploaded")

    res = gc_orphans(db, dry_run=False, min_age_days=1)
    assert (store / "fresh-orphan.bin").exists()  # newer than the grace window
