"""Node endpoints, scoped under a board the caller owns."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import log_event
from ..database import get_db
from ..deps import get_current_user, get_owned_board
from ..models import Asset, Board, Node, User
from ..schemas import NodeCreate, NodeOut, NodeUpdate
from .assets import gc_orphan_files

router = APIRouter(prefix="/api/boards/{board_id}/nodes", tags=["nodes"])


def _get_node(board_id: UUID, node_id: UUID, db: Session) -> Node:
    node = db.get(Node, node_id)
    if node is None or node.board_id != board_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Node not found")
    return node


@router.get("", response_model=list[NodeOut])
def list_nodes(
    board: Board = Depends(get_owned_board), db: Session = Depends(get_db)
) -> list[Node]:
    return list(db.scalars(select(Node).where(Node.board_id == board.id)))


@router.post("", response_model=NodeOut, status_code=status.HTTP_201_CREATED)
def create_node(
    payload: NodeCreate,
    board: Board = Depends(get_owned_board),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Node:
    node = Node(board_id=board.id, **payload.model_dump())
    db.add(node)
    db.commit()
    db.refresh(node)
    log_event(db, user=user, action="object.create", entity_type="object", entity_id=node.id,
              summary=f"added an object to “{board.name}”")
    return node


@router.get("/{node_id}", response_model=NodeOut)
def get_node(
    node_id: UUID, board: Board = Depends(get_owned_board), db: Session = Depends(get_db)
) -> Node:
    return _get_node(board.id, node_id, db)


@router.patch("/{node_id}", response_model=NodeOut)
def update_node(
    node_id: UUID,
    payload: NodeUpdate,
    board: Board = Depends(get_owned_board),
    db: Session = Depends(get_db),
) -> Node:
    node = _get_node(board.id, node_id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(node, field, value)
    db.commit()
    # Only updated_at is server-generated (onupdate=func.now()); the rest we just
    # wrote, so reload just that column instead of re-reading the whole row
    # (content can be large, and this fires on every drag/edit).
    db.refresh(node, ["updated_at"])
    return node


@router.delete("/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_node(
    node_id: UUID,
    board: Board = Depends(get_owned_board),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    node = _get_node(board.id, node_id, db)
    # Capture the node's media keys before the cascade removes the asset rows,
    # then garbage-collect any file no longer referenced (dedup-safe).
    keys = {
        (a.storage_key, a.thumbnail_key)
        for a in db.scalars(select(Asset).where(Asset.node_id == node.id))
    }
    db.delete(node)
    db.commit()
    gc_orphan_files(db, keys)
    log_event(db, user=user, action="object.delete", entity_type="object", entity_id=node_id,
              summary=f"deleted an object from “{board.name}”")
