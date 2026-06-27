"""Admin endpoints: gated to admins; backup status reads gracefully."""
from conftest import auth, register


def test_backup_status_reads_gracefully(client, admin):
    token, _ = admin
    r = client.get("/api/admin/backups", headers=auth(token))
    assert r.status_code == 200, r.text
    body = r.json()
    # No backup dir in the test env -> exists False, but the shape is always there.
    assert "exists" in body and "items" in body and isinstance(body["items"], list)


def test_admin_endpoints_blocked_for_non_admins(client, admin):
    token, _ = admin
    code = client.post("/api/invites", json={"expires_in_minutes": 60}, headers=auth(token)).json()["code"]
    btoken = register(client, "bob", invite=code).json()["access_token"]
    assert client.get("/api/admin/backups", headers=auth(btoken)).status_code == 403
    assert client.get("/api/admin/users", headers=auth(btoken)).status_code == 403
