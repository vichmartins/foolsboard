"""Sharing a board: accept grants access, reject doesn't, unshare revokes it."""
from conftest import auth, new_board, register


def _invite(client, token):
    return client.post("/api/invites", json={"expires_in_minutes": 60}, headers=auth(token)).json()["code"]


def _second_user(client, admin_token, name="bob"):
    code = _invite(client, admin_token)
    return register(client, name, invite=code).json()["access_token"]


def test_accept_share_grants_access(client, admin):
    token, _ = admin
    bid = new_board(client, token, "Shared")
    btoken = _second_user(client, token)
    assert client.get(f"/api/boards/{bid}/graph", headers=auth(btoken)).status_code == 404

    share = client.post("/api/shares", json={"recipient": "bob", "board_id": bid}, headers=auth(token))
    assert share.status_code == 201, share.text
    accept = client.post(f"/api/shares/{share.json()['id']}/accept", headers=auth(btoken))
    assert accept.status_code == 200, accept.text

    assert client.get(f"/api/boards/{bid}/graph", headers=auth(btoken)).status_code == 200


def test_reject_share_leaves_no_access(client, admin):
    token, _ = admin
    bid = new_board(client, token)
    btoken = _second_user(client, token)
    sid = client.post("/api/shares", json={"recipient": "bob", "board_id": bid}, headers=auth(token)).json()["id"]
    assert client.post(f"/api/shares/{sid}/reject", headers=auth(btoken)).status_code == 204
    assert client.get(f"/api/boards/{bid}/graph", headers=auth(btoken)).status_code == 404


def test_unshare_revokes_access(client, admin):
    token, _ = admin
    bid = new_board(client, token)
    btoken = _second_user(client, token)
    sid = client.post("/api/shares", json={"recipient": "bob", "board_id": bid}, headers=auth(token)).json()["id"]
    client.post(f"/api/shares/{sid}/accept", headers=auth(btoken))
    assert client.get(f"/api/boards/{bid}/graph", headers=auth(btoken)).status_code == 200

    assert client.delete(f"/api/shares/by-board/{bid}", headers=auth(token)).status_code == 204
    assert client.get(f"/api/boards/{bid}/graph", headers=auth(btoken)).status_code == 404
