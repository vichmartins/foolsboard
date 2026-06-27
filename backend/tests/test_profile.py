"""Profile editing: username/email updates, conflicts, validation, and color."""
from conftest import auth, register


def test_update_username_and_email(client, admin):
    token, _ = admin
    r = client.patch("/api/auth/me", json={"username": "renamed"}, headers=auth(token))
    assert r.status_code == 200 and r.json()["username"] == "renamed"
    r2 = client.patch("/api/auth/me", json={"email": "new@example.com"}, headers=auth(token))
    assert r2.status_code == 200 and r2.json()["email"] == "new@example.com"


def test_invalid_email_is_rejected(client, admin):
    token, _ = admin
    r = client.patch("/api/auth/me", json={"email": "notanemail"}, headers=auth(token))
    assert r.status_code == 400, r.text


def test_username_and_email_conflicts(client, admin):
    token, _ = admin
    code = client.post("/api/invites", json={"expires_in_minutes": 60}, headers=auth(token)).json()["code"]
    register(client, "bob", invite=code)
    assert client.patch("/api/auth/me", json={"username": "bob"}, headers=auth(token)).status_code == 409
    assert client.patch("/api/auth/me", json={"email": "bob@example.com"}, headers=auth(token)).status_code == 409


def test_color_update_valid_and_invalid(client, admin):
    token, _ = admin
    colors = client.get("/api/auth/colors", headers=auth(token)).json()
    valid = colors["palette"][0]
    r = client.patch("/api/auth/me/color", json={"color": valid}, headers=auth(token))
    assert r.status_code == 200 and r.json()["color"] == valid.lower()

    bad = "#010203"
    assert bad not in colors["palette"]
    assert client.patch("/api/auth/me/color", json={"color": bad}, headers=auth(token)).status_code == 400
