"""The collaborative-doc channel rides the WebSocket as compact binary frames
(`[tag:1][sub:1][node_id:16][payload...]`) instead of JSON+base64.

Two checks:
  * the Hub relays a raw binary frame to the *other* board members only — never
    echoing the sender — and drops malformed / off-board frames;
  * a binary frame sent through the real ASGI WebSocket stack is handled without
    tearing the connection down (the receive loop keeps serving afterward).
"""
from __future__ import annotations

import asyncio
from uuid import UUID, uuid4

import app.routers.ws as wsmod
from app.database import SessionLocal
from app.models import User
from app.realtime import Hub
from app.security import create_access_token

from conftest import new_board, register


class _FakeWS:
    def __init__(self) -> None:
        self.bytes: list[bytes] = []
        self.jsons: list[dict] = []

    async def send_bytes(self, d: bytes) -> None:
        self.bytes.append(d)

    async def send_json(self, m: dict) -> None:
        self.jsons.append(m)


class _U:
    def __init__(self, name: str) -> None:
        self.id = uuid4()
        self.username = name
        self.color = "#ffffff"


def test_hub_relay_bytes_scopes_to_board(monkeypatch):
    async def run() -> None:
        hub = Hub()
        monkeypatch.setattr(wsmod, "hub", hub)
        board = uuid4()
        ws1, ws2, ws3 = _FakeWS(), _FakeWS(), _FakeWS()
        c1 = await hub.register(ws1, _U("a"))
        c2 = await hub.register(ws2, _U("b"))
        c3 = await hub.register(ws3, _U("c"))
        await hub.set_board(c1, board)
        await hub.set_board(c2, board)  # c3 stays off-board
        frame = bytes([1, 0]) + board.bytes + b"opaque-yjs-payload"

        await wsmod._handle_binary(c1, frame)
        assert ws2.bytes == [frame]  # peer gets the exact frame
        assert ws1.bytes == []       # sender is never echoed
        assert ws3.bytes == []       # off-board peer excluded

        # Rejected: off-board sender, bad tag, too-short frame — none relay.
        await wsmod._handle_binary(c3, frame)
        await wsmod._handle_binary(c1, bytes([9, 0]) + board.bytes + b"x")
        await wsmod._handle_binary(c1, bytes([1, 0]) + b"short")
        assert ws2.bytes == [frame]

    asyncio.run(run())


def _token(username: str) -> str:
    with SessionLocal() as db:
        u = db.query(User).filter_by(username=username).first()
        return create_access_token(u.id)


def test_binary_frame_keeps_connection_alive(client):
    register(client, "alice")  # first user -> admin, no invite needed
    tok = _token("alice")
    board_id = new_board(client, tok)

    with client.websocket_connect(f"/api/ws?token={tok}") as ws:
        assert ws.receive()["type"] == "websocket.send"  # global_presence on connect
        ws.send_json({"type": "join", "board_id": board_id})
        assert ws.receive()["type"] == "websocket.send"  # board presence
        assert ws.receive()["type"] == "websocket.send"  # global_presence
        # A binary Yjs frame must be handled without breaking the receive loop.
        ws.send_bytes(bytes([1, 0]) + UUID(board_id).bytes + b"opaque-yjs-payload")
        ws.send_json({"type": "leave"})
        # Still alive: leaving still produces a broadcast we can read.
        assert ws.receive()["type"] == "websocket.send"
