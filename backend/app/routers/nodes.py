"""Node endpoints, scoped under a board the caller owns."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_owned_board
from ..models import Board, Node
from ..schemas import NodeCreate, NodeOut, NodeUpdate

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
    db: Session = Depends(get_db),
) -> Node:
    node = Node(board_id=board.id, **payload.model_dump())
    db.add(node)
    db.commit()
    db.refresh(node)
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
    db.refresh(node)
    return node


@router.delete("/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_node(
    node_id: UUID, board: Board = Depends(get_owned_board), db: Session = Depends(get_db)
) -> None:
    node = _get_node(board.id, node_id, db)
    db.delete(node)
    db.commit()
