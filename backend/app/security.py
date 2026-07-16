"""Password hashing and signed access tokens using only the standard library.

Passwords use PBKDF2-HMAC-SHA256 with a per-password random salt. Access tokens
are compact JWTs (HS256) signed with settings.jwt_secret. No third-party auth
dependencies are required.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from uuid import UUID

from .config import settings

# Unambiguous alphabet for generated temporary passwords: no 0/O, 1/I/l, so a
# user reading one off the screen can't misread it.
_TEMP_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"


def generate_temp_password(length: int = 14) -> str:
    """A random, high-entropy temporary password for an admin-issued reset.
    ~5.7 bits/char over a 54-char alphabet (~80 bits at the default length)."""
    return "".join(secrets.choice(_TEMP_ALPHABET) for _ in range(length))


# --- Password hashing -------------------------------------------------------
def hash_password(password: str) -> str:
    salt = os.urandom(16)
    iterations = settings.password_iterations
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return f"pbkdf2_sha256${iterations}${_b64(salt)}${_b64(dk)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iter_s, salt_b64, hash_b64 = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        salt = _unb64(salt_b64)
        expected = _unb64(hash_b64)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, int(iter_s))
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(dk, expected)


# --- Access tokens (compact JWT, HS256) -------------------------------------
def create_access_token(user_id: UUID) -> str:
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {"sub": str(user_id), "iat": now, "exp": now + settings.jwt_expire_minutes * 60}
    signing_input = f"{_b64url_json(header)}.{_b64url_json(payload)}"
    return f"{signing_input}.{_sign(signing_input)}"


def decode_token(token: str) -> UUID | None:
    """Return the user id if the token is valid and unexpired, else None."""
    try:
        header_b64, payload_b64, sig = token.split(".")
        # _sign() encodes as ASCII, so a token with non-ASCII characters would
        # raise UnicodeEncodeError (a ValueError) here -- keep it inside the try so
        # any malformed token yields None (a clean 401), never an uncaught 500.
        if not hmac.compare_digest(sig, _sign(f"{header_b64}.{payload_b64}")):
            return None
        payload = json.loads(_b64url_decode(payload_b64))
        if int(payload.get("exp", 0)) < int(time.time()):
            return None
        return UUID(str(payload["sub"]))
    except (ValueError, TypeError, KeyError):
        return None


# --- helpers ----------------------------------------------------------------
def _b64(raw: bytes) -> str:
    return base64.b64encode(raw).decode("ascii")


def _unb64(s: str) -> bytes:
    return base64.b64decode(s.encode("ascii"))


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_json(obj: dict) -> str:
    return _b64url(json.dumps(obj, separators=(",", ":")).encode("utf-8"))


def _b64url_decode(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def _sign(signing_input: str) -> str:
    digest = hmac.new(
        settings.jwt_secret.encode("utf-8"),
        signing_input.encode("ascii"),
        hashlib.sha256,
    ).digest()
    return _b64url(digest)
