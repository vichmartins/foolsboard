"""WebSocket endpoint for real-time board collaboration.

The browser WebSocket API can't set an Authorization header, so the JWT is passed
as a ``?token=`` query param and verified with the same ``decode_token`` used by
the REST API. Each short-lived DB session is opened only to authenticate and to
check board access; the live state itself lives in the in-process ``hub``.
"""
from __future__ import annotations

import json
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from ..database import SessionLocal
from ..deps import can_access_board
from ..models import Board, User
from ..realtime import color_for, hub
from ..security import decode_token

router = APIRouter()


def _authenticate(token: str | None) -> User | None:
    if not token:
        return None
    user_id = decode_token(token)
    if user_id is None:
        return None
    with SessionLocal() as db:
        user = db.get(User, user_id)
        if user is None or not user.is_active:
            return None
        db.expunge(user)  # detach: we only read id/username after the session closes
        return user


def _as_uuid(value) -> UUID | None:
    try:
        return UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        return None


def _can_access(user: User, board_id: UUID) -> bool:
    with SessionLocal() as db:
        board = db.get(Board, board_id)
        return board is not None and can_access_board(board, user, db)


@router.websocket("/api/ws")
async def ws_endpoint(ws: WebSocket) -> None:
    user = _authenticate(ws.query_params.get("token"))
    if user is None:
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await ws.accept()
    conn = await hub.register(ws, user)
    try:
        while True:
            raw = await ws.receive_text()
            await _handle(conn, user, raw)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        await hub.unregister(conn)


async def _handle(conn, user: User, raw: str) -> None:
    try:
        msg = json.loads(raw)
    except (ValueError, TypeError):
        return
    kind = msg.get("type")

    if kind == "join":
        board_id = _as_uuid(msg.get("board_id"))
        # Only place the user on a board they're actually allowed to see.
        if board_id is not None and _can_access(user, board_id):
            await hub.set_board(conn, board_id)
        else:
            await hub.set_board(conn, None)
    elif kind == "leave":
        await hub.set_board(conn, None)
    elif kind == "cursor":
        x, y = msg.get("x"), msg.get("y")
        if isinstance(x, (int, float)) and isinstance(y, (int, float)):
            await hub.relay(conn, {
                "type": "cursor",
                "board_id": str(conn.board_id),
                "user_id": str(conn.user_id),
                "username": conn.username,
                "color": color_for(conn.user_id),
                "x": x,
                "y": y,
            })
    elif kind == "select":
        node_ids = msg.get("node_ids")
        if isinstance(node_ids, list):
            ids = [str(n) for n in node_ids[:200]]  # cap to bound a hostile payload
            await hub.relay(conn, {
                "type": "select",
                "board_id": str(conn.board_id),
                "user_id": str(conn.user_id),
                "color": color_for(conn.user_id),
                "node_ids": ids,
            })
    elif kind == "node_move":
        positions = msg.get("positions")
        if isinstance(positions, list):
            clean = [
                {"id": str(p["id"]), "x": p["x"], "y": p["y"]}
                for p in positions[:500]
                if isinstance(p, dict)
                and p.get("id")
                and isinstance(p.get("x"), (int, float))
                and isinstance(p.get("y"), (int, float))
            ]
            if clean:
                await hub.relay(conn, {
                    "type": "node_move",
                    "board_id": str(conn.board_id),
                    "positions": clean,
                })
    elif kind == "board_dirty":
        await hub.relay(conn, {"type": "board_dirty", "board_id": str(conn.board_id)})
