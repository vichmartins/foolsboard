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


def test_get_single_board(client, admin):
    token, _ = admin
    bid = new_board(client, token, "Solo")
    r = client.get(f"/api/boards/{bid}", headers=auth(token))
    assert r.status_code == 200, r.text
    assert r.json()["id"] == bid and r.json()["is_template"] is False


def test_mark_template_and_copy_is_plain_board(client, admin):
    token, _ = admin
    bid = new_board(client, token, "Starter")
    marked = client.patch(f"/api/boards/{bid}", json={"is_template": True}, headers=auth(token))
    assert marked.status_code == 200 and marked.json()["is_template"] is True
    # "New from template" = copy; the instance must NOT itself be a template.
    copy = client.post(f"/api/boards/{bid}/copy", headers=auth(token))
    assert copy.status_code == 201, copy.text
    assert copy.json()["is_template"] is False
    # Unmarking clears it again.
    cleared = client.patch(f"/api/boards/{bid}", json={"is_template": False}, headers=auth(token))
    assert cleared.status_code == 200 and cleared.json()["is_template"] is False


def test_template_marking_is_per_user_on_shared_boards(client, admin):
    """A board's template star belongs only to the account that set it -- a
    collaborator on a shared board must not inherit the owner's template mark."""
    admin_token, _ = admin
    code = client.post(
        "/api/invites", json={"expires_in_minutes": 60}, headers=auth(admin_token)
    ).json()["code"]
    btoken = register(client, "bob", invite=code).json()["access_token"]

    bid = new_board(client, admin_token, "Shared Starter")
    sid = client.post(
        "/api/shares", json={"recipient": "bob", "board_id": bid}, headers=auth(admin_token)
    ).json()["id"]
    assert client.post(f"/api/shares/{sid}/accept", headers=auth(btoken)).status_code == 200

    # Owner marks it as their template.
    client.patch(f"/api/boards/{bid}", json={"is_template": True}, headers=auth(admin_token))

    def is_tmpl_in_list(tok):
        row = [b for b in client.get("/api/boards", headers=auth(tok)).json() if b["id"] == bid]
        assert row, "board missing from list"
        return row[0]["is_template"]

    assert is_tmpl_in_list(admin_token) is True   # the owner who set it sees the star
    assert is_tmpl_in_list(btoken) is False       # the collaborator does NOT
    # GET single board is per-user too.
    assert client.get(f"/api/boards/{bid}", headers=auth(btoken)).json()["is_template"] is False
    assert client.get(f"/api/boards/{bid}", headers=auth(admin_token)).json()["is_template"] is True


def test_team_template_publish_visible_copyable_and_unpublish_rules(client, admin):
    """Publishing a board as a team template makes it visible to everyone and
    copyable by anyone; only the publisher or an admin can unpublish."""
    admin_token, admin_user = admin
    code = client.post(
        "/api/invites", json={"expires_in_minutes": 60}, headers=auth(admin_token)
    ).json()["code"]
    btoken = register(client, "bob", invite=code).json()["access_token"]

    bid = new_board(client, admin_token, "Team Starter")
    # Bob can't copy it yet (private, not shared with him, not a team template).
    assert client.post(f"/api/boards/{bid}/copy", headers=auth(btoken)).status_code == 404

    pub = client.post(f"/api/boards/{bid}/share-template", headers=auth(admin_token))
    assert pub.status_code == 200, pub.text
    assert pub.json()["shared_template"] is True
    assert pub.json()["shared_template_by"] == admin_user["username"]

    # Bob (no access to the board) sees it in the shared-templates list...
    shared = client.get("/api/boards/shared-templates", headers=auth(btoken)).json()
    assert any(t["id"] == bid and t["name"] == "Team Starter" for t in shared)
    # ...and can copy it into a plain private board of his own.
    copy = client.post(f"/api/boards/{bid}/copy", headers=auth(btoken))
    assert copy.status_code == 201, copy.text
    assert copy.json()["shared_template"] is False

    # Bob can't unpublish someone else's team template.
    assert client.delete(f"/api/boards/{bid}/share-template", headers=auth(btoken)).status_code == 403
    # The publisher can.
    un = client.delete(f"/api/boards/{bid}/share-template", headers=auth(admin_token))
    assert un.status_code == 200 and un.json()["shared_template"] is False
    assert not client.get("/api/boards/shared-templates", headers=auth(btoken)).json()


def test_admin_can_unpublish_any_team_template(client, admin):
    admin_token, _ = admin
    code = client.post(
        "/api/invites", json={"expires_in_minutes": 60}, headers=auth(admin_token)
    ).json()["code"]
    btoken = register(client, "bob", invite=code).json()["access_token"]
    # Bob publishes his own board; an admin can remove it.
    bid = new_board(client, btoken, "Bob's Template")
    assert client.post(f"/api/boards/{bid}/share-template", headers=auth(btoken)).status_code == 200
    un = client.delete(f"/api/boards/{bid}/share-template", headers=auth(admin_token))
    assert un.status_code == 200 and un.json()["shared_template"] is False


def test_other_user_cannot_access_unshared_board(client, admin):
    token, _ = admin
    bid = new_board(client, token)
    code = client.post("/api/invites", json={"expires_in_minutes": 60}, headers=auth(token)).json()["code"]
    btoken = register(client, "bob", invite=code).json()["access_token"]
    # Bob isn't a member -> the board is not found for him.
    assert client.get(f"/api/boards/{bid}/graph", headers=auth(btoken)).status_code == 404
