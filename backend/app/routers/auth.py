"""Authentication: register (invite-gated after the first user), login, and the
current user's profile / password / avatar management."""
from __future__ import annotations

import io
import json
import random
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session

from ..audit import log_event
from ..database import get_db
from ..deps import get_current_user
from ..models import Board, InviteCode, User
from ..ratelimit import login_limiter, password_change_limiter
from ..realtime import PALETTE, hub
from ..schemas import (
    CategoriesPayload,
    ColorsOut,
    ColorUpdate,
    CompleteResetIn,
    LastBoardIn,
    LoginIn,
    PasswordUpdate,
    ProfileUpdate,
    RegisterIn,
    SetupStatus,
    Token,
    UserOut,
)
from ..security import create_access_token, hash_password, verify_password
from ..storage import storage

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Avatars get downscaled to 256px anyway, so anything beyond a few MB is just an
# upload to reject before we hand the bytes to Pillow.
MAX_AVATAR_BYTES = 5 * 1024 * 1024


def _user_out(user: User) -> UserOut:
    out = UserOut.model_validate(user)
    if user.avatar_key:
        out.avatar_url = storage.url_for(user.avatar_key)
    return out


def _assign_color(db: Session) -> str:
    """Pick a random collaborator color not already used by another user (falls
    back to any palette color once all are taken)."""
    taken = {c for c in db.scalars(select(User.color).where(User.color.is_not(None)))}
    available = [c for c in PALETTE if c not in taken]
    return random.choice(available) if available else random.choice(PALETTE)


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterIn, db: Session = Depends(get_db)) -> Token:
    is_first = db.scalar(select(func.count()).select_from(User)) == 0

    invite: InviteCode | None = None
    if not is_first:
        code = (payload.invite_code or "").strip()
        if not code:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "An invite code is required")
        invite = db.scalar(
            select(InviteCode).where(
                InviteCode.code == code, InviteCode.used_by_id.is_(None)
            )
        )
        if invite is None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "Invalid or already-used invite code"
            )
        if invite.expires_at is not None:
            # SQLite returns naive datetimes; treat a stored value as UTC so the
            # comparison works across backends (Postgres returns it tz-aware).
            exp = invite.expires_at
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp <= datetime.now(timezone.utc):
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "This invite code has expired")

    if db.scalar(select(User).where(User.email == payload.email)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "That email is already registered")
    if db.scalar(select(User).where(User.username == payload.username)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "That username is taken")

    user = User(
        email=payload.email,
        username=payload.username,
        password_hash=hash_password(payload.password),
        is_admin=is_first,
        color=_assign_color(db),
    )
    db.add(user)
    db.flush()  # assign user.id

    if invite is not None:
        invite.used_by_id = user.id
        invite.used_at = datetime.now(timezone.utc)
    if is_first:
        # The first account claims any boards that pre-date the auth system.
        db.execute(update(Board).where(Board.owner_id.is_(None)).values(owner_id=user.id))

    db.commit()
    db.refresh(user)
    log_event(db, user=user, action="auth.register", summary=f"registered {user.username}")
    return Token(access_token=create_access_token(user.id), user=_user_out(user))


@router.post("/login", response_model=Token)
def login(payload: LoginIn, request: Request, db: Session = Depends(get_db)) -> Token:
    ip = request.client.host if request.client else "unknown"
    if login_limiter.is_blocked(ip):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Too many login attempts. Please wait a few minutes and try again.",
        )
    ident = payload.identifier.strip()
    user = db.scalar(
        select(User).where(or_(User.email == ident.lower(), User.username == ident))
    )
    if user is None or not verify_password(payload.password, user.password_hash):
        login_limiter.record(ip)  # only failures count toward the limit
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Incorrect username/email or password"
        )
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your account has been suspended")
    # A temporary (admin-issued) password stops working past its expiry, so a
    # forgotten reset can't linger. The password is validated above; here we only
    # gate on the clock. Once the user sets a real password (complete_reset) this
    # timestamp is cleared, which is what makes the temp password single-use.
    if user.temp_password_expires_at is not None:
        exp = user.temp_password_expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)  # SQLite returns naive UTC
        if exp <= datetime.now(timezone.utc):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "This temporary password has expired. Ask an admin to issue a new one.",
            )
    login_limiter.reset(ip)  # a successful sign-in clears the IP's failures
    log_event(db, user=user, action="auth.login", summary="signed in")
    return Token(access_token=create_access_token(user.id), user=_user_out(user))


@router.get("/setup", response_model=SetupStatus)
def setup_status(db: Session = Depends(get_db)) -> SetupStatus:
    """Public: whether this instance has no accounts yet. The login screen uses
    this to offer a first-run "create the admin account" flow instead of sign-in."""
    return SetupStatus(needs_setup=db.scalar(select(func.count()).select_from(User)) == 0)


