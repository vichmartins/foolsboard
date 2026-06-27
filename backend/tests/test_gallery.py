"""The workspace Gallery payload is slimmed: it keeps what the gallery renders
(type/title/content/color/size) and drops geometry/timestamps/board_id."""
from conftest import auth, new_board, new_node


def test_gallery_returns_slim_nodes(client, admin):
    token, _ = admin
    bid = new_board(client, token, "B")
    new_node(client, token, bid, type="scene", title="S", content={"location": "Peak"}, x=5, y=9)

    r = client.get("/api/boards/gallery", headers=auth(token))
    assert r.status_code == 200, r.text
    boards = r.json()["boards"]
    assert len(boards) == 1
    node = boards[0]["nodes"][0]

    # Kept (the gallery needs these):
    assert node["title"] == "S"
    assert node["content"]["location"] == "Peak"
    # Slimmed away:
    for dropped in ("x", "y", "board_id", "created_at", "updated_at"):
        assert dropped not in node, f"{dropped} should be dropped from the gallery payload"
