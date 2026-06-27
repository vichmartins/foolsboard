"""Avatar upload size cap + password-change rate limiting."""
import io

from conftest import auth


def test_avatar_upload_rejects_oversized_file(client, admin):
    token, _ = admin
    big = b"\x00" * (5 * 1024 * 1024 + 16)  # just over the 5 MB cap
    r = client.post(
        "/api/auth/me/avatar",
        files={"file": ("big.png", io.BytesIO(big), "image/png")},
        headers=auth(token),
    )
    assert r.status_code == 413, r.text


def test_password_change_wrong_current_is_rate_limited(client, admin):
    token, _ = admin
    body = {"current_password": "wrong-guess", "new_password": "brand-new-pass"}
    # The limiter allows 5 failures; the 6th attempt is blocked.
    for _ in range(5):
        r = client.patch("/api/auth/me/password", json=body, headers=auth(token))
        assert r.status_code == 400, r.text
    blocked = client.patch("/api/auth/me/password", json=body, headers=auth(token))
    assert blocked.status_code == 429, blocked.text


def test_correct_password_change_succeeds_and_clears_limiter(client, admin):
    token, _ = admin
    for _ in range(3):  # a few wrong guesses first
        client.patch(
            "/api/auth/me/password",
            json={"current_password": "nope", "new_password": "irrelevant1"},
            headers=auth(token),
        )
    ok = client.patch(
        "/api/auth/me/password",
        json={"current_password": "password123", "new_password": "newpassword1"},
        headers=auth(token),
    )
    assert ok.status_code == 204, ok.text
