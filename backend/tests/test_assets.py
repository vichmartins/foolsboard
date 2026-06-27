"""Asset rename + reference -- the exact behaviours behind several bugs this
project hit (cross-node rename 404, idempotent reference, collaborator access)."""
import uuid

from app.models import Asset
from conftest import auth, make_asset, new_board, new_node, register


def test_rename_keeps_extension(client, admin, db):
    token, _ = admin
    bid = new_board(client, token)
    nid = new_node(client, token, bid, type="media", title="M")
    a = make_asset(db, uuid.UUID(nid), filename="pic.png")
    r = client.patch(f"/api/nodes/{nid}/assets/{a.id}", json={"filename": "renamed"}, headers=auth(token))
    assert r.status_code == 200, r.text
    assert r.json()["filename"] == "renamed.png"


def test_rename_via_wrong_node_404(client, admin, db):
    """An asset belongs to one node; renaming it through a different node 404s
    (the ownership check). This is the bug the self-heal rename worked around."""
    token, _ = admin
    bid = new_board(client, token)
    na = new_node(client, token, bid, type="media", title="A")
    nb = new_node(client, token, bid, type="media", title="B")
    a = make_asset(db, uuid.UUID(na))
    r = client.patch(f"/api/nodes/{nb}/assets/{a.id}", json={"filename": "x"}, headers=auth(token))
    assert r.status_code == 404


def test_reference_creates_then_is_idempotent(client, admin, db):
    token, _ = admin
    bid = new_board(client, token)
    na = new_node(client, token, bid, type="media", title="A")
    nb = new_node(client, token, bid, type="media", title="B")
    a = make_asset(db, uuid.UUID(na), content_hash="h1")

    r1 = client.post(f"/api/nodes/{nb}/assets/reference", json={"asset_ids": [str(a.id)]}, headers=auth(token))
    assert r1.status_code == 201, r1.text
    out = r1.json()
    assert len(out) == 1 and out[0]["id"] != str(a.id)  # a new row on nb
    new_id = out[0]["id"]
    # shares the underlying stored file (dedup), not a real copy
    assert db.get(Asset, uuid.UUID(new_id)).storage_key == a.storage_key

    # Referencing the same content again returns nb's existing asset, no duplicate.
    r2 = client.post(f"/api/nodes/{nb}/assets/reference", json={"asset_ids": [str(a.id)]}, headers=auth(token))
    assert r2.status_code == 201
    assert r2.json()[0]["id"] == new_id
    assert db.query(Asset).filter(Asset.node_id == uuid.UUID(nb)).count() == 1


def test_collaborator_can_reference_media_on_a_shared_board(client, admin, db):
    """A board collaborator (not the owner) can reference media on it -- the
    permission fix (was gated on ownership and silently did nothing)."""
    token, _ = admin
    bid = new_board(client, token)
    na = new_node(client, token, bid, type="media", title="A")
    nb = new_node(client, token, bid, type="media", title="B")
    a = make_asset(db, uuid.UUID(na), content_hash="h2")

    code = client.post("/api/invites", json={"expires_in_minutes": 60}, headers=auth(token)).json()["code"]
    btoken = register(client, "bob", invite=code).json()["access_token"]
    share = client.post("/api/shares", json={"recipient": "bob", "board_id": bid}, headers=auth(token))
    assert share.status_code == 201, share.text
    accept = client.post(f"/api/shares/{share.json()['id']}/accept", headers=auth(btoken))
    assert accept.status_code == 200, accept.text

    r = client.post(f"/api/nodes/{nb}/assets/reference", json={"asset_ids": [str(a.id)]}, headers=auth(btoken))
    assert r.status_code == 201, r.text
    assert len(r.json()) == 1
