"""Edge endpoints, scoped under a board the caller owns."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import log_event
from ..database import get_db
from ..deps import get_current_user, get_owned_board
from ..models import Board, Edge, Node, User
from ..schemas import EdgeCreate, EdgeOut, EdgeUpdate

router = APIRouter(prefix="/api/boards/{board_id}/edges", tags=["edges"])


def _get_edge(board_id: UUID, edge_id: UUID, db: Session) -> Edge:
    edge = db.get(Edge, edge_id)
    if edge is None or edge.board_id != board_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Edge not found")
    return edge


def _validate_endpoint(board_id: UUID, node_id: UUID, db: Session) -> None:
    node = db.get(Node, node_id)
    if node is None or node.board_id != board_id:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Node {node_id} does not belong to this board",
        )


@router.get("", response_model=list[EdgeOut])
def list_edges(
    board: Board = Depends(get_owned_board), db: Session = Depends(get_db)
) -> list[Edge]:
    return list(db.scalars(select(Edge).where(Edge.board_id == board.id)))


@router.post("", response_model=EdgeOut, status_code=status.HTTP_201_CREATED)
def create_edge(
    payload: EdgeCreate,
    board: Board = Depends(get_owned_board),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Edge:
    _validate_endpoint(board.id, payload.source_id, db)
    _validate_endpoint(board.id, payload.target_id, db)
    edge = Edge(board_id=board.id, **payload.model_dump())
    db.add(edge)
    db.commit()
    db.refresh(edge)
    log_event(db, user=user, action="link.create", entity_type="link", entity_id=edge.id,
              summary=f"linked two objects on “{board.name}”")
    return edge


@router.patch("/{edge_id}", response_model=EdgeOut)
def update_edge(
    edge_id: UUID,
    payload: EdgeUpdate,
    board: Board = Depends(get_owned_board),
    db: Session = Depends(get_db),
) -> Edge:
    edge = _get_edge(board.id, edge_id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(edge, field, value)
    db.commit()
    db.refresh(edge)
    return edge


@router.delete("/{edge_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_edge(
    edge_id: UUID,
    board: Board = Depends(get_owned_board),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    edge = _get_edge(board.id, edge_id, db)
    db.delete(edge)
    db.commit()
    log_event(db, user=user, action="link.delete", entity_type="link", entity_id=edge_id,
              summary=f"removed a link on “{board.name}”")
