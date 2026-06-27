"""Token robustness, login rate-limiting, and suspended-account auth."""
from conftest import auth, register

from app.security import decode_token


def test_decode_token_never_raises_on_malformed_input():
    # Regression: a token with non-ASCII chars made _sign().encode("ascii") raise
    # UnicodeEncodeError, which (unguarded in the request-logging middleware) became
    # an uncaught 500. decode_token must swallow every malformed token and return None.
    for bad in ["é.é.é", "☃.☃.☃", "ÿ.ÿ.ÿ", "a.b.c", "garbage", "", "...", "x.y"]:
        assert decode_token(bad) is None, f"{bad!r} should decode to None"


def test_malformed_bearer_token_is_401(client):
    # The middleware decodes the token before the route does; a bad token must not
    # blow up either layer -- it should be a clean 401 (an ASCII token httpx can send).
    for bad in ["a.b.c", "garbage", "x.y.z"]:
        r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {bad}"})
        assert r.status_code == 401, f"{bad!r} -> {r.status_code}"


def test_login_rate_limited_after_10_failures(client, admin):
    bad = {"identifier": "admin", "password": "wrong"}
    for _ in range(10):
        assert client.post("/api/auth/login", json=bad).status_code == 401
    assert client.post("/api/auth/login", json=bad).status_code == 429


def test_successful_login_resets_the_limiter(client, admin):
    bad = {"identifier": "admin", "password": "wrong"}
    for _ in range(9):
        client.post("/api/auth/login", json=bad)
    good = client.post("/api/auth/login", json={"identifier": "admin", "password": "password123"})
    assert good.status_code == 200  # a correct login clears the IP's failures...
    assert client.post("/api/auth/login", json=bad).status_code == 401  # ...so this is 401, not 429


def test_suspended_user_cannot_auth_or_login(client, admin):
    admin_token, _ = admin
    code = client.post("/api/invites", json={"expires_in_minutes": 60}, headers=auth(admin_token)).json()["code"]
    reg = register(client, "bob", invite=code).json()
    btoken, bob_id = reg["access_token"], reg["user"]["id"]

    susp = client.patch(f"/api/admin/users/{bob_id}", json={"is_active": False}, headers=auth(admin_token))
    assert susp.status_code == 200, susp.text

    assert client.get("/api/auth/me", headers=auth(btoken)).status_code == 401  # token rejected
    assert client.post("/api/auth/login", json={"identifier": "bob", "password": "password123"}).status_code == 403
