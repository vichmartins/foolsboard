"""Board endpoints, scoped to the authenticated owner."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..audit import log_event
from ..database import get_db
from ..deps import can_access_board, get_current_user
from ..models import Asset, Board, Edge, Folder, Node, Share, User
from ..schemas import (
    AssetOut,
    BoardAbsorb,
    BoardCreate,
    BoardGraph,
    BoardMove,
    BoardOut,
    BoardReorder,
    BoardUpdate,
    GalleryBoardOut,
    GalleryOut,
)
from ..storage import storage
from .assets import gc_orphan_files

router = APIRouter(prefix="/api/boards", tags=["boards"])


def _get_board(board_id: UUID, db: Session, user: User) -> Board:
    """Owner-only access (rename/delete/move/share/export)."""
    board = db.get(Board, board_id)
    if board is None or board.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Board not found")
    return board


def _get_accessible_board(board_id: UUID, db: Session, user: User) -> Board:
    """Owner or accepted collaborator (view/edit)."""
    board = db.get(Board, board_id)
    if board is None or not can_access_board(board, user, db):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Board not found")
    return board


def _accessible_boards(db: Session, user: User) -> list[Board]:
    """Every board the user can open: owned + accepted shares (direct or via a
    shared folder)."""
    owned = list(db.scalars(select(Board).where(Board.owner_id == user.id)))
    board_ids = set(
        db.scalars(
            select(Share.board_id).where(
                Share.shared_with_id == user.id,
                Share.status == "accepted",
                Share.board_id.is_not(None),
            )
        )
    )
    folder_ids = set(
        db.scalars(
            select(Share.folder_id).where(
                Share.shared_with_id == user.id,
                Share.status == "accepted",
                Share.folder_id.is_not(None),
            )
        )
    )
    conds = []
    if board_ids:
        conds.append(Board.id.in_(board_ids))
    if folder_ids:
        conds.append(Board.folder_id.in_(folder_ids))
    shared = (
        list(db.scalars(select(Board).where(Board.owner_id != user.id, or_(*conds))))
        if conds
        else []
    )
    return owned + shared


def _board_out(
    board: Board, user: User, db: Session, owner_names: dict, shared_out_ids: set
) -> BoardOut:
    item = BoardOut.model_validate(board)
    if board.owner_id != user.id:
        item.shared = True
        if board.owner_id not in owner_names:
            owner = db.get(User, board.owner_id)
            owner_names[board.owner_id] = owner.username if owner else None
        item.owner_name = owner_names[board.owner_id]
    elif board.id in shared_out_ids:
        item.shared_out = True  # I own it and it's shared with someone
    return item


@router.get("", response_model=list[BoardOut])
def list_boards(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[BoardOut]:
    owned = list(
        db.scalars(
            select(Board)
            .where(Board.owner_id == user.id)
            .order_by(Board.position.asc(), Board.created_at.desc())
        )
    )
    # Boards shared with the caller: directly, or via a shared folder.
    board_ids = set(
        db.scalars(
            select(Share.board_id).where(
                Share.shared_with_id == user.id,
                Share.status == "accepted",
                Share.board_id.is_not(None),
            )
        )
    )
    folder_ids = set(
        db.scalars(
            select(Share.folder_id).where(
                Share.shared_with_id == user.id,
                Share.status == "accepted",
                Share.folder_id.is_not(None),
            )
        )
    )
    shared: list[Board] = []
    conds = []
    if board_ids:
        conds.append(Board.id.in_(board_ids))
    if folder_ids:
        conds.append(Board.folder_id.in_(folder_ids))
    if conds:
        shared = list(
            db.scalars(select(Board).where(Board.owner_id != user.id, or_(*conds)))
        )
    shared.sort(key=lambda b: b.name.lower())
    # Boards I own that I've shared out (live invites) -> crown badge.
    shared_out_ids = set(
        db.scalars(
            select(Share.board_id).where(
                Share.owner_id == user.id,
                Share.board_id.is_not(None),
                Share.status.in_(["pending", "accepted"]),
            )
        )
    )
    result = [*owned, *shared]
    # Accepted collaborators per board (owner + sharees, shared directly or via a
    # folder) -> used for the live presence dots.
    members: dict = {b.id: {b.owner_id} for b in result}
    boards_by_folder: dict = {}
    for b in result:
        if b.folder_id is not None:
            boards_by_folder.setdefault(b.folder_id, []).append(b.id)
    conds = []
    if result:
        conds.append(Share.board_id.in_([b.id for b in result]))
    if boards_by_folder:
        conds.append(Share.folder_id.in_(list(boards_by_folder)))
    if conds:
        rows = db.execute(
            select(Share.board_id, Share.folder_id, Share.shared_with_id).where(
                Share.status == "accepted", or_(*conds)
            )
        ).all()
        for board_id, folder_id, uid in rows:
            if board_id is not None and board_id in members:
                members[board_id].add(uid)
            elif folder_id is not None:
                for bid in boards_by_folder.get(folder_id, []):
                    members[bid].add(uid)

    owner_names: dict = {}
    outs = []
    for b in result:
        item = _board_out(b, user, db, owner_names, shared_out_ids)
        item.member_ids = list(members.get(b.id, {b.owner_id}))
        outs.append(item)
    return outs


@router.get("/gallery", response_model=GalleryOut)
def board_gallery(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> GalleryOut:
    """Every accessible board with its nodes, edges, and assets -- powers the
    workspace-wide Gallery (browse/search across boards without switching).

    Fetched in a constant 3 queries (nodes, edges, assets) across all accessible
    boards and grouped in Python -- not 3 queries per board, which scaled with
    the user's entire workspace."""
    boards = _accessible_boards(db, user)
    board_ids = [b.id for b in boards]
    if not board_ids:
        return GalleryOut(boards=[])

    nodes_by_board: dict[UUID, list[Node]] = {bid: [] for bid in board_ids}
    for n in db.scalars(select(Node).where(Node.board_id.in_(board_ids))):
        nodes_by_board[n.board_id].append(n)

    edges_by_board: dict[UUID, list[Edge]] = {bid: [] for bid in board_ids}
    for e in db.scalars(select(Edge).where(Edge.board_id.in_(board_ids))):
        edges_by_board[e.board_id].append(e)

    # Map node -> board so assets (queried by node_id) can be grouped per board.
    node_board = {n.id: n.board_id for ns in nodes_by_board.values() for n in ns}
    assets_by_board: dict[UUID, list[AssetOut]] = {bid: [] for bid in board_ids}
    if node_board:
        for a in db.scalars(
            select(Asset)
            .where(Asset.node_id.in_(list(node_board)))
            .order_by(Asset.created_at.desc())
        ):
            bid = node_board.get(a.node_id)
            if bid is None:
                continue
            item = AssetOut.model_validate(a)
            item.url = storage.url_for(a.storage_key)
            if a.thumbnail_key:
                item.thumbnail_url = storage.url_for(a.thumbnail_key)
            assets_by_board[bid].append(item)

    out = [
        GalleryBoardOut(
            id=b.id, name=b.name, folder_id=b.folder_id,
            nodes=nodes_by_board[b.id], edges=edges_by_board[b.id],
            assets=assets_by_board[b.id],
        )
        for b in boards
    ]
    return GalleryOut(boards=out)


