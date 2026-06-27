"""Boards / nodes / edges CRUD + access control."""
from conftest import auth, new_board, new_node, register


def test_board_node_edge_crud(client, admin):
    token, _ = admin
    bid = new_board(client, token, "My Board")

    n1 = new_node(client, token, bid, title="S1")
    upd = client.patch(f"/api/boards/{bid}/nodes/{n1}", json={"title": "S1b"}, headers=auth(token))
    assert upd.status_code == 200 and upd.json()["title"] == "S1b"

    n2 = new_node(client, token, bid, title="S2")
    edge = client.post(
        f"/api/boards/{bid}/edges",
        json={"source_id": n1, "target_id": n2},
        headers=auth(token),
    )
    assert edge.status_code == 201, edge.text

    graph = client.get(f"/api/boards/{bid}/graph", headers=auth(token))
    assert graph.status_code == 200
    g = graph.json()
    assert len(g["nodes"]) == 2 and len(g["edges"]) == 1

    assert client.delete(f"/api/boards/{bid}/nodes/{n1}", headers=auth(token)).status_code == 204


def test_other_user_cannot_access_unshared_board(client, admin):
    token, _ = admin
    bid = new_board(client, token)
    code = client.post("/api/invites", json={"expires_in_minutes": 60}, headers=auth(token)).json()["code"]
    btoken = register(client, "bob", invite=code).json()["access_token"]
    # Bob isn't a member -> the board is not found for him.
    assert client.get(f"/api/boards/{bid}/graph", headers=auth(btoken)).status_code == 404
