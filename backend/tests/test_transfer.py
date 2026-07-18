"""Export a board to a bundle and import it back (round-trip), plus import errors
and per-asset size enforcement."""
import io
import json
import pathlib
import uuid
import zipfile

from sqlalchemy import select

from conftest import auth, make_asset, new_board, new_node

from app.config import settings
from app.models import Asset, Node


def test_export_then_import_round_trip(client, admin):
    token, _ = admin
    bid = new_board(client, token, "Original")
    new_node(client, token, bid, type="scene", title="Scene 1", content={"location": "Peak"})

    ex = client.post("/api/boards/export", json={"board_ids": [bid]}, headers=auth(token))
    assert ex.status_code == 200, ex.text
    bundle = ex.content
    assert bundle[:2] == b"PK"  # a zip archive

    imp = client.post(
        "/api/boards/import",
        files={"file": ("bundle.zip", io.BytesIO(bundle), "application/zip")},
        headers=auth(token),
    )
    assert imp.status_code == 200, imp.text
    created = imp.json()
    assert len(created) >= 1

    graph = client.get(f"/api/boards/{created[0]['id']}/graph", headers=auth(token)).json()
    assert any(n["title"] == "Scene 1" for n in graph["nodes"])


def test_category_export_import_round_trip_and_db_sync(client, admin, db):
    """Exporting a category carries its folders/boards; importing recreates the
    category AND syncs it to the DB (Category row + folder.category_id) so it's
    immediately consistent and shareable, not just present in the JSON layout."""
    from app.models import Category, Folder

    token, _ = admin
    fid = client.post("/api/folders", json={"name": "Act One"}, headers=auth(token)).json()["id"]
    bid = new_board(client, token, "Scene")
    client.patch(f"/api/boards/{bid}/folder", json={"folder_id": fid}, headers=auth(token))
    cat_id = str(uuid.uuid4())
    layout = {"categories": [{"id": cat_id, "name": "Season 1", "items": [fid]}], "top": []}
    assert client.put("/api/auth/me/categories", json=layout, headers=auth(token)).status_code == 200

    ex = client.post("/api/boards/export", json={"category_ids": [cat_id]}, headers=auth(token))
    assert ex.status_code == 200, ex.text
    imp = client.post(
        "/api/boards/import",
        files={"file": ("b.zip", io.BytesIO(ex.content), "application/zip")},
        headers=auth(token),
    )
    assert imp.status_code == 200, imp.text

    # A fresh "Season 1" category (distinct id) now exists with one folder item.
    cats = client.get("/api/auth/me/categories", headers=auth(token)).json()["categories"]
    imported = [c for c in cats if c["name"] == "Season 1" and c["id"] != cat_id]
    assert imported, cats
    new_cat = imported[0]
    assert len(new_cat["items"]) == 1

    # DB is in sync: the Category row exists and the imported folder points at it.
    new_folder = db.get(Folder, uuid.UUID(new_cat["items"][0]))
    assert new_folder is not None and str(new_folder.category_id) == new_cat["id"]
    assert db.get(Category, uuid.UUID(new_cat["id"])) is not None


def test_import_rejects_non_zip(client, admin):
    token, _ = admin
    r = client.post(
        "/api/boards/import",
        files={"file": ("notazip.zip", io.BytesIO(b"definitely not a zip"), "application/zip")},
        headers=auth(token),
    )
    assert r.status_code == 400, r.text


def test_import_rejects_zip_without_manifest(client, admin):
    token, _ = admin
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("hello.txt", "no manifest in here")
    buf.seek(0)
    r = client.post(
        "/api/boards/import",
        files={"file": ("bundle.zip", buf, "application/zip")},
        headers=auth(token),
    )
    assert r.status_code == 400, r.text


