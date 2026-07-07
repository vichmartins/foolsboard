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

# The pickable collaborator colors (cursors / selection highlights / avatars).
# A user picks one (stored on User.color); until then a deterministic palette
# color is used. UUID.int is deterministic across restarts (unlike hash()), so a
# user keeps the same default color.
# Deliberately avoids the object-type colors (scene #0ea5e9, character #10b981,
# dialog #f59e0b, event #ef4444, note #64748b, object #94a3b8) so a user's
# highlight never looks like a node type.
PALETTE = [
    "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
    "#ec4899", "#f43f5e", "#f97316", "#14b8a6",
    "#06b6d4", "#3b82f6", "#84cc16", "#eab308",
]


def color_for(user_id: UUID) -> str:
    return PALETTE[user_id.int % len(PALETTE)]


@dataclass(eq=False)  # identity equality so each socket is its own set member
class Conn:
    ws: WebSocket
    user_id: UUID
    username: str
    color: str
    board_id: UUID | None = None


class Hub:
    def __init__(self) -> None:
        self._conns: set[Conn] = set()
        self._lock = asyncio.Lock()
        # The running event loop, captured on first connect so synchronous REST
        # handlers (which run in a threadpool) can schedule pushes onto it.
        self._loop: asyncio.AbstractEventLoop | None = None

    async def register(self, ws: WebSocket, user) -> Conn:
        self._loop = asyncio.get_running_loop()
        conn = Conn(
            ws=ws,
            user_id=user.id,
            username=user.username,
            color=user.color or color_for(user.id),
        )
        async with self._lock:
            self._conns.add(conn)
        await self.broadcast_global()
        return conn

    async def unregister(self, conn: Conn) -> None:
        async with self._lock:
            self._conns.discard(conn)
        if conn.board_id is not None:
            await self.broadcast_presence(conn.board_id)
        await self.broadcast_global()

    async def set_board(self, conn: Conn, board_id: UUID | None) -> None:
        old = conn.board_id
        if old == board_id:
            return
        conn.board_id = board_id
        if old is not None:
            await self.broadcast_presence(old)
        if board_id is not None:
            await self.broadcast_presence(board_id)
        await self.broadcast_global()

    def _global_roster(self) -> dict[str, list[str]]:
        """Every online user -> the board(s) they're currently viewing (may be
        empty). Lets clients show a presence dot per shared board (here / away /
        offline). Single-process only; a multi-worker deploy would need pub/sub."""
        roster: dict[str, list[str]] = {}
        for c in self._conns:
            boards = roster.setdefault(str(c.user_id), [])
            if c.board_id is not None and str(c.board_id) not in boards:
                boards.append(str(c.board_id))
        return roster

    async def broadcast_global(self) -> None:
        msg = {"type": "global_presence", "users": self._global_roster()}
        await self._send_many(list(self._conns), msg)

    def _members(self, board_id: UUID) -> list[dict]:
        """Distinct users currently viewing the board (a user may have several
        tabs open; we collapse those into one member)."""
        seen: dict[UUID, tuple[str, str]] = {}
        for c in self._conns:
            if c.board_id == board_id:
                seen[c.user_id] = (c.username, c.color)
        return [
            {"id": str(uid), "username": name, "color": color}
            for uid, (name, color) in seen.items()
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

    async def send_to_user(self, user_id: UUID, msg: dict) -> None:
        """Push a message to every socket belonging to one user, on whatever board
        they're viewing -- for cross-board notifications like share invites."""
        targets = [c for c in self._conns if c.user_id == user_id]
        await self._send_many(targets, msg)

    def notify_user(self, user_id: UUID, msg: dict) -> None:
        """Schedule a user push from synchronous code (REST handlers run in a
        threadpool). No-op until the event loop has been captured by a connection;
        if the target user isn't connected, the push simply reaches no one."""
        loop = self._loop
        if loop is None:
            return
        try:
            asyncio.run_coroutine_threadsafe(self.send_to_user(user_id, msg), loop)
        except RuntimeError:
            pass

    def set_user_color(self, user_id: UUID, color: str) -> None:
        """Apply a user's newly-chosen color to their live connections and tell
        collaborators, so cursors/highlights recolor without a refresh. Called
        from the sync REST handler; runs on the captured loop."""
        loop = self._loop
        if loop is None:
            return
        try:
            asyncio.run_coroutine_threadsafe(self._apply_user_color(user_id, color), loop)
        except RuntimeError:
            pass

    async def _apply_user_color(self, user_id: UUID, color: str) -> None:
        boards: set[UUID] = set()
        for c in self._conns:
            if c.user_id == user_id:
                c.color = color
                if c.board_id is not None:
                    boards.add(c.board_id)
        for board_id in boards:
            await self.broadcast_presence(board_id)
            targets = [c for c in self._conns if c.board_id == board_id]
            await self._send_many(
                targets,
                {"type": "color", "board_id": str(board_id), "user_id": str(user_id), "color": color},
            )

    async def _send_many(self, targets: list[Conn], msg: dict) -> None:
        # Send to everyone concurrently and cap each send, so one peer with a stalled
        # socket (full send buffer: laptop asleep, dropped network) can't block the
        # whole board's relay — and the sender's own receive loop — until the OS
        # times the dead socket out. Failures/timeouts are ignored; that connection's
        # own receive loop cleans it up.
        async def _one(c: Conn) -> None:
            try:
                await asyncio.wait_for(c.ws.send_json(msg), timeout=5)
            except Exception:
                pass

        if targets:
            await asyncio.gather(*(_one(c) for c in targets))


hub = Hub()
