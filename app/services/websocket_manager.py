"""
websocket_manager.py — Native FastAPI WebSocket connection manager.

Tracks active WebSocket connections per chat session and provides
broadcast / targeted send helpers used by the chat router.

Design notes:
  - Connections are keyed by session_id so admin and customer can share
    the same session room without knowing each other's connection object.
  - All public methods are async-safe; the internal dict is only mutated
    from the single asyncio event loop that uvicorn runs.
  - No external dependencies — works without Redis or any broker.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from typing import Dict, List

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketManager:
    """
    Manages active WebSocket connections grouped by chat session_id.

    Usage::

        manager = WebSocketManager()

        # In a WebSocket endpoint:
        await manager.connect(session_id, websocket)
        try:
            while True:
                data = await websocket.receive_json()
                await manager.broadcast(session_id, data)
        except WebSocketDisconnect:
            manager.disconnect(session_id, websocket)
    """

    def __init__(self) -> None:
        # session_id → list of active WebSocket connections in that session
        self._connections: Dict[str, List[WebSocket]] = defaultdict(list)

    # ── Connection lifecycle ──────────────────────────────────────────────────

    async def connect(self, session_id: str, websocket: WebSocket) -> None:
        """Accept the WebSocket handshake and register the connection."""
        await websocket.accept()
        self._connections[session_id].append(websocket)
        logger.info(
            "WebSocket connected: session=%s total_in_session=%d",
            session_id,
            len(self._connections[session_id]),
        )

    def disconnect(self, session_id: str, websocket: WebSocket) -> None:
        """Remove a connection from the session room."""
        conns = self._connections.get(session_id, [])
        if websocket in conns:
            conns.remove(websocket)
        if not conns:
            self._connections.pop(session_id, None)
        logger.info(
            "WebSocket disconnected: session=%s remaining=%d",
            session_id,
            len(self._connections.get(session_id, [])),
        )

    # ── Messaging ─────────────────────────────────────────────────────────────

    async def broadcast(self, session_id: str, message: dict) -> None:
        """
        Send *message* to every connection in the session room.

        Stale connections (already closed) are silently removed.
        """
        conns = list(self._connections.get(session_id, []))
        dead: list[WebSocket] = []
        for ws in conns:
            try:
                await ws.send_json(message)
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "Broadcast failed for session=%s, removing connection: %s",
                    session_id,
                    exc,
                )
                dead.append(ws)
        for ws in dead:
            self.disconnect(session_id, ws)

    async def send_personal(self, websocket: WebSocket, message: dict) -> None:
        """Send *message* to a single specific connection."""
        try:
            await websocket.send_json(message)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Personal send failed: %s", exc)

    # ── Introspection ─────────────────────────────────────────────────────────

    def active_sessions(self) -> list[str]:
        """Return a list of session_ids that have at least one live connection."""
        return list(self._connections.keys())

    def connection_count(self, session_id: str) -> int:
        """Return the number of active connections in a session."""
        return len(self._connections.get(session_id, []))


# Module-level singleton — imported by the chat router and websocket_events.
manager = WebSocketManager()
