"""Invite codes: create/list, single-use, and revoke."""
from conftest import auth, register


def test_invite_create_list_and_single_use(client, admin):
    token, _ = admin
    c = client.post("/api/invites", json={"expires_in_minutes": 60}, headers=auth(token))
    assert c.status_code == 201, c.text
    code = c.json()["code"]

    listing = client.get("/api/invites", headers=auth(token)).json()
    assert any(i["code"] == code for i in listing)

    assert register(client, "bob", invite=code).status_code == 201
    # Already used -> can't be redeemed again.
    assert register(client, "carol", invite=code).status_code == 400


def test_revoked_invite_cannot_register(client, admin):
    token, _ = admin
    c = client.post("/api/invites", json={"expires_in_minutes": 60}, headers=auth(token)).json()
    assert client.delete(f"/api/invites/{c['id']}", headers=auth(token)).status_code == 204
    assert register(client, "bob", invite=c["code"]).status_code == 400
