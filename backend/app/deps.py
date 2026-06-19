"""Shared FastAPI dependencies for authentication and per-user access control.

`get_current_user` authenticates the bearer token. `get_owned_board` /
`get_owned_node` additionally enforce that the resource belongs to the caller,
so a user can never read or mutate another user's boards/nodes/assets.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import Board, Node, User
from .security import decode_token

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    user_id = decode_token(creds.credentials)
    if user_id is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account no longer exists")
    return user


def get_current_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin only")
    return user


def get_owned_board(
    board_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Board:
    board = db.get(Board, board_id)
    if board is None or board.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Board not found")
    return board


def get_owned_node(
    node_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Node:
    node = db.get(Node, node_id)
    if node is not None:
        board = db.get(Board, node.board_id)
        if board is not None and board.owner_id == user.id:
            return node
    raise HTTPException(status.HTTP_404_NOT_FOUND, "Node not found")
