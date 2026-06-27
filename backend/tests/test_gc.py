"""Orphan-file garbage collection: removes unreferenced files, keeps referenced,
and honors the grace floor that protects in-flight uploads from a manual sweep."""
import os
import pathlib
import time
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
    orphan = store / "orphan.bin"
    orphan.write_bytes(b"nobody references me")
    old = time.time() - 3600  # backdate past the safety grace floor
    os.utime(orphan, (old, old))

    dry = gc_orphans(db, dry_run=True)
    assert dry["orphans"] >= 1
    assert orphan.exists() and (store / "kept.bin").exists()  # dry run deletes nothing

    gc_orphans(db, dry_run=False)
    assert not orphan.exists()           # orphan removed
    assert (store / "kept.bin").exists()  # referenced file kept


def test_gc_spares_recent_files_even_on_manual_run(client, admin, db):
    """The grace floor protects a just-written (in-flight) file from a manual GC."""
    store = pathlib.Path(settings.storage_local_dir)
    fresh = store / "fresh-orphan.bin"
    fresh.write_bytes(b"just uploaded")
    gc_orphans(db, dry_run=False, min_age_days=0)  # manual "GC now"
    assert fresh.exists()  # younger than the grace floor -> kept


def test_gc_grace_window_skips_recent_files(client, admin, db):
    store = pathlib.Path(settings.storage_local_dir)
    (store / "fresh2.bin").write_bytes(b"recent")
    gc_orphans(db, dry_run=False, min_age_days=1)
    assert (store / "fresh2.bin").exists()
