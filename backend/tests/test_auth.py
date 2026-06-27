"""Auth: first user becomes admin, subsequent users need an invite, login."""
from conftest import auth, register


def test_first_user_is_admin(client):
    r = register(client, "admin")
    assert r.status_code == 201, r.text
    assert r.json()["user"]["is_admin"] is True


def test_second_user_requires_invite(client):
    register(client, "admin")
    r = register(client, "bob")
    assert r.status_code == 400


def test_invite_lets_a_user_join_as_non_admin(client):
    token = register(client, "admin").json()["access_token"]
    inv = client.post("/api/invites", json={"expires_in_minutes": 60}, headers=auth(token))
    assert inv.status_code in (200, 201), inv.text
    code = inv.json()["code"]
    r = register(client, "bob", invite=code)
    assert r.status_code == 201, r.text
    assert r.json()["user"]["is_admin"] is False


def test_login_ok_and_wrong_password(client):
    register(client, "admin")
    ok = client.post("/api/auth/login", json={"identifier": "admin", "password": "password123"})
    assert ok.status_code == 200
    bad = client.post("/api/auth/login", json={"identifier": "admin", "password": "nope"})
    assert bad.status_code == 401


def test_requires_auth(client):
    assert client.get("/api/boards").status_code == 401