@router.post("/me/complete-reset", response_model=Token)
def complete_reset(
    payload: CompleteResetIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Token:
    """A user flagged must_change_password (after an admin reset) sets their own
    new password. No current password is required — they're already authenticated
    by their bearer token, having just signed in with a temporary or admin-set
    password. Only valid while a change is actually pending, so this can't be used
    to bypass the normal current-password check."""
    if not user.must_change_password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No password reset is pending")
    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    user.temp_password_expires_at = None  # retires any temporary password
    db.commit()
    db.refresh(user)
    log_event(db, user=user, action="auth.reset_complete", summary="set a new password")
    # Re-issue a token so the client keeps a clean, valid session afterward.
    return Token(access_token=create_access_token(user.id), user=_user_out(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    log_event(db, user=user, action="auth.logout", summary="signed out")


@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)) -> UserOut:
    return _user_out(user)


@router.get("/me/categories", response_model=CategoriesPayload)
def get_categories(user: User = Depends(get_current_user)) -> CategoriesPayload:
    """The user's explorer layout (categories + their member folder/board ids)."""
    if not user.categories:
        return CategoriesPayload()
    try:
        return CategoriesPayload.model_validate(json.loads(user.categories))
    except (ValueError, TypeError):
        return CategoriesPayload()


@router.put("/me/categories", response_model=CategoriesPayload)
def set_categories(
    payload: CategoriesPayload,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CategoriesPayload:
    user.categories = payload.model_dump_json()
    db.commit()
    return payload


@router.put("/me/last-board", status_code=status.HTTP_204_NO_CONTENT)
def set_last_board(
    payload: LastBoardIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Remember the board the user last opened, so a new browser / cleared cache
    reopens it instead of falling back to the first board."""
    user.last_board_id = payload.board_id
    db.commit()


@router.get("/colors", response_model=ColorsOut)
def list_colors(user: User = Depends(get_current_user)) -> ColorsOut:
    """The pickable palette + the caller's current color. Any color may be chosen;
    collisions are resolved per-viewer on the client."""
    return ColorsOut(palette=PALETTE, current=user.color)


@router.patch("/me/color", response_model=UserOut)
def update_color(
    payload: ColorUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserOut:
    color = payload.color.strip().lower()
    if color not in PALETTE:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That isn’t a selectable color")
    # No uniqueness check: anyone can pick any color; collisions are disambiguated
    # client-side (each viewer sees a clashing collaborator in a different color).
    user.color = color
    db.commit()
    db.refresh(user)
    hub.set_user_color(user.id, color)  # recolor live cursors/highlights
    return _user_out(user)


@router.patch("/me", response_model=UserOut)
def update_me(
    payload: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserOut:
    if payload.email is not None:
        email = payload.email.strip().lower()
        if "@" not in email:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Enter a valid email address")
        if db.scalar(select(User).where(User.email == email, User.id != user.id)):
            raise HTTPException(status.HTTP_409_CONFLICT, "That email is already registered")
        user.email = email
    if payload.username is not None:
        username = payload.username.strip()
        if len(username) < 2:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Username is too short")
        if db.scalar(select(User).where(User.username == username, User.id != user.id)):
            raise HTTPException(status.HTTP_409_CONFLICT, "That username is taken")
        user.username = username
    db.commit()
    db.refresh(user)
    return _user_out(user)


@router.patch("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def update_password(
    payload: PasswordUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    key = str(user.id)
    if password_change_limiter.is_blocked(key):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Too many password-change attempts. Please wait a few minutes and try again.",
        )
    if not verify_password(payload.current_password, user.password_hash):
        password_change_limiter.record(key)  # only wrong guesses count
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
    password_change_limiter.reset(key)  # a correct current password clears the counter
    user.password_hash = hash_password(payload.new_password)
    db.commit()


@router.post("/me/avatar", response_model=UserOut)
def upload_avatar(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserOut:
    from PIL import Image, UnidentifiedImageError

    # Cap the raw upload: read one byte past the limit and bail if we got it. This
    # bounds memory before Pillow touches the data (the pixel-count bomb guard
    # below is a second line of defence against small-but-huge-canvas images).
    data = file.file.read(MAX_AVATAR_BYTES + 1)
    if len(data) > MAX_AVATAR_BYTES:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            "Avatar image is too large (max 5 MB).",
        )

    try:
        # MAX_IMAGE_PIXELS is set process-wide in compression.py, so an oversized
        # "decompression bomb" raises here instead of exhausting memory.
        img = Image.open(io.BytesIO(data)).convert("RGB")
        img.thumbnail((256, 256))
        buf = io.BytesIO()
        img.save(buf, format="WEBP", quality=82)
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That image could not be read")
    buf.seek(0)

    old_key = user.avatar_key
    user.avatar_key = storage.save(buf, "avatar.webp")
    db.commit()
    db.refresh(user)
    if old_key:
        storage.delete(old_key)
    return _user_out(user)


@router.delete("/me/avatar", response_model=UserOut)
def delete_avatar(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> UserOut:
    old_key = user.avatar_key
    user.avatar_key = None
    db.commit()
    db.refresh(user)
    if old_key:
        storage.delete(old_key)
    return _user_out(user)
