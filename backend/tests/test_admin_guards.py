"""Admin user-management guardrails."""
from conftest import auth, register


def _second_user(client, admin_token, name="bob"):
    code = client.post("/api/invites", json={"expires_in_minutes": 60}, headers=auth(admin_token)).json()["code"]
    return register(client, name, invite=code).json()


def test_admin_cannot_demote_or_suspend_self(client, admin):
    token, me = admin
    assert client.patch(f"/api/admin/users/{me['id']}", json={"is_admin": False}, headers=auth(token)).status_code == 400
    assert client.patch(f"/api/admin/users/{me['id']}", json={"is_active": False}, headers=auth(token)).status_code == 400


def test_admin_cannot_delete_self(client, admin):
    token, me = admin
    assert client.delete(f"/api/admin/users/{me['id']}", headers=auth(token)).status_code == 400


def test_admin_can_suspend_and_reactivate_another_user(client, admin):
    token, _ = admin
    oid = _second_user(client, token)["user"]["id"]
    assert client.patch(f"/api/admin/users/{oid}", json={"is_active": False}, headers=auth(token)).status_code == 200
    assert client.patch(f"/api/admin/users/{oid}", json={"is_active": True}, headers=auth(token)).status_code == 200


def test_non_admin_forbidden_from_admin_and_invites(client, admin):
    token, _ = admin
    btoken = _second_user(client, token)["access_token"]
    assert client.get("/api/admin/users", headers=auth(btoken)).status_code == 403
    assert client.post("/api/invites", json={"expires_in_minutes": 60}, headers=auth(btoken)).status_code == 403
