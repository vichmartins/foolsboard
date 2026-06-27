"""Folder nesting: parent/child, self-parent, cycle, and cross-user rejection."""
from conftest import auth, register


def _folder(client, token, name):
    return client.post("/api/folders", json={"name": name}, headers=auth(token)).json()["id"]


def test_nest_and_unnest_folder(client, admin):
    token, _ = admin
    a, b = _folder(client, token, "A"), _folder(client, token, "B")
    assert client.patch(f"/api/folders/{b}/parent", json={"parent_folder_id": a}, headers=auth(token)).status_code == 204
    assert client.patch(f"/api/folders/{b}/parent", json={"parent_folder_id": None}, headers=auth(token)).status_code == 204


def test_folder_cannot_be_its_own_parent(client, admin):
    token, _ = admin
    a = _folder(client, token, "A")
    assert client.patch(f"/api/folders/{a}/parent", json={"parent_folder_id": a}, headers=auth(token)).status_code == 400


def test_folder_nesting_rejects_cycles(client, admin):
    token, _ = admin
    a, b = _folder(client, token, "A"), _folder(client, token, "B")
    client.patch(f"/api/folders/{b}/parent", json={"parent_folder_id": a}, headers=auth(token))  # B under A
    # Nesting A under B would close a cycle.
    assert client.patch(f"/api/folders/{a}/parent", json={"parent_folder_id": b}, headers=auth(token)).status_code == 400


def test_cannot_nest_under_another_users_folder(client, admin):
    token, _ = admin
    a = _folder(client, token, "A")
    code = client.post("/api/invites", json={"expires_in_minutes": 60}, headers=auth(token)).json()["code"]
    btoken = register(client, "bob", invite=code).json()["access_token"]
    bob_folder = _folder(client, btoken, "BobF")
    assert client.patch(f"/api/folders/{a}/parent", json={"parent_folder_id": bob_folder}, headers=auth(token)).status_code == 404
