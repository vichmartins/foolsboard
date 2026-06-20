"""Board endpoints, scoped to the authenticated owner."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..audit import log_event
from ..database import get_db
from ..deps import get_current_user
from ..models import Asset, Board, Edge, Node, User
from ..schemas import (
    AssetOut,
    BoardAbsorb,
    BoardCreate,
    BoardGraph,
    BoardOut,
    BoardReorder,
    BoardUpdate,
)
from ..storage import storage

router = APIRouter(prefix="/api/boards", tags=["boards"])


def _get_board(board_id: UUID, db: Session, user: User) -> Board:
    board = db.get(Board, board_id)
    if board is None or board.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Board not found")
    return board


@router.get("", response_model=list[BoardOut])
def list_boards(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[Board]:
    return list(
        db.scalars(
            select(Board)
            .where(Board.owner_id == user.id)
            .order_by(Board.position.asc(), Board.created_at.desc())
        )
    )


@router.post("", response_model=BoardOut, status_code=status.HTTP_201_CREATED)
def create_board(
    payload: BoardCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> Board:
    # New boards land at the top of the list.
    min_pos = db.scalar(select(func.min(Board.position)).where(Board.owner_id == user.id))
    position = (min_pos - 1) if min_pos is not None else 0
    board = Board(owner_id=user.id, position=position, **payload.model_dump())
    db.add(board)
    db.commit()
    db.refresh(board)
    log_event(
        db, user=user, action="board.create", entity_type="board",
        entity_id=board.id, summary=f"created board “{board.name}”",
    )
    return board


@router.patch("/reorder", status_code=status.HTTP_204_NO_CONTENT)
def reorder_boards(
    payload: BoardReorder,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    # Rewrite positions to match the given order; ids not owned are ignored.
    owned = {b.id: b for b in db.scalars(select(Board).where(Board.owner_id == user.id))}
    for index, bid in enumerate(payload.board_ids):
        board = owned.get(bid)
        if board is not None:
            board.position = index
    db.commit()
    log_event(
        db, user=user, action="board.reorder",
        summary=f"reordered {len(payload.board_ids)} boards",
    )


@router.get("/{board_id}", response_model=BoardOut)
def get_board(
    board_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> Board:
    return _get_board(board_id, db, user)


@router.get("/{board_id}/graph", response_model=BoardGraph)
def get_board_graph(
    board_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> BoardGraph:
    board = _get_board(board_id, db, user)
    nodes = list(db.scalars(select(Node).where(Node.board_id == board_id)))
    edges = list(db.scalars(select(Edge).where(Edge.board_id == board_id)))
    return BoardGraph(board=board, nodes=nodes, edges=edges)


@router.get("/{board_id}/assets", response_model=list[AssetOut])
def list_board_assets(
    board_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[AssetOut]:
    """Every media asset attached to any node on the board (for the gallery)."""
    _get_board(board_id, db, user)
    node_ids = list(db.scalars(select(Node.id).where(Node.board_id == board_id)))
    if not node_ids:
        return []
    assets = db.scalars(
        select(Asset).where(Asset.node_id.in_(node_ids)).order_by(Asset.created_at.desc())
    )
    out: list[AssetOut] = []
    for a in assets:
        item = AssetOut.model_validate(a)
        item.url = storage.url_for(a.storage_key)
        if a.thumbnail_key:
            item.thumbnail_url = storage.url_for(a.thumbnail_key)
        out.append(item)
    return out


@router.post("/{board_id}/absorb", status_code=status.HTTP_204_NO_CONTENT)
def absorb_nodes(
    board_id: UUID,
    payload: BoardAbsorb,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    """Move the given objects into this board (true move: reassign board_id).
    Edges fully within the moved set come along; edges with one endpoint left
    behind are dropped (they'd cross boards). Attached media stays put."""
    target = _get_board(board_id, db, user)
    if not payload.node_ids:
        return
    nodes = list(db.scalars(select(Node).where(Node.id.in_(set(payload.node_ids)))))
    # Every node must belong to a board this user owns.
    src_board_ids = {n.board_id for n in nodes}
    owned = set(
        db.scalars(
            select(Board.id).where(Board.id.in_(src_board_ids), Board.owner_id == user.id)
        )
    )
    if any(n.board_id not in owned for n in nodes):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Object not found")

    moved_ids = {n.id for n in nodes}
    for n in nodes:
        n.board_id = target.id
    edges = list(
        db.scalars(
            select(Edge).where(
                or_(Edge.source_id.in_(moved_ids), Edge.target_id.in_(moved_ids))
            )
        )
    )
    for e in edges:
        if e.source_id in moved_ids and e.target_id in moved_ids:
            e.board_id = target.id
        else:
            db.delete(e)
    db.commit()
    log_event(
        db, user=user, action="board.absorb", entity_type="board", entity_id=target.id,
        summary=f"moved {len(moved_ids)} object(s) into “{target.name}”",
    )


@router.patch("/{board_id}", response_model=BoardOut)
def update_board(
    board_id: UUID,
    payload: BoardUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Board:
    board = _get_board(board_id, db, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(board, field, value)
    db.commit()
    db.refresh(board)
    log_event(
        db, user=user, action="board.update", entity_type="board",
        entity_id=board.id, summary=f"updated board “{board.name}”",
    )
    return board


@router.delete("/{board_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_board(
    board_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> None:
    board = _get_board(board_id, db, user)
    name = board.name
    bid = board.id
    db.delete(board)
    db.commit()
    log_event(
        db, user=user, action="board.delete", entity_type="board",
        entity_id=bid, summary=f"deleted board “{name}”",
    )
