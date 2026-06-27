"""Export a board to a bundle and import it back (round-trip), plus import errors."""
import io
import zipfile

from conftest import auth, new_board, new_node


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
