"""Folder-share access, share validation, and remove-share (IDOR + leave)."""
from conftest import auth, new_board, register


def _user(client, admin_token, name):
    code = client.post("/api/invites", json={"expires_in_minutes": 60}, headers=auth(admin_token)).json()["code"]
    return register(client, name, invite=code).json()


def test_folder_share_grants_access_to_boards_inside(client, admin):
    token, _ = admin
    fid = client.post("/api/folders", json={"name": "Shared"}, headers=auth(token)).json()["id"]
    bid = new_board(client, token, "Inside")
    client.patch(f"/api/boards/{bid}/folder", json={"folder_id": fid}, headers=auth(token))
    btoken = _user(client, token, "bob")["access_token"]
    assert client.get(f"/api/boards/{bid}/graph", headers=auth(btoken)).status_code == 404

    share = client.post("/api/shares", json={"recipient": "bob", "folder_id": fid}, headers=auth(token))
    assert share.status_code == 201, share.text
    client.post(f"/api/shares/{share.json()['id']}/accept", headers=auth(btoken))
    assert client.get(f"/api/boards/{bid}/graph", headers=auth(btoken)).status_code == 200


def test_share_validation(client, admin):
    token, me = admin
    bid = new_board(client, token)
    assert client.post("/api/shares", json={"recipient": me["username"], "board_id": bid}, headers=auth(token)).status_code == 400
    assert client.post("/api/shares", json={"recipient": "ghost", "board_id": bid}, headers=auth(token)).status_code == 404
    both = client.post("/api/shares", json={"recipient": "x", "board_id": bid, "folder_id": bid}, headers=auth(token))
    assert both.status_code == 400


def test_remove_share_idor_and_leave(client, admin):
    token, _ = admin
    bid = new_board(client, token)
    btoken = _user(client, token, "bob")["access_token"]
    ctoken = _user(client, token, "carol")["access_token"]
    sid = client.post("/api/shares", json={"recipient": "bob", "board_id": bid}, headers=auth(token)).json()["id"]
    client.post(f"/api/shares/{sid}/accept", headers=auth(btoken))

    # An unrelated user can't delete someone else's share.
    assert client.delete(f"/api/shares/{sid}", headers=auth(ctoken)).status_code == 404
    # The recipient can leave (delete their own share), losing access.
    assert client.delete(f"/api/shares/{sid}", headers=auth(btoken)).status_code == 204
    assert client.get(f"/api/boards/{bid}/graph", headers=auth(btoken)).status_code == 404
