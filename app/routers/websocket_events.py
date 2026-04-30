"""
websocket_events.py — Socket.IO event handlers for JWordenAI real-time chat.

This module registers Socket.IO events on the shared ``sio`` server instance
that is mounted in app/main.py.  It mirrors the WebSocket endpoint in chat.py
but uses the Socket.IO protocol, which provides automatic reconnection,
namespace support, and room-based broadcasting out of the box.

Events (client → server)
─────────────────────────
  connect          — Client connects; must send {session_id, role, token?, name?}
                     in the auth payload or as query params.
  disconnect       — Client disconnects (handled automatically by Socket.IO).
  message          — Customer or admin sends a chat message.
                     Payload: {session_id, content, sender_name?}
  admin_message    — Alias for message with role=admin (convenience event).
                     Payload: {session_id, content, token}
  typing           — Show "typing…" indicator to other participants.
                     Payload: {session_id}

Events (server → client)
─────────────────────────
  message          — New chat message broadcast to the session room.
  typing           — Typing indicator broadcast.
  system           — System notification (join/leave).
  error            — Error response sent only to the originating client.

Rooms
─────
  Each session_id maps to a Socket.IO room named ``chat:<session_id>``.
  All participants in a session join the same room so broadcasts reach
  every connected client (customer tab + admin dashboard).

Rate limiting
─────────────
  10 messages per minute per session_id (shared with the WebSocket endpoint).
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone

import socketio  # type: ignore

from ..database import SessionLocal
from ..models import ChatSession

logger = logging.getLogger(__name__)

# ── Shared Socket.IO server ───────────────────────────────────────────────────
# Created here and imported by app/main.py to mount on the ASGI app.
# async_mode="asgi" is required for FastAPI / Starlette compatibility.

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",   # CORS for WS is handled at the transport level;
                                # fine-grained origin control is in main.py CORS middleware.
    logger=False,               # Silence Socket.IO's own verbose logger.
    engineio_logger=False,
)

# ── Rate limiting (shared with chat.py) ──────────────────────────────────────
from ..routers.chat import _is_rate_limited  # noqa: E402 — circular-safe at runtime


# ── Auth helper ───────────────────────────────────────────────────────────────

def _verify_admin_token(token: str) -> bool:
    if not token:
        return False
    master_key = os.getenv("JWORDEN_MASTER_KEY", "")
    if master_key and token == master_key:
        return True
    secret = os.getenv("JWT_SECRET_KEY", "")
    if secret:
        try:
            from jose import jwt  # noqa: PLC0415
            jwt.decode(token, secret, algorithms=["HS256"])
            return True
        except Exception:  # noqa: BLE001
            pass
    return False


# ── Room helper ───────────────────────────────────────────────────────────────

def _room(session_id: str) -> str:
    return f"chat:{session_id}"


# ── DB helper ─────────────────────────────────────────────────────────────────

def _get_session(session_id: str):
    """Return the ChatSession ORM object or None."""
    db = SessionLocal()
    try:
        return db.query(ChatSession).filter(ChatSession.session_id == session_id).first(), db
    except Exception as exc:  # noqa: BLE001
        logger.error("DB error fetching session %s: %s", session_id, exc)
        db.close()
        return None, None


# ── Connection tracking ───────────────────────────────────────────────────────
# sid → {session_id, role, sender_name}
_sid_meta: dict[str, dict] = {}


# ── Event handlers ────────────────────────────────────────────────────────────

@sio.event
async def connect(sid: str, environ: dict, auth: dict | None = None):
    """
    Handle a new Socket.IO connection.

    The client must pass auth data either via the Socket.IO ``auth`` object
    or as query-string parameters embedded in ``environ``.

    Expected auth fields:
      session_id  (required)
      role        "customer" | "admin"  (default: "customer")
      token       required when role=admin
      name        optional display name
    """
    auth = auth or {}

    # Fall back to query-string params if auth object is empty
    qs = environ.get("QUERY_STRING", "")
    qs_params: dict[str, str] = {}
    if qs:
        for part in qs.split("&"):
            if "=" in part:
                k, v = part.split("=", 1)
                qs_params[k] = v

    session_id  = auth.get("session_id")  or qs_params.get("session_id", "")
    role        = auth.get("role")        or qs_params.get("role", "customer")
    token       = auth.get("token")       or qs_params.get("token", "")
    name        = auth.get("name")        or qs_params.get("name", "")

    if not session_id:
        logger.warning("Socket.IO connect rejected: no session_id (sid=%s)", sid)
        return False  # Reject connection

    # Validate session exists
    session, db = _get_session(session_id)
    if db:
        db.close()
    if not session:
        logger.warning("Socket.IO connect rejected: session not found (sid=%s)", sid)
        return False

    # Validate admin role
    effective_role = role.lower()
    if effective_role == "admin":
        if not _verify_admin_token(token):
            logger.warning("Socket.IO admin connect rejected: bad token (sid=%s)", sid)
            return False
    else:
        effective_role = "customer"

    sender_name = (
        name.strip()
        or (session.customer_name if effective_role == "customer" else "Admin")
        or ("Customer" if effective_role == "customer" else "Admin")
    )

    # Join the session room
    await sio.enter_room(sid, _room(session_id))

    # Store metadata for this connection
    _sid_meta[sid] = {
        "session_id":  session_id,
        "role":        effective_role,
        "sender_name": sender_name,
    }

    # Announce arrival
    await sio.emit(
        "system",
        {
            "type":       "system",
            "session_id": session_id,
            "content":    f"{sender_name} joined the chat",
            "timestamp":  datetime.now(timezone.utc).isoformat(),
        },
        room=_room(session_id),
    )

    logger.info("Socket.IO connected: sid=%s session=%s role=%s", sid, session_id, effective_role)


@sio.event
async def disconnect(sid: str):
    """Handle client disconnection — broadcast departure to the session room."""
    meta = _sid_meta.pop(sid, None)
    if not meta:
        return

    session_id  = meta["session_id"]
    sender_name = meta["sender_name"]

    await sio.emit(
        "system",
        {
            "type":       "system",
            "session_id": session_id,
            "content":    f"{sender_name} left the chat",
            "timestamp":  datetime.now(timezone.utc).isoformat(),
        },
        room=_room(session_id),
    )
    logger.info("Socket.IO disconnected: sid=%s session=%s", sid, session_id)


@sio.event
async def message(sid: str, data: dict):
    """
    Handle an incoming chat message from a customer or admin.

    Expected payload:
      {
        "session_id": "...",   // optional — falls back to connection metadata
        "content":    "Hello!",
        "sender_name": "Alice" // optional override
      }
    """
    meta = _sid_meta.get(sid)
    if not meta:
        await sio.emit("error", {"content": "Not connected to a session"}, to=sid)
        return

    session_id  = data.get("session_id") or meta["session_id"]
    role        = meta["role"]
    sender_name = data.get("sender_name") or meta["sender_name"]
    content     = str(data.get("content", "")).strip()

    if not content:
        await sio.emit("error", {"content": "Message content cannot be empty"}, to=sid)
        return

    # Rate limiting
    if _is_rate_limited(session_id):
        await sio.emit(
            "error",
            {"content": "Rate limit exceeded — max 10 messages per minute"},
            to=sid,
        )
        return

    now_iso = datetime.now(timezone.utc).isoformat()

    # Persist to database
    session, db = _get_session(session_id)
    if session and db:
        try:
            raw = json.loads(session.messages_json or "[]")
            raw.append({
                "role":        role,
                "content":     content,
                "sender_name": sender_name,
                "timestamp":   now_iso,
            })
            session.messages_json = json.dumps(raw)
            session.updated_at = datetime.now(timezone.utc)
            db.commit()
        except Exception as exc:  # noqa: BLE001
            logger.error("Failed to persist Socket.IO message: %s", exc)
        finally:
            db.close()

    # Broadcast to all participants in the session room
    await sio.emit(
        "message",
        {
            "type":        "message",
            "session_id":  session_id,
            "role":        role,
            "sender_name": sender_name,
            "content":     content,
            "timestamp":   now_iso,
        },
        room=_room(session_id),
    )


@sio.event
async def admin_message(sid: str, data: dict):
    """
    Convenience event for admin messages.  Validates the token in the payload
    before forwarding to the standard message handler.

    Expected payload:
      {
        "session_id": "...",
        "content":    "Hello from J!",
        "token":      "<JWORDEN_MASTER_KEY or JWT>"
      }
    """
    token = data.get("token", "")
    if not _verify_admin_token(token):
        await sio.emit("error", {"content": "Unauthorized"}, to=sid)
        return

    # Elevate role to admin for this message
    meta = _sid_meta.get(sid, {})
    original_role = meta.get("role")
    if sid in _sid_meta:
        _sid_meta[sid]["role"] = "admin"

    await message(sid, data)

    # Restore original role
    if sid in _sid_meta and original_role:
        _sid_meta[sid]["role"] = original_role


@sio.event
async def typing(sid: str, data: dict):
    """
    Broadcast a typing indicator to all other participants in the session.

    Expected payload:
      {"session_id": "..."}   // optional — falls back to connection metadata
    """
    meta = _sid_meta.get(sid)
    if not meta:
        return

    session_id  = data.get("session_id") or meta["session_id"]
    sender_name = meta["sender_name"]
    role        = meta["role"]

    await sio.emit(
        "typing",
        {
            "type":        "typing",
            "session_id":  session_id,
            "role":        role,
            "sender_name": sender_name,
            "timestamp":   datetime.now(timezone.utc).isoformat(),
        },
        room=_room(session_id),
        skip_sid=sid,   # Don't echo back to the sender
    )
