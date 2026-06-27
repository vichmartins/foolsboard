"""Edge CRUD + cascade when a connected node is deleted."""
from conftest import auth, new_board, new_node


def _two_nodes(client, token):
    bid = new_board(client, token)
    return bid, new_node(client, token, bid, title="A"), new_node(client, token, bid, title="B")


def test_edge_create_update_delete(client, admin):
    token, _ = admin
    bid, a, b = _two_nodes(client, token)
    e = client.post(
        f"/api/boards/{bid}/edges",
        json={"source_id": a, "target_id": b, "label": "first"},
        headers=auth(token),
    )
    assert e.status_code == 201, e.text
    eid = e.json()["id"]

    u = client.patch(f"/api/boards/{bid}/edges/{eid}", json={"label": "renamed"}, headers=auth(token))
    assert u.status_code == 200 and u.json()["label"] == "renamed"

    assert client.delete(f"/api/boards/{bid}/edges/{eid}", headers=auth(token)).status_code == 204


def test_deleting_a_node_removes_its_edges(client, admin):
    token, _ = admin
    bid, a, b = _two_nodes(client, token)
    client.post(f"/api/boards/{bid}/edges", json={"source_id": a, "target_id": b}, headers=auth(token))
    client.delete(f"/api/boards/{bid}/nodes/{a}", headers=auth(token))
    graph = client.get(f"/api/boards/{bid}/graph", headers=auth(token)).json()
    assert len(graph["edges"]) == 0
