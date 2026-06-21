"""Sharing: grant another user access to a board or folder. The recipient gets a
pending share and accepts or rejects it; only accepted shares grant access."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..audit import log_event
from ..database import get_db
from ..deps import get_current_user
from ..models import Board, Folder, Share, User
from ..realtime import hub
from ..schemas import ShareCreate, ShareOut, ShareUserOut

router = APIRouter(prefix="/api/shares", tags=["shares"])


def _notify(target_id: UUID, action: str, share: Share, db: Session) -> None:
    """Push a live share update to a user's open tabs (recipient on a new invite,
    owner on accept/reject) so neither side has to refresh to see the change."""
    try:
        hub.notify_user(
            target_id,
            {"type": "share", "action": action, "share": _to_out(share, db).model_dump(mode="json")},
        )
    except Exception:
        pass


def _user_out(u: User | None) -> ShareUserOut | None:
    return ShareUserOut(id=u.id, username=u.username) if u else None


def _resource_name(share: Share, db: Session) -> str | None:
    if share.board_id:
        b = db.get(Board, share.board_id)
        return b.name if b else None
    if share.folder_id:
        f = db.get(Folder, share.folder_id)
        return f.name if f else None
    return None


def _to_out(share: Share, db: Session) -> ShareOut:
    return ShareOut(
        id=share.id,
        resource_type="board" if share.board_id else "folder",
        board_id=share.board_id,
        folder_id=share.folder_id,
        resource_name=_resource_name(share, db),
        status=share.status,
        permission=share.permission,
        owner=_user_out(db.get(User, share.owner_id)),
        shared_with=_user_out(db.get(User, share.shared_with_id)),
        created_at=share.created_at,
    )


@router.post("", response_model=ShareOut, status_code=status.HTTP_201_CREATED)
def create_share(
    payload: ShareCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> ShareOut:
    if bool(payload.board_id) == bool(payload.folder_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Share exactly one board or folder")
    # The caller must own the resource being shared.
    if payload.board_id is not None:
        board = db.get(Board, payload.board_id)
        if board is None or board.owner_id != user.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Board not found")
    else:
        folder = db.get(Folder, payload.folder_id)
        if folder is None or folder.owner_id != user.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Folder not found")

    ident = payload.recipient.strip().lower()
    recipient = db.scalar(
        select(User).where(
            or_(func.lower(User.username) == ident, func.lower(User.email) == ident)
        )
    )
    if recipient is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No user with that username or email")
    if recipient.id == user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You can’t share with yourself")

    existing = db.scalar(
        select(Share).where(
            Share.shared_with_id == recipient.id,
            Share.board_id == payload.board_id,
            Share.folder_id == payload.folder_id,
        )
    )
    if existing is not None:
        # Re-offer a share the recipient previously rejected or let lapse.
        if existing.status in ("rejected", "lapsed"):
            existing.status = "pending"
            db.commit()
            db.refresh(existing)
        if existing.status == "pending":
            _notify(existing.shared_with_id, "incoming", existing, db)
        _notify(existing.owner_id, "outgoing", existing, db)  # owner: refresh crown badge
        return _to_out(existing, db)

    share = Share(
        owner_id=user.id,
        shared_with_id=recipient.id,
        board_id=payload.board_id,
        folder_id=payload.folder_id,
    )
    db.add(share)
    db.commit()
    db.refresh(share)
    _notify(share.shared_with_id, "incoming", share, db)
    _notify(share.owner_id, "outgoing", share, db)  # owner: refresh crown badge
    kind = "board" if payload.board_id else "folder"
    log_event(db, user=user, action="share.create", entity_type="share", entity_id=share.id,
              summary=f"shared a {kind} with {recipient.username}")
    return _to_out(share, db)


@router.get("/incoming", response_model=list[ShareOut])
def list_incoming(
    state: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ShareOut]:
    q = select(Share).where(Share.shared_with_id == user.id)
    if state:
        q = q.where(Share.status == state)
    shares = list(db.scalars(q.order_by(Share.created_at.desc())))
    return [_to_out(s, db) for s in shares]


@router.get("/outgoing", response_model=list[ShareOut])
def list_outgoing(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[ShareOut]:
    shares = list(
        db.scalars(select(Share).where(Share.owner_id == user.id).order_by(Share.created_at.desc()))
    )
    return [_to_out(s, db) for s in shares]


@router.post("/{share_id}/accept", response_model=ShareOut)
def accept_share(
    share_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> ShareOut:
    share = db.get(Share, share_id)
    if share is None or share.shared_with_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Share not found")
    share.status = "accepted"
    db.commit()
    db.refresh(share)
    _notify(share.owner_id, "updated", share, db)
    log_event(db, user=user, action="share.accept", entity_type="share", entity_id=share.id,
              summary="accepted a share")
    return _to_out(share, db)


@router.post("/{share_id}/reject", status_code=status.HTTP_204_NO_CONTENT)
def reject_share(
    share_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> None:
    share = db.get(Share, share_id)
    if share is None or share.shared_with_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Share not found")
    share.status = "rejected"
    db.commit()
    db.refresh(share)
    _notify(share.owner_id, "updated", share, db)


@router.post("/{share_id}/no_response", status_code=status.HTTP_204_NO_CONTENT)
def lapse_share(
    share_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> None:
    """The recipient let the invite's countdown run out without deciding. Distinct
    from a reject -- the owner sees "No response". Only applies while still pending
    (an accept/reject in another tab wins)."""
    share = db.get(Share, share_id)
    if share is None or share.shared_with_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Share not found")
    if share.status == "pending":
        share.status = "lapsed"
        db.commit()
        db.refresh(share)
        _notify(share.owner_id, "updated", share, db)


@router.delete("/by-board/{board_id}", status_code=status.HTTP_204_NO_CONTENT)
def unshare_board(
    board_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> None:
    """Stop sharing a board without needing a share id. The owner removes every
    share of it; a recipient removes only their own access ("leave"). Either way
    the other parties get a live update."""
    board = db.get(Board, board_id)
    if board is not None and board.owner_id == user.id:
        shares = list(
            db.scalars(select(Share).where(Share.board_id == board_id, Share.owner_id == user.id))
        )
    else:
        shares = list(
            db.scalars(
                select(Share).where(
                    Share.board_id == board_id, Share.shared_with_id == user.id
                )
            )
        )
    notify: list[tuple] = []
    for s in shares:
        other_id = s.shared_with_id if s.owner_id == user.id else s.owner_id
        notify.append((other_id, _to_out(s, db).model_dump(mode="json")))
        db.delete(s)
    db.commit()
    for other_id, payload in notify:
        try:
            hub.notify_user(other_id, {"type": "share", "action": "removed", "share": payload})
        except Exception:
            pass


@router.delete("/{share_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_share(
    share_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> None:
    # The owner can revoke; the recipient can leave (remove their own access).
    share = db.get(Share, share_id)
    if share is None or (share.owner_id != user.id and share.shared_with_id != user.id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Share not found")
    # Tell the other party (their share list/banner refreshes) before it's gone.
    other_id = share.shared_with_id if share.owner_id == user.id else share.owner_id
    payload = _to_out(share, db).model_dump(mode="json")
    db.delete(share)
    db.commit()
    try:
        hub.notify_user(other_id, {"type": "share", "action": "removed", "share": payload})
    except Exception:
        pass
