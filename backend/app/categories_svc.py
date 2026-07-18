"""Category sharing glue.

Per-user layout (membership + ordering, for owned *and* shared items) stays in
`user.categories` JSON -- that's what the explorer reads/writes, and it's what
lets a recipient file a shared board into their own category. On top of that, a
category has a shareable *identity*: a `Category` DB row (id == the JSON
category's id) plus a denormalized `category_id` on the owner's folders/boards.
The DB side is synced from the owner's JSON on every save and is used only to
(a) resolve share access and (b) show a shared category's contents to recipients.
"""
from __future__ import annotations

import json
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Board, Category, Folder, Share, User
from .schemas import CategoriesPayload, CategoryIn


def parse_layout(user: User) -> CategoriesPayload:
    if not user.categories:
        return CategoriesPayload()
    try:
        return CategoriesPayload.model_validate(json.loads(user.categories))
    except (ValueError, TypeError):
        return CategoriesPayload()


def sync_owned_categories(db: Session, user: User, payload: CategoriesPayload) -> None:
    """Mirror the owner's JSON categories into DB Category rows and set category_id
    on the owner's own folders/boards. Items the user doesn't own (shared items
    they've filed in) are ignored -- their placement lives only in the JSON."""
    existing = {c.id: c for c in db.scalars(select(Category).where(Category.owner_id == user.id))}
    seen: set[UUID] = set()
    item_cat: dict[UUID, UUID] = {}
    for pos, cat in enumerate(payload.categories):
        if cat.shared:  # a category shared *with* me must never be saved as my own
            continue
        try:
            cid = UUID(cat.id)
        except (ValueError, AttributeError, TypeError):
            continue
        seen.add(cid)
        row = existing.get(cid)
        if row is None:
            db.add(Category(id=cid, owner_id=user.id, name=cat.name[:120], position=pos,
                            item_order=json.dumps(cat.items)))
        else:
            row.name = cat.name[:120]
            row.position = pos
            row.item_order = json.dumps(cat.items)
        for item in cat.items:
            try:
                item_cat[UUID(str(item))] = cid
            except (ValueError, TypeError):
                continue
    for cid, row in existing.items():
        if cid not in seen:
            db.delete(row)  # SET NULL clears members' category_id; CASCADE drops its shares
    # Flush the category adds/deletes before pointing folders/boards at them --
    # there's no ORM relationship, so the unit of work won't order it for us and
    # the FK (checked per-statement) would otherwise fail.
    db.flush()
    for f in db.scalars(select(Folder).where(Folder.owner_id == user.id)):
        f.category_id = item_cat.get(f.id)
    for b in db.scalars(select(Board).where(Board.owner_id == user.id)):
        b.category_id = item_cat.get(b.id)


def shared_category_ids(db: Session, user: User) -> set[UUID]:
    """Category ids shared with and accepted by the user."""
    return set(
        db.scalars(
            select(Share.category_id).where(
                Share.shared_with_id == user.id,
                Share.status == "accepted",
                Share.category_id.is_not(None),
            )
        )
    )


def category_member_ids(db: Session, cat: Category) -> list[str]:
    """Owner-placed folder/board ids in a category, ordered by item_order then
    position -- used to show a shared category's contents to a recipient."""
    folders = list(db.scalars(select(Folder).where(Folder.category_id == cat.id)))
    boards = list(db.scalars(select(Board).where(Board.category_id == cat.id)))
    by_id = {str(x.id): x for x in [*folders, *boards]}
    ordered: list[str] = []
    seen: set[str] = set()
    if cat.item_order:
        try:
            for i in json.loads(cat.item_order):
                s = str(i)
                if s in by_id and s not in seen:
                    ordered.append(s)
                    seen.add(s)
        except (ValueError, TypeError):
            pass
    rest = [x for x in [*folders, *boards] if str(x.id) not in seen]
    rest.sort(key=lambda x: getattr(x, "position", 0))
    ordered.extend(str(x.id) for x in rest)
    return ordered


def build_payload(db: Session, user: User) -> CategoriesPayload:
    """The explorer layout: the user's own categories (from JSON, flagged if shared
    out) plus the categories shared with them (contents from the owner's placement)."""
    payload = parse_layout(user)
    shared_out = {
        str(x)
        for x in db.scalars(
            select(Share.category_id).where(
                Share.owner_id == user.id,
                Share.category_id.is_not(None),
                Share.status.in_(["pending", "accepted"]),
            )
        )
    }
    for c in payload.categories:
        if c.id in shared_out:
            c.shared_out = True
    own_ids = {c.id for c in payload.categories}
    rows = db.execute(
        select(Share.category_id, Share.owner_id).where(
            Share.shared_with_id == user.id,
            Share.status == "accepted",
            Share.category_id.is_not(None),
        )
    ).all()
    owner_names: dict = {}
    for cat_id, owner_id in rows:
        cat = db.get(Category, cat_id)
        if cat is None or str(cat.id) in own_ids:
            continue
        if owner_id not in owner_names:
            o = db.get(User, owner_id)
            owner_names[owner_id] = o.username if o else None
        payload.categories.append(
            CategoryIn(
                id=str(cat.id),
                name=cat.name,
                items=category_member_ids(db, cat),
                shared=True,
                owner_name=owner_names[owner_id],
            )
        )
    return payload


def ensure_owned_category(db: Session, user: User, category_id: UUID) -> Category | None:
    """Return the caller's Category row, first syncing from their JSON so a freshly
    created category can be shared immediately. None if they don't own one."""
    sync_owned_categories(db, user, parse_layout(user))
    db.flush()
    cat = db.get(Category, category_id)
    return cat if cat is not None and cat.owner_id == user.id else None
