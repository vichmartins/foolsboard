"""Pydantic request/response models.

These define the API contract and validate every payload independently of the
ORM. `from_attributes=True` lets us return ORM objects directly.
"""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


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