@router.post("", response_model=BoardOut, status_code=status.HTTP_201_CREATED)
def create_board(
    payload: BoardCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> Board:
    if payload.folder_id is not None:
        folder = db.get(Folder, payload.folder_id)
        if folder is None or folder.owner_id != user.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Folder not found")
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
) -> BoardOut:
    board = _get_accessible_board(board_id, db, user)
    return _board_out(board, user, db, {})


@router.get("/{board_id}/graph", response_model=BoardGraph)
def get_board_graph(
    board_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> BoardGraph:
    board = _get_accessible_board(board_id, db, user)
    nodes = list(db.scalars(select(Node).where(Node.board_id == board_id)))
    edges = list(db.scalars(select(Edge).where(Edge.board_id == board_id)))
    return BoardGraph(board=board, nodes=nodes, edges=edges)


@router.get("/{board_id}/assets", response_model=list[AssetOut])
def list_board_assets(
    board_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[AssetOut]:
    """Every media asset attached to any node on the board (for the gallery)."""
    _get_accessible_board(board_id, db, user)
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


@router.post("/{board_id}/copy", response_model=BoardOut, status_code=status.HTTP_201_CREATED)
def copy_board(
    board_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> BoardOut:
    """Make a private, unshared copy of a board the caller can access (the whole
    graph + media is duplicated into a new board owned by them)."""
    src = _get_accessible_board(board_id, db, user)
    min_pos = db.scalar(select(func.min(Board.position)).where(Board.owner_id == user.id))
    position = (min_pos - 1) if min_pos is not None else 0
    new = Board(
        owner_id=user.id,
        name=f"{src.name} (copy)",
        description=src.description,
        position=position,
        folder_id=None,
    )
    db.add(new)
    db.flush()
    src_nodes = list(db.scalars(select(Node).where(Node.board_id == src.id)))
    # Fetch all source assets in one query and group by node, instead of a query
    # per node (N+1) while copying.
    assets_by_node: dict[UUID, list[Asset]] = {}
    src_node_ids = [n.id for n in src_nodes]
    if src_node_ids:
        for a in db.scalars(select(Asset).where(Asset.node_id.in_(src_node_ids))):
            assets_by_node.setdefault(a.node_id, []).append(a)
    id_map: dict = {}
    for n in src_nodes:
        nn = Node(
            board_id=new.id, type=n.type, title=n.title, content=n.content,
            x=n.x, y=n.y, width=n.width, height=n.height, color=n.color,
        )
        db.add(nn)
        db.flush()
        id_map[n.id] = nn.id
        # Reference the same stored files (dedup-safe) on the copied node.
        for a in assets_by_node.get(n.id, []):
            db.add(Asset(
                node_id=nn.id, kind=a.kind, filename=a.filename, content_type=a.content_type,
                size=a.size, storage_key=a.storage_key, thumbnail_key=a.thumbnail_key,
                processing=False, content_hash=a.content_hash,
            ))
    for e in db.scalars(select(Edge).where(Edge.board_id == src.id)):
        s = id_map.get(e.source_id)
        t = id_map.get(e.target_id)
        if s and t:
            db.add(Edge(board_id=new.id, source_id=s, target_id=t, label=e.label, data=e.data))
    db.commit()
    db.refresh(new)
    log_event(db, user=user, action="board.copy", entity_type="board", entity_id=new.id,
              summary=f"made a private copy of “{src.name}”")
    return _board_out(new, user, db, {})


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
    # Shift the moved objects clear of whatever is already on the target board,
    # so they don't land on top of existing content.
    existing = list(
        db.scalars(
            select(Node).where(Node.board_id == target.id, Node.id.notin_(moved_ids))
        )
    )
    dx = 0.0
    if existing:
        existing_max_x = max(n.x + (n.width or 220.0) for n in existing)
        moved_min_x = min(n.x for n in nodes)
        dx = max(0.0, existing_max_x + 80.0 - moved_min_x)
    for n in nodes:
        n.board_id = target.id
        n.x += dx
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


@router.patch("/{board_id}/folder", response_model=BoardOut)
def move_board_to_folder(
    board_id: UUID,
    payload: BoardMove,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Board:
    board = _get_board(board_id, db, user)
    if payload.folder_id is not None:
        folder = db.get(Folder, payload.folder_id)
        if folder is None or folder.owner_id != user.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Folder not found")
    board.folder_id = payload.folder_id
    db.commit()
    db.refresh(board)
    log_event(
        db, user=user, action="board.move", entity_type="board", entity_id=board.id,
        summary="moved board to a folder" if payload.folder_id else "removed board from its folder",
    )
    return board


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
    # Collect the board's media keys before the cascade wipes the asset rows,
    # then GC any file no longer referenced (dedup-safe -- see gc_orphan_files).
    node_ids = list(db.scalars(select(Node.id).where(Node.board_id == board.id)))
    keys = (
        {
            (a.storage_key, a.thumbnail_key)
            for a in db.scalars(select(Asset).where(Asset.node_id.in_(node_ids)))
        }
        if node_ids
        else set()
    )
    db.delete(board)
    db.commit()
    gc_orphan_files(db, keys)
    log_event(
        db, user=user, action="board.delete", entity_type="board",
        entity_id=bid, summary=f"deleted board “{name}”",
    )