def test_import_rejects_oversized_asset(client, admin):
    token, _ = admin
    manifest = {
        "version": 4,
        "boards": [{
            "name": "B",
            "nodes": [{
                "id": "n1", "type": "media", "title": "M",
                "assets": [{
                    "file": "media/big.bin", "filename": "big.png", "kind": "image",
                    "content_type": "image/png", "size": 1,  # lies; real bytes are huge
                }],
            }],
            "edges": [],
        }],
    }
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("manifest.json", json.dumps(manifest))
        z.writestr("media/big.bin", b"\x00" * (5 * 1024 * 1024 + 100))  # > 5 MB image cap
    buf.seek(0)
    r = client.post(
        "/api/boards/import",
        files={"file": ("b.zip", buf, "application/zip")},
        headers=auth(token),
    )
    assert r.status_code == 413, r.text


def test_imported_asset_uses_real_bytes_and_fresh_key(client, admin, db):
    token, _ = admin
    bid = new_board(client, token, "WithMedia")
    nid = new_node(client, token, bid, type="media", title="M")
    store = pathlib.Path(settings.storage_local_dir)
    (store / "orig.bin").write_bytes(b"hello-bytes")  # 11 real bytes on disk
    # Asset row claims size=10 (helper default) -- import must record the REAL 11.
    make_asset(db, uuid.UUID(nid), filename="pic.png", storage_key="orig.bin", content_hash="h1")

    ex = client.post("/api/boards/export", json={"board_ids": [bid]}, headers=auth(token))
    assert ex.status_code == 200, ex.text
    imp = client.post(
        "/api/boards/import",
        files={"file": ("b.zip", io.BytesIO(ex.content), "application/zip")},
        headers=auth(token),
    )
    assert imp.status_code == 200, imp.text
    new_board_id = uuid.UUID(imp.json()[0]["id"])

    node_ids = list(db.scalars(select(Node.id).where(Node.board_id == new_board_id)))
    imported = list(db.scalars(select(Asset).where(Asset.node_id.in_(node_ids))))
    assert len(imported) == 1
    assert imported[0].size == 11               # actual restored bytes, not the manifest's 10
    assert imported[0].storage_key != "orig.bin"  # a fresh key, never reuses the source's


def test_import_relinks_media_node_content(client, admin, db):
    """A media node's content.assetId/url must be relinked to the freshly-restored
    asset — otherwise it points at the source's storage key and shows nothing."""
    token, _ = admin
    bid = new_board(client, token, "WithMedia")
    old = {
        "assetId": "00000000-0000-0000-0000-000000000000",
        "url": "/media/orig.bin",
        "thumbnailUrl": "/media/orig-thumb.bin",
        "mediaKind": "image",
        "filename": "pic.png",
    }
    nid = new_node(client, token, bid, type="media", title="M", content=old)
    store = pathlib.Path(settings.storage_local_dir)
    (store / "orig.bin").write_bytes(b"hello-bytes")
    make_asset(db, uuid.UUID(nid), filename="pic.png", storage_key="orig.bin", content_hash="h1")

    ex = client.post("/api/boards/export", json={"board_ids": [bid]}, headers=auth(token))
    assert ex.status_code == 200, ex.text
    imp = client.post(
        "/api/boards/import",
        files={"file": ("b.zip", io.BytesIO(ex.content), "application/zip")},
        headers=auth(token),
    )
    assert imp.status_code == 200, imp.text
    new_board_id = uuid.UUID(imp.json()[0]["id"])

    node_ids = list(db.scalars(select(Node.id).where(Node.board_id == new_board_id)))
    imported_asset = list(db.scalars(select(Asset).where(Asset.node_id.in_(node_ids))))[0]
    graph = client.get(f"/api/boards/{new_board_id}/graph", headers=auth(token)).json()
    media_node = next(n for n in graph["nodes"] if n["type"] == "media")
    c = media_node["content"]
    assert c["assetId"] == str(imported_asset.id)   # points at the new asset, not the source
    assert c["assetId"] != old["assetId"]
    assert c["url"] != old["url"]                    # fresh URL, not the stale source key
    assert imported_asset.storage_key in c["url"]
    assert c["thumbnailUrl"] is None                # source had no thumb -> cleared, not stale
