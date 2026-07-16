"""The media-url backfill rewrites a media node's cached content (url/filename/
kind) to match its live asset, so a stale/deleted source left after a background
re-encode is corrected in the stored content too."""
from __future__ import annotations

from app.database import SessionLocal
from app.models import Asset, Board, Node
from scripts.backfill_media_urls import backfill


def _seed_stale_media_node(db):
    """A board + media node whose cached content still points at the pre-encode
    file, plus the live (transcoded) asset it should resolve to."""
    board = Board(name="B")
    db.add(board)
    db.flush()
    node = Node(board_id=board.id, type="media", title="Ratha Juicehh.m4a", content={})
    db.add(node)
    db.flush()
    asset = Asset(
        node_id=node.id,
        kind="audio",
        filename="Ratha Juicehh.ogg",
        content_type="audio/ogg",
        size=100,
        storage_key="new-key-123.ogg",
        content_hash="hash-ratha",
        processing=False,
    )
    db.add(asset)
    db.flush()
    node.content = {
        "assetId": str(asset.id),
        "url": "/media/old-deleted.m4a",
        "filename": "Ratha Juicehh.m4a",
        "mediaKind": "audio",
        "contentType": "audio/x-m4a",
        "thumbnailUrl": None,
    }
    db.commit()
    return node.id


def test_backfill_dry_run_reports_but_does_not_write():
    with SessionLocal() as db:
        node_id = _seed_stale_media_node(db)
        changed = backfill(db, dry_run=True)
        assert len(changed) == 1
        db.expire_all()
        node = db.get(Node, node_id)
        assert node.content["url"] == "/media/old-deleted.m4a"  # untouched


def test_backfill_rewrites_to_live_asset_and_is_idempotent():
    with SessionLocal() as db:
        node_id = _seed_stale_media_node(db)
        assert len(backfill(db, dry_run=False)) == 1
        node = db.get(Node, node_id)
        assert node.content["filename"] == "Ratha Juicehh.ogg"
        assert node.content["url"].endswith("new-key-123.ogg")
        assert node.content["contentType"] == "audio/ogg"
        assert node.content["mediaKind"] == "audio"
        # Re-running finds nothing to change.
        assert backfill(db, dry_run=False) == []


def test_backfill_ignores_nodes_without_an_asset():
    with SessionLocal() as db:
        board = Board(name="B2")
        db.add(board)
        db.flush()
        # A link node: url in content, no assetId -> must be left alone.
        link = Node(
            board_id=board.id, type="link", title="ext",
            content={"url": "https://example.com", "title": "Ext"},
        )
        db.add(link)
        db.commit()
        assert backfill(db, dry_run=False) == []
        db.refresh(link)
        assert link.content["url"] == "https://example.com"
