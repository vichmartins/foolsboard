"""Sharing a category grants the recipient the category and everything filed in
it (loose boards, plus folders and their boards), and surfaces it in their layout."""
import uuid

from conftest import auth, new_board, register


def _second_user(client, admin_token, name="bob"):
    code = client.post(
        "/api/invites", json={"expires_in_minutes": 60}, headers=auth(admin_token)
    ).json()["code"]
    return register(client, name, invite=code).json()["access_token"]


def _file_into_category(client, token, name, item_ids):
    cat_id = str(uuid.uuid4())
    layout = {"categories": [{"id": cat_id, "name": name, "items": item_ids}], "top": []}
    r = client.put("/api/auth/me/categories", json=layout, headers=auth(token))
    assert r.status_code == 200, r.text
    return cat_id


def test_category_share_grants_loose_board(client, admin):
    token, _ = admin
    btoken = _second_user(client, token)
    bid = new_board(client, token, "In Category")
    cat_id = _file_into_category(client, token, "Season 1", [bid])

    # No access before sharing.
    assert client.get(f"/api/boards/{bid}/graph", headers=auth(btoken)).status_code == 404

    share = client.post(
        "/api/shares", json={"recipient": "bob", "category_id": cat_id}, headers=auth(token)
    )
    assert share.status_code == 201, share.text
    assert share.json()["resource_type"] == "category"
    assert client.post(f"/api/shares/{share.json()['id']}/accept", headers=auth(btoken)).status_code == 200

    # Recipient can now open the board and sees it in their board list.
    assert client.get(f"/api/boards/{bid}/graph", headers=auth(btoken)).status_code == 200
    assert any(b["id"] == bid for b in client.get("/api/boards", headers=auth(btoken)).json())

    # The shared category shows up in the recipient's layout, flagged + populated.
    cats = client.get("/api/auth/me/categories", headers=auth(btoken)).json()["categories"]
    mine = [c for c in cats if c["id"] == cat_id]
    assert mine and mine[0]["shared"] is True
    assert mine[0]["owner_name"] is not None and bid in mine[0]["items"]

    # The owner sees their category flagged as shared-out (crown).
    ocats = client.get("/api/auth/me/categories", headers=auth(token)).json()["categories"]
    assert [c for c in ocats if c["id"] == cat_id][0]["shared_out"] is True


def test_category_share_grants_folder_and_its_boards(client, admin):
    token, _ = admin
    btoken = _second_user(client, token)
    fid = client.post("/api/folders", json={"name": "Act One"}, headers=auth(token)).json()["id"]
    bid = new_board(client, token, "In Folder")
    client.patch(f"/api/boards/{bid}/folder", json={"folder_id": fid}, headers=auth(token))
    cat_id = _file_into_category(client, token, "Series", [fid])

    share = client.post(
        "/api/shares", json={"recipient": "bob", "category_id": cat_id}, headers=auth(token)
    )
    client.post(f"/api/shares/{share.json()['id']}/accept", headers=auth(btoken))

    # Recipient sees the folder and can open the board inside it.
    assert any(f["id"] == fid for f in client.get("/api/folders", headers=auth(btoken)).json())
    assert client.get(f"/api/boards/{bid}/graph", headers=auth(btoken)).status_code == 200


def test_reject_category_share_leaves_no_access(client, admin):
    token, _ = admin
    btoken = _second_user(client, token)
    bid = new_board(client, token)
    cat_id = _file_into_category(client, token, "Nope", [bid])
    sid = client.post(
        "/api/shares", json={"recipient": "bob", "category_id": cat_id}, headers=auth(token)
    ).json()["id"]
    assert client.post(f"/api/shares/{sid}/reject", headers=auth(btoken)).status_code == 204
    assert client.get(f"/api/boards/{bid}/graph", headers=auth(btoken)).status_code == 404


def test_share_requires_exactly_one_target(client, admin):
    token, _ = admin
    bid = new_board(client, token)
    cat_id = _file_into_category(client, token, "X", [bid])
    # both a board and a category -> rejected
    r = client.post(
        "/api/shares",
        json={"recipient": "bob", "board_id": bid, "category_id": cat_id},
        headers=auth(token),
    )
    assert r.status_code == 400
