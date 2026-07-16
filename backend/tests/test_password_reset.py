"""Admin-driven password reset: set a password directly, or issue a single-use,
expiring temporary password that forces the user to choose a new one. Also covers
the public first-run setup-status endpoint."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.database import SessionLocal
from app.models import User

from conftest import auth, register


def _make_member(client, admin_token, name="bob"):
    code = client.post(
        "/api/invites", json={"expires_in_minutes": 60}, headers=auth(admin_token)
    ).json()["code"]
    r = register(client, name, invite=code)
    assert r.status_code == 201, r.text
    return r.json()["user"]["id"], r.json()["access_token"]


def _user_id_by_name(username: str) -> str:
    with SessionLocal() as s:
        u = s.query(User).filter(User.username == username).one()
        return str(u.id)


# --- setup status -----------------------------------------------------------
def test_setup_needs_setup_on_empty_instance(client):
    r = client.get("/api/auth/setup")
    assert r.status_code == 200
    assert r.json() == {"needs_setup": True}


def test_setup_false_once_admin_exists(client, admin):
    r = client.get("/api/auth/setup")
    assert r.status_code == 200
    assert r.json() == {"needs_setup": False}


# --- admin sets a password directly ----------------------------------------
def test_admin_set_password_lets_user_log_in(client, admin):
    admin_token, _ = admin
    uid, _ = _make_member(client, admin_token)

    r = client.post(
        f"/api/admin/users/{uid}/password",
        json={"mode": "set", "password": "brandnewpass1"},
        headers=auth(admin_token),
    )
    assert r.status_code == 200, r.text
    assert r.json()["mode"] == "set"
    assert r.json()["must_change_password"] is False
    assert r.json()["temp_password"] is None

    # Old password no longer works; the new one does, with no forced change.
    assert client.post(
        "/api/auth/login", json={"identifier": "bob", "password": "password123"}
    ).status_code == 401
    good = client.post(
        "/api/auth/login", json={"identifier": "bob", "password": "brandnewpass1"}
    )
    assert good.status_code == 200, good.text
    assert good.json()["user"]["must_change_password"] is False


def test_admin_set_password_with_require_change(client, admin):
    admin_token, _ = admin
    uid, _ = _make_member(client, admin_token)
    r = client.post(
        f"/api/admin/users/{uid}/password",
        json={"mode": "set", "password": "brandnewpass1", "require_change": True},
        headers=auth(admin_token),
    )
    assert r.status_code == 200
    assert r.json()["must_change_password"] is True
    login = client.post(
        "/api/auth/login", json={"identifier": "bob", "password": "brandnewpass1"}
    )
    assert login.json()["user"]["must_change_password"] is True


def test_admin_set_password_rejects_short(client, admin):
    admin_token, _ = admin
    uid, _ = _make_member(client, admin_token)
    r = client.post(
        f"/api/admin/users/{uid}/password",
        json={"mode": "set", "password": "short"},
        headers=auth(admin_token),
    )
    assert r.status_code == 422  # pydantic min_length


# --- temporary password -----------------------------------------------------
def test_temp_password_flow_end_to_end(client, admin):
    admin_token, _ = admin
    uid, _ = _make_member(client, admin_token)

    r = client.post(
        f"/api/admin/users/{uid}/password",
        json={"mode": "temp"},
        headers=auth(admin_token),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["mode"] == "temp"
    assert body["must_change_password"] is True
    temp = body["temp_password"]
    assert temp and len(temp) >= 10
    assert body["temp_password_expires_at"] is not None

    # The old password is dead; the temp signs the user in and flags the change.
    assert client.post(
        "/api/auth/login", json={"identifier": "bob", "password": "password123"}
    ).status_code == 401
    login = client.post(
        "/api/auth/login", json={"identifier": "bob", "password": temp}
    )
    assert login.status_code == 200, login.text
    assert login.json()["user"]["must_change_password"] is True
    token = login.json()["access_token"]

    # Completing the reset sets a real password and retires the temp.
    done = client.post(
        "/api/auth/me/complete-reset",
        json={"new_password": "myrealpassword1"},
        headers=auth(token),
    )
    assert done.status_code == 200, done.text
    assert done.json()["user"]["must_change_password"] is False

    # Temp password can never be used again; the chosen one works normally.
    assert client.post(
        "/api/auth/login", json={"identifier": "bob", "password": temp}
    ).status_code == 401
    final = client.post(
        "/api/auth/login", json={"identifier": "bob", "password": "myrealpassword1"}
    )
    assert final.status_code == 200
    assert final.json()["user"]["must_change_password"] is False


def test_expired_temp_password_is_rejected(client, admin):
    admin_token, _ = admin
    uid, _ = _make_member(client, admin_token)
    r = client.post(
        f"/api/admin/users/{uid}/password",
        json={"mode": "temp"},
        headers=auth(admin_token),
    )
    temp = r.json()["temp_password"]

    # Backdate the expiry so the temp password is now stale.
    with SessionLocal() as s:
        u = s.query(User).filter(User.username == "bob").one()
        u.temp_password_expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        s.commit()

    login = client.post(
        "/api/auth/login", json={"identifier": "bob", "password": temp}
    )
    assert login.status_code == 403
    assert "expired" in login.json()["detail"].lower()


def test_two_temp_resets_invalidate_the_first(client, admin):
    admin_token, _ = admin
    uid, _ = _make_member(client, admin_token)
    first = client.post(
        f"/api/admin/users/{uid}/password", json={"mode": "temp"}, headers=auth(admin_token)
    ).json()["temp_password"]
    second = client.post(
        f"/api/admin/users/{uid}/password", json={"mode": "temp"}, headers=auth(admin_token)
    ).json()["temp_password"]
    assert first != second
    # The superseded temp password no longer authenticates.
    assert client.post(
        "/api/auth/login", json={"identifier": "bob", "password": first}
    ).status_code == 401
    assert client.post(
        "/api/auth/login", json={"identifier": "bob", "password": second}
    ).status_code == 200


# --- complete-reset guards ---------------------------------------------------
def test_complete_reset_rejected_without_pending_change(client, admin):
    """A normal user (no pending reset) can't use complete-reset to bypass the
    current-password requirement."""
    admin_token, _ = admin
    _, member_token = _make_member(client, admin_token)
    r = client.post(
        "/api/auth/me/complete-reset",
        json={"new_password": "sneakychange1"},
        headers=auth(member_token),
    )
    assert r.status_code == 400


# --- authz + self guards -----------------------------------------------------
def test_reset_requires_admin(client, admin):
    admin_token, _ = admin
    uid, member_token = _make_member(client, admin_token)
    r = client.post(
        f"/api/admin/users/{uid}/password",
        json={"mode": "temp"},
        headers=auth(member_token),
    )
    assert r.status_code == 403


def test_admin_cannot_reset_own_password_here(client, admin):
    admin_token, admin_user = admin
    r = client.post(
        f"/api/admin/users/{admin_user['id']}/password",
        json={"mode": "temp"},
        headers=auth(admin_token),
    )
    assert r.status_code == 400
