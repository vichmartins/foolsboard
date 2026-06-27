"""An edge's endpoints must belong to the board it's created on."""
from conftest import auth, new_board, new_node


def test_edge_endpoint_must_belong_to_board(client, admin):
    token, _ = admin
    b1 = new_board(client, token, "One")
    b2 = new_board(client, token, "Two")
    a = new_node(client, token, b1, title="A")
    x = new_node(client, token, b2, title="X")  # lives on a different board

    r = client.post(f"/api/boards/{b1}/edges", json={"source_id": a, "target_id": x}, headers=auth(token))
    assert r.status_code == 422, r.text
