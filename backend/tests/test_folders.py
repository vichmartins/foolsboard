"""Folders: create/rename, filing a board, and delete-unfiles-boards."""
from conftest import auth, new_board


def test_folder_create_rename_and_file_board(client, admin):
    token, _ = admin
    f = client.post("/api/folders", json={"name": "Season 1"}, headers=auth(token))
    assert f.status_code == 201, f.text
    fid = f.json()["id"]

    r = client.patch(f"/api/folders/{fid}", json={"name": "Season One"}, headers=auth(token))
    assert r.status_code == 200 and r.json()["name"] == "Season One"

    bid = new_board(client, token)
    mv = client.patch(f"/api/boards/{bid}/folder", json={"folder_id": fid}, headers=auth(token))
    assert mv.status_code == 200, mv.text
    assert mv.json()["folder_id"] == fid


def test_deleting_folder_unfiles_its_boards(client, admin):
    token, _ = admin
    fid = client.post("/api/folders", json={"name": "Temp"}, headers=auth(token)).json()["id"]
    bid = new_board(client, token)
    client.patch(f"/api/boards/{bid}/folder", json={"folder_id": fid}, headers=auth(token))

    assert client.delete(f"/api/folders/{fid}", headers=auth(token)).status_code == 204
    # The board is NOT deleted -- just unfiled.
    board = client.get(f"/api/boards/{bid}", headers=auth(token)).json()
    assert board["folder_id"] is None
