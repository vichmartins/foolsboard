"""Invite expiry (the SQLite naive/aware datetime path) + duration validation."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from conftest import auth, register

from app.models import InviteCode


def test_expired_invite_is_rejected(client, admin, db):
    token, _ = admin
    code = client.post("/api/invites", json={"expires_in_minutes": 60}, headers=auth(token)).json()["code"]
    inv = db.scalar(select(InviteCode).where(InviteCode.code == code))
    inv.expires_at = datetime.now(timezone.utc) - timedelta(minutes=5)
    db.commit()

    r = register(client, "bob", invite=code)
    assert r.status_code == 400, r.text
    assert "expire" in r.json()["detail"].lower()


def test_unsupported_expiry_duration_rejected(client, admin):
    token, _ = admin
    r = client.post("/api/invites", json={"expires_in_minutes": 7}, headers=auth(token))
    assert r.status_code == 400, r.text
