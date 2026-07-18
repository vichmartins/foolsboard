"""Folder endpoints: organize a user's storyboards. Deleting a folder unfiles
its boards (Board.folder_id is SET NULL by the FK) rather than deleting them."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import categories_svc
from ..audit import log_event
from ..database import get_db
from ..deps import get_current_user
from ..models import Folder, Share, User
from ..schemas import FolderCreate, FolderMove, FolderOut, FolderReorder, FolderUpdate

router = APIRouter(prefix="/api/folders", tags=["folders"])


def _get_folder(folder_id: UUID, db: Session, user: User) -> Folder:
    folder = db.get(Folder, folder_id)
    if folder is None or folder.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Folder not found")
    return folder


@router.get("", response_model=list[FolderOut])
def list_folders(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[FolderOut]:
    owned = list(
        db.scalars(
            select(Folder)
            .where(Folder.owner_id == user.id)
            .order_by(Folder.position.asc(), Folder.created_at.asc())
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
    # Folders reachable through a category shared with me.
    cat_ids = categories_svc.shared_category_ids(db, user)
    if cat_ids:
        folder_ids |= set(db.scalars(select(Folder.id).where(Folder.category_id.in_(cat_ids))))
    shared = (
        list(db.scalars(select(Folder).where(Folder.id.in_(folder_ids), Folder.owner_id != user.id)))
        if folder_ids
        else []
    )
    shared.sort(key=lambda f: f.name.lower())
    # Folders I own that I've shared out (live invites) -> crown badge.
    shared_out_ids = set(
        db.scalars(
            select(Share.folder_id).where(
                Share.owner_id == user.id,
                Share.folder_id.is_not(None),
                Share.status.in_(["pending", "accepted"]),
            )
        )
    )
    owner_names: dict = {}
    out: list[FolderOut] = []
    for f in [*owned, *shared]:
        item = FolderOut.model_validate(f)
        if f.owner_id != user.id:
            item.shared = True
            if f.owner_id not in owner_names:
                o = db.get(User, f.owner_id)
                owner_names[f.owner_id] = o.username if o else None
            item.owner_name = owner_names[f.owner_id]
        elif f.id in shared_out_ids:
            item.shared_out = True
        out.append(item)
    return out


@router.post("", response_model=FolderOut, status_code=status.HTTP_201_CREATED)
def create_folder(
    payload: FolderCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> Folder:
    max_pos = db.scalar(select(func.max(Folder.position)).where(Folder.owner_id == user.id))
    position = (max_pos + 1) if max_pos is not None else 0
    folder = Folder(owner_id=user.id, name=payload.name.strip(), position=position)
    db.add(folder)
    db.commit()
    db.refresh(folder)
    log_event(db, user=user, action="folder.create", entity_type="folder",
              entity_id=folder.id, summary=f"created folder “{folder.name}”")
    return folder


@router.patch("/{folder_id}/parent", status_code=status.HTTP_204_NO_CONTENT)
def move_folder(
    folder_id: UUID,
    payload: FolderMove,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    """Nest a folder under another (or null to make it top-level). Rejects cycles."""
    folder = _get_folder(folder_id, db, user)
    parent_id = payload.parent_folder_id
    if parent_id == folder_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A folder can't contain itself")
    if parent_id is not None:
        parent = db.get(Folder, parent_id)
        if parent is None or parent.owner_id != user.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Folder not found")
        # Walk up from the new parent; if we reach `folder`, it's a cycle.
        cur: Folder | None = parent
        seen: set = set()
        while cur is not None and cur.id not in seen:
            if cur.id == folder_id:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST, "Can't nest a folder inside itself"
                )
            seen.add(cur.id)
            cur = db.get(Folder, cur.parent_folder_id) if cur.parent_folder_id else None
    folder.parent_folder_id = parent_id
    db.commit()


@router.patch("/reorder", status_code=status.HTTP_204_NO_CONTENT)
def reorder_folders(
    payload: FolderReorder, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> None:
    owned = {f.id: f for f in db.scalars(select(Folder).where(Folder.owner_id == user.id))}
    for index, fid in enumerate(payload.folder_ids):
        folder = owned.get(fid)
        if folder is not None:
            folder.position = index
    db.commit()


@router.patch("/{folder_id}", response_model=FolderOut)
def rename_folder(
    folder_id: UUID,
    payload: FolderUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Folder:
    folder = _get_folder(folder_id, db, user)
    folder.name = payload.name.strip()
    db.commit()
    db.refresh(folder)
    log_event(db, user=user, action="folder.update", entity_type="folder",
              entity_id=folder.id, summary=f"renamed folder to “{folder.name}”")
    return folder


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_folder(
    folder_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> None:
    folder = _get_folder(folder_id, db, user)
    name = folder.name
    db.delete(folder)  # the FK unfiles this folder's boards (SET NULL)
    db.commit()
    log_event(db, user=user, action="folder.delete", entity_type="folder",
              summary=f"deleted folder “{name}”")
