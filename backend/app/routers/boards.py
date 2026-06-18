"""Board endpoints, including the aggregate graph load used by the canvas."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Board, Edge, Node
from ..schemas import BoardCreate, BoardGraph, BoardOut, BoardUpdate

router = APIRouter(prefix="/api/boards", tags=["boards"])


def _get_board(board_id: UUID, db: Session) -> Board:
    board = db.get(Board, board_id)
    if board is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Board not found")
    return board


@router.get("", response_model=list[BoardOut])
def list_boards(db: Session = Depends(get_db)) -> list[Board]:
    return list(db.scalars(select(Board).order_by(Board.created_at.desc())))


@router.post("", response_model=BoardOut, status_code=status.HTTP_201_CREATED)
def create_board(payload: BoardCreate, db: Session = Depends(get_db)) -> Board:
    board = Board(**payload.model_dump())
    db.add(board)
    db.commit()
    db.refresh(board)
    return board


@router.get("/{board_id}", response_model=BoardOut)
def get_board(board_id: UUID, db: Session = Depends(get_db)) -> Board:
    return _get_board(board_id, db)


@router.get("/{board_id}/graph", response_model=BoardGraph)
def get_board_graph(board_id: UUID, db: Session = Depends(get_db)) -> BoardGraph:
    board = _get_board(board_id, db)
    nodes = list(db.scalars(select(Node).where(Node.board_id == board_id)))
    edges = list(db.scalars(select(Edge).where(Edge.board_id == board_id)))
    return BoardGraph(board=board, nodes=nodes, edges=edges)


@router.patch("/{board_id}", response_model=BoardOut)
def update_board(
    board_id: UUID, payload: BoardUpdate, db: Session = Depends(get_db)
) -> Board:
    board = _get_board(board_id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(board, field, value)
    db.commit()
    db.refresh(board)
    return board


@router.delete("/{board_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_board(board_id: UUID, db: Session = Depends(get_db)) -> None:
    board = _get_board(board_id, db)
    db.delete(board)
    db.commit()
