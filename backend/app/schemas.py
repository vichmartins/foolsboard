"""Pydantic request/response models.

These define the API contract and validate every payload independently of the
ORM. `from_attributes=True` lets us return ORM objects directly.
"""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- Board ------------------------------------------------------------------
class BoardCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None


class BoardUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None


class BoardOut(ORMModel):
    id: UUID
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime


# --- Node -------------------------------------------------------------------
class NodeCreate(BaseModel):
    type: str = Field(default="note", max_length=50)
    title: str = Field(default="", max_length=300)
    content: dict = Field(default_factory=dict)
    x: float = 0.0
    y: float = 0.0
    width: float | None = None
    height: float | None = None
    color: str | None = Field(default=None, max_length=20)


class NodeUpdate(BaseModel):
    type: str | None = Field(default=None, max_length=50)
    title: str | None = Field(default=None, max_length=300)
    content: dict | None = None
    x: float | None = None
    y: float | None = None
    width: float | None = None
    height: float | None = None
    color: str | None = Field(default=None, max_length=20)


class NodeOut(ORMModel):
    id: UUID
    board_id: UUID
    type: str
    title: str
    content: dict
    x: float
    y: float
    width: float | None
    height: float | None
    color: str | None
    created_at: datetime
    updated_at: datetime


# --- Edge -------------------------------------------------------------------
class EdgeCreate(BaseModel):
    source_id: UUID
    target_id: UUID
    label: str | None = Field(default=None, max_length=300)
    data: dict = Field(default_factory=dict)


class EdgeUpdate(BaseModel):
    label: str | None = Field(default=None, max_length=300)
    data: dict | None = None


class EdgeOut(ORMModel):
    id: UUID
    board_id: UUID
    source_id: UUID
    target_id: UUID
    label: str | None
    data: dict
    created_at: datetime
    updated_at: datetime


# --- Asset ------------------------------------------------------------------
class AssetOut(ORMModel):
    id: UUID
    node_id: UUID
    kind: str
    filename: str
    content_type: str
    size: int
    storage_key: str
    processing: bool
    created_at: datetime

    # Computed browser URLs (filled in by the router via the storage backend).
    url: str | None = None
    thumbnail_url: str | None = None


# --- Aggregate --------------------------------------------------------------
class BoardGraph(BaseModel):
    """Full board payload the frontend loads in one request."""
    board: BoardOut
    nodes: list[NodeOut]
    edges: list[EdgeOut]


# --- Auth / Users -----------------------------------------------------------
class RegisterIn(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    username: str = Field(min_length=2, max_length=60)
    password: str = Field(min_length=8, max_length=200)
    invite_code: str | None = None

    @field_validator("email")
    @classmethod
    def _email_ok(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v.rsplit("@", 1)[-1]:
            raise ValueError("Enter a valid email address")
        return v

    @field_validator("username")
    @classmethod
    def _username_ok(cls, v: str) -> str:
        return v.strip()


class LoginIn(BaseModel):
    identifier: str = Field(min_length=1)  # email or username
    password: str = Field(min_length=1)


class ProfileUpdate(BaseModel):
    email: str | None = Field(default=None, min_length=3, max_length=320)
    username: str | None = Field(default=None, min_length=2, max_length=60)


class PasswordUpdate(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=200)


class UserOut(ORMModel):
    id: UUID
    email: str
    username: str
    is_admin: bool
    is_active: bool = True
    created_at: datetime
    avatar_url: str | None = None


class AdminUserOut(ORMModel):
    id: UUID
    email: str
    username: str
    is_admin: bool
    is_active: bool
    created_at: datetime


class AdminUserUpdate(BaseModel):
    is_admin: bool | None = None
    is_active: bool | None = None


class ActivityLogOut(ORMModel):
    id: UUID
    user_id: UUID | None
    username: str | None
    action: str
    entity_type: str | None
    entity_id: UUID | None
    summary: str
    created_at: datetime


class RequestLogOut(ORMModel):
    id: UUID
    user_id: UUID | None
    method: str
    path: str
    status_code: int
    duration_ms: int
    ip: str | None
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class InviteOut(ORMModel):
    id: UUID
    code: str
    created_at: datetime
    used_by_id: UUID | None = None
    used_at: datetime | None = None
