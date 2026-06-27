"""Board copy fidelity, node absorb (cross-board move), and graph ETag/304."""
from conftest import auth, new_board, new_node, register


def _edge(client, token, bid, s, t, label=None):
    return client.post(
        f"/api/boards/{bid}/edges",
        json={"source_id": s, "target_id": t, "label": label},
        headers=auth(token),
    )


def test_copy_board_duplicates_graph_with_remapped_edges(client, admin):
    token, _ = admin
    src = new_board(client, token, "Src")
    a = new_node(client, token, src, title="A")
    b = new_node(client, token, src, title="B")
    _edge(client, token, src, a, b, "branch")

    r = client.post(f"/api/boards/{src}/copy", headers=auth(token))
    assert r.status_code == 201, r.text
    new = r.json()
    assert new["folder_id"] is None

    g = client.get(f"/api/boards/{new['id']}/graph", headers=auth(token)).json()
    assert len(g["nodes"]) == 2 and len(g["edges"]) == 1
    new_ids = {n["id"] for n in g["nodes"]}
    edge = g["edges"][0]
    assert edge["source_id"] in new_ids and edge["target_id"] in new_ids  # remapped
    assert a not in new_ids and b not in new_ids  # not the originals


def test_absorb_moves_nodes_and_internal_edge(client, admin):
    token, _ = admin
    b1 = new_board(client, token, "One")
    a = new_node(client, token, b1, title="A")
    b = new_node(client, token, b1, title="B")
    _edge(client, token, b1, a, b)
    b2 = new_board(client, token, "Two")

    assert client.post(f"/api/boards/{b2}/absorb", json={"node_ids": [a, b]}, headers=auth(token)).status_code == 204
    g1 = client.get(f"/api/boards/{b1}/graph", headers=auth(token)).json()
    g2 = client.get(f"/api/boards/{b2}/graph", headers=auth(token)).json()
    assert len(g1["nodes"]) == 0 and len(g1["edges"]) == 0
    assert len(g2["nodes"]) == 2 and len(g2["edges"]) == 1


def test_absorb_drops_cross_board_edge(client, admin):
    token, _ = admin
    b1 = new_board(client, token, "One")
    a = new_node(client, token, b1, title="A")
    b = new_node(client, token, b1, title="B")
    c = new_node(client, token, b1, title="C")
    _edge(client, token, b1, a, b)  # internal to the moved set -> follows
    _edge(client, token, b1, b, c)  # b moves, c stays -> dropped
    b2 = new_board(client, token, "Two")

    client.post(f"/api/boards/{b2}/absorb", json={"node_ids": [a, b]}, headers=auth(token))
    g1 = client.get(f"/api/boards/{b1}/graph", headers=auth(token)).json()
    g2 = client.get(f"/api/boards/{b2}/graph", headers=auth(token)).json()
    assert {n["title"] for n in g1["nodes"]} == {"C"} and len(g1["edges"]) == 0
    assert len(g2["nodes"]) == 2 and len(g2["edges"]) == 1


def test_absorb_rejects_foreign_nodes(client, admin):
    token, _ = admin
    mine = new_board(client, token, "Mine")
    code = client.post("/api/invites", json={"expires_in_minutes": 60}, headers=auth(token)).json()["code"]
    btoken = register(client, "bob", invite=code).json()["access_token"]
    bob_board = new_board(client, btoken, "BobBoard")
    bob_node = new_node(client, btoken, bob_board, title="X")
    r = client.post(f"/api/boards/{mine}/absorb", json={"node_ids": [bob_node]}, headers=auth(token))
    assert r.status_code == 404, r.text


def test_board_graph_etag_revalidation(client, admin):
    token, _ = admin
    bid = new_board(client, token)
    first = client.get(f"/api/boards/{bid}/graph", headers=auth(token))
    etag = first.headers.get("ETag")
    assert etag

    unchanged = client.get(f"/api/boards/{bid}/graph", headers={**auth(token), "If-None-Match": etag})
    assert unchanged.status_code == 304

    new_node(client, token, bid, title="N")  # mutate -> etag must change
    after = client.get(f"/api/boards/{bid}/graph", headers={**auth(token), "If-None-Match": etag})
    assert after.status_code == 200
