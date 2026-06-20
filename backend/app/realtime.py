"""In-process real-time hub for live board collaboration over WebSockets.

This is intentionally single-process: presence and broadcasts live in memory, so
it works with one uvicorn worker (our dev/default setup). A multi-worker
deployment would need an external pub/sub (Redis), which we avoid here to keep
the no-new-dependencies, stdlib-only constraint.

Phase 2a covers presence (who is viewing which board). The message protocol is
designed to grow: later increments (cursors, live field edits, upload activity)
just add message types over the same channel.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass
from uuid import UUID

from starlette.websockets import WebSocket

# Stable per-user color for avatars/cursors. UUID.int is deterministic across
# restarts (unlike hash()), so a user keeps the same color.
_PALETTE = [
    "#6366f1", "#ec4899", "#f59e0b", "#10b981",
    "#06b6d4", "#8b5cf6", "#ef4444", "#14b8a6",
]


def color_for(user_id: UUID) -> str:
    return _PALETTE[user_id.int % len(_PALETTE)]


@dataclass(eq=False)  # identity equality so each socket is its own set member
class Conn:
    ws: WebSocket
    user_id: UUID
    username: str
    board_id: UUID | None = None


class Hub:
    def __init__(self) -> None:
        self._conns: set[Conn] = set()
        self._lock = asyncio.Lock()

    async def register(self, ws: WebSocket, user) -> Conn:
        conn = Conn(ws=ws, user_id=user.id, username=user.username)
        async with self._lock:
            self._conns.add(conn)
        return conn

    async def unregister(self, conn: Conn) -> None:
        async with self._lock:
            self._conns.discard(conn)
        if conn.board_id is not None:
            await self.broadcast_presence(conn.board_id)

    async def set_board(self, conn: Conn, board_id: UUID | None) -> None:
        old = conn.board_id
        if old == board_id:
            return
        conn.board_id = board_id
        if old is not None:
            await self.broadcast_presence(old)
        if board_id is not None:
            await self.broadcast_presence(board_id)

    def _members(self, board_id: UUID) -> list[dict]:
        """Distinct users currently viewing the board (a user may have several
        tabs open; we collapse those into one member)."""
        seen: dict[UUID, str] = {}
        for c in self._conns:
            if c.board_id == board_id:
                seen[c.user_id] = c.username
        return [
            {"id": str(uid), "username": name, "color": color_for(uid)}
            for uid, name in seen.items()
        ]

    async def broadcast_presence(self, board_id: UUID) -> None:
        msg = {
            "type": "presence",
            "board_id": str(board_id),
            "members": self._members(board_id),
        }
        # Snapshot targets synchronously, then send (the set may change during awaits).
        targets = [c for c in self._conns if c.board_id == board_id]
        await self._send_many(targets, msg)

    async def relay(self, sender: Conn, msg: dict) -> None:
        """Forward a transient message (cursor, selection) to everyone else on the
        sender's board. Not persisted; not echoed back to the sender."""
        if sender.board_id is None:
            return
        targets = [
            c for c in self._conns if c.board_id == sender.board_id and c is not sender
        ]
        await self._send_many(targets, msg)

    async def _send_many(self, targets: list[Conn], msg: dict) -> None:
        for c in targets:
            try:
                await c.ws.send_json(msg)
            except Exception:
                pass  # a dead socket is cleaned up by its own receive loop


hub = Hub()
