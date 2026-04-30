"""
chat.py — Real-time WebSocket chat endpoints for JWordenAI.

Routes
──────
  POST /api/v1/chat/session
      Create a new chat session and return its session_id.

  GET  /api/v1/chat/history/{session_id}
      Retrieve the full message history for a session.
      Public — no auth required (session_id acts as the access token).

  WS   /ws/chat/{session_id}
      Real-time bidirectional chat.
      Customers connect with ?role=customer (default).
      Admins connect with ?role=admin&token=<JWORDEN_MASTER_KEY or JWT>.

Message format (JSON sent over the WebSocket)
─────────────────────────────────────────────
  Incoming (client → server):
    {
      "type": "message" | "typing" | "ping",
      "content": "Hello!",          // required for type=message
      "sender_name": "Alice"        // optional display name
    }

  Outgoing (server → all clients in session):
    {
      "type": "message" | "typing" | "system" | "pong",
      "session_id": "...",
      "role": "customer" | "admin",
      "sender_name": "Alice",
      "content": "Hello!",
      "timestamp": "2024-01-01T12:00:00Z"
    }

Rate limiting
─────────────
  10 messages per minute per session (tracked in-memory per session_id).
  Exceeding the limit closes the connection with code 1008 (Policy Violation).
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..core.security import verify_premium_security
from ..database import get_db
from ..models import ChatSession
from ..services.websocket_manager import manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["chat"])

# ── Rate limiting (in-memory, per session) ────────────────────────────────────
# Tracks message timestamps for each session_id using a sliding window.
# Resets automatically as old timestamps fall outside the 60-second window.

_RATE_LIMIT_MESSAGES = 10   # max messages
_RATE_LIMIT_WINDOW   = 60   # seconds

# session_id → deque of UTC timestamps (float) for recent messages
_rate_buckets: dict[str, deque] = defaultdict(lambda: deque(maxlen=_RATE_LIMIT_MESSAGES + 1))


def _is_rate_limited(session_id: str) -> bool:
    """Return True if the session has exceeded the rate limit."""
    now = datetime.now(timezone.utc).timestamp()
    bucket = _rate_buckets[session_id]
    # Purge timestamps outside the sliding window
    while bucket and (now - bucket[0]) > _RATE_LIMIT_WINDOW:
        bucket.popleft()
    if len(bucket) >= _RATE_LIMIT_MESSAGES:
        return True
    bucket.append(now)
    return False


# ── Auth helper for WebSocket connections ─────────────────────────────────────

def _verify_admin_token(token: str) -> bool:
    """
    Validate an admin token for WebSocket connections.
    Accepts the JWORDEN_MASTER_KEY or a valid JWT.
    Returns True if valid, False otherwise.
    """
    if not token:
        return False

    master_key = os.getenv("JWORDEN_MASTER_KEY", "")
    if master_key and token == master_key:
        return True

    secret = os.getenv("JWT_SECRET_KEY", "")
    if secret:
        try:
            from jose import jwt, JWTError  # noqa: PLC0415
            jwt.decode(token, secret, algorithms=["HS256"])
            return True
        except Exception:  # noqa: BLE001
            pass

    return False


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class CreateSessionRequest(BaseModel):
    model_config = {"str_strip_whitespace": True}

    customer_name:  Optional[str] = Field(default=None, max_length=120)
    customer_email: Optional[str] = Field(default=None, max_length=254)


class CreateSessionResponse(BaseModel):
    session_id:     str
    customer_name:  Optional[str] = None
    customer_email: Optional[str] = None
    created_at:     str


class MessageOut(BaseModel):
    role:        str
    content:     str
    sender_name: Optional[str] = None
    timestamp:   Optional[str] = None


class HistoryResponse(BaseModel):
    session_id: str
    messages:   list[MessageOut]
    created_at: str
    updated_at: str


# ── HTTP endpoints ────────────────────────────────────────────────────────────

@router.post(
    "/api/v1/chat/session",
    response_model=CreateSessionResponse,
    summary="Create a new real-time chat session",
    tags=["chat"],
)
async def create_session(
    req: CreateSessionRequest,
    db: Session = Depends(get_db),
):
    """
    Create a new chat session.  Returns a session_id that the client uses
    to connect to the WebSocket endpoint and retrieve history.

    No authentication required — the session_id itself is the access token.
    """
    session_id = str(uuid.uuid4())
    session = ChatSession(
        session_id=session_id,
        messages_json="[]",
        customer_name=req.customer_name,
        customer_email=req.customer_email,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    logger.info("Chat session created: session_id=%s", session_id)
    return CreateSessionResponse(
        session_id=session_id,
        customer_name=session.customer_name,
        customer_email=session.customer_email,
        created_at=session.created_at.isoformat(),
    )


@router.get(
    "/api/v1/chat/history/{session_id}",
    response_model=HistoryResponse,
    summary="Get chat history for a session",
    tags=["chat"],
)
async def get_history(
    session_id: str,
    db: Session = Depends(get_db),
):
    """
    Return the full message history for a chat session.

    Public endpoint — no auth required.  The session_id acts as the
    access token; only parties who know it can read the history.
    """
    session = (
        db.query(ChatSession)
        .filter(ChatSession.session_id == session_id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    try:
        raw_messages = json.loads(session.messages_json or "[]")
    except (json.JSONDecodeError, TypeError):
        raw_messages = []

    messages = [
        MessageOut(
            role=m.get("role", "unknown"),
            content=m.get("content", ""),
            sender_name=m.get("sender_name"),
            timestamp=m.get("timestamp"),
        )
        for m in raw_messages
    ]

    return HistoryResponse(
        session_id=session_id,
        messages=messages,
        created_at=session.created_at.isoformat(),
        updated_at=session.updated_at.isoformat(),
    )


# ── WebSocket endpoint ────────────────────────────────────────────────────────

@router.websocket("/ws/chat/{session_id}")
async def websocket_chat(
    websocket: WebSocket,
    session_id: str,
    role:  str = Query(default="customer"),   # "customer" | "admin"
    token: str = Query(default=""),           # required when role=admin
    name:  str = Query(default=""),           # optional display name
    db:    Session = Depends(get_db),
):
    """
    Real-time WebSocket chat endpoint.

    Connection URL examples:
      ws://host/ws/chat/<session_id>?role=customer&name=Alice
      ws://host/ws/chat/<session_id>?role=admin&token=<key>&name=J

    Message types the client may send:
      {"type": "message",  "content": "Hello!"}
      {"type": "typing"}
      {"type": "ping"}

    Message types the server broadcasts:
      {"type": "message",  "role": "...", "content": "...", ...}
      {"type": "typing",   "role": "...", "sender_name": "..."}
      {"type": "system",   "content": "..."}
      {"type": "pong"}
    """
    # ── Validate session ──────────────────────────────────────────────────────
    session = (
        db.query(ChatSession)
        .filter(ChatSession.session_id == session_id)
        .first()
    )
    if not session:
        await websocket.close(code=4004, reason="Session not found")
        return

    # ── Validate admin role ───────────────────────────────────────────────────
    effective_role = role.lower()
    if effective_role == "admin":
        if not _verify_admin_token(token):
            await websocket.close(code=4003, reason="Unauthorized")
            return
    else:
        effective_role = "customer"

    # ── Resolve display name ──────────────────────────────────────────────────
    sender_name = (
        name.strip()
        or (session.customer_name if effective_role == "customer" else "Admin")
        or ("Customer" if effective_role == "customer" else "Admin")
    )

    # ── Accept connection ─────────────────────────────────────────────────────
    await manager.connect(session_id, websocket)

    # Announce arrival to all participants in the session
    await manager.broadcast(session_id, {
        "type":       "system",
        "session_id": session_id,
        "content":    f"{sender_name} joined the chat",
        "timestamp":  datetime.now(timezone.utc).isoformat(),
    })

    try:
        while True:
            # ── Receive ───────────────────────────────────────────────────────
            try:
                data = await websocket.receive_json()
            except Exception:  # noqa: BLE001
                # Client sent non-JSON or connection dropped
                break

            msg_type = data.get("type", "message")

            # ── Ping / pong ───────────────────────────────────────────────────
            if msg_type == "ping":
                await manager.send_personal(websocket, {"type": "pong"})
                continue

            # ── Typing indicator ──────────────────────────────────────────────
            if msg_type == "typing":
                await manager.broadcast(session_id, {
                    "type":        "typing",
                    "session_id":  session_id,
                    "role":        effective_role,
                    "sender_name": sender_name,
                    "timestamp":   datetime.now(timezone.utc).isoformat(),
                })
                continue

            # ── Chat message ──────────────────────────────────────────────────
            if msg_type == "message":
                content = str(data.get("content", "")).strip()
                if not content:
                    await manager.send_personal(websocket, {
                        "type":    "error",
                        "content": "Message content cannot be empty",
                    })
                    continue

                # Rate limiting
                if _is_rate_limited(session_id):
                    await manager.send_personal(websocket, {
                        "type":    "error",
                        "content": "Rate limit exceeded — max 10 messages per minute",
                    })
                    continue

                now_iso = datetime.now(timezone.utc).isoformat()

                # Persist to database
                try:
                    raw = json.loads(session.messages_json or "[]")
                    raw.append({
                        "role":        effective_role,
                        "content":     content,
                        "sender_name": sender_name,
                        "timestamp":   now_iso,
                    })
                    session.messages_json = json.dumps(raw)
                    session.updated_at = datetime.now(timezone.utc)
                    db.commit()
                except Exception as exc:  # noqa: BLE001
                    logger.error("Failed to persist chat message: %s", exc)

                # Broadcast to all participants
                await manager.broadcast(session_id, {
                    "type":        "message",
                    "session_id":  session_id,
                    "role":        effective_role,
                    "sender_name": sender_name,
                    "content":     content,
                    "timestamp":   now_iso,
                })

    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(session_id, websocket)
        # Notify remaining participants
        await manager.broadcast(session_id, {
            "type":       "system",
            "session_id": session_id,
            "content":    f"{sender_name} left the chat",
            "timestamp":  datetime.now(timezone.utc).isoformat(),
        })
        logger.info("WebSocket closed: session=%s role=%s", session_id, effective_role)
