"""
conversation_memory.py — Multi-turn conversation memory for JWordenAI chat.

Storage strategy (in priority order):
  1. Redis  — if REDIS_URL env var is set, sessions stored as JSON lists with TTL
  2. SQLite / Postgres (ChatSession table) — fallback when Redis is unavailable

Public API
──────────
  get_session(session_id)                    → list[dict]  (last 20 messages)
  save_message(session_id, role, content)    → None
  clear_session(session_id)                  → None
  update_session_metadata(session_id, **kw)  → None
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)

_REDIS_URL = os.getenv("REDIS_URL", "")
_SESSION_TTL = 60 * 60 * 24 * 7  # 7 days
_MAX_MESSAGES = 20
_KEY_PREFIX = "jworden:chat:"

# Module-level Redis singleton — created once, reused across all session ops.
_redis_client: Optional[Any] = None

# ── Redis helpers ─────────────────────────────────────────────────────────────

def _get_redis():
    """Return a shared Redis client or None if unavailable."""
    global _redis_client
    if not _REDIS_URL:
        return None
    if _redis_client is not None:
        return _redis_client
    try:
        import redis  # type: ignore
        _redis_client = redis.from_url(_REDIS_URL, decode_responses=True)
        _redis_client.ping()
        return _redis_client
    except Exception as exc:  # noqa: BLE001
        logger.warning("Redis unavailable, falling back to DB: %s", exc)
        return None


def _redis_key(session_id: str) -> str:
    return f"{_KEY_PREFIX}{session_id}"


# ── DB helpers ────────────────────────────────────────────────────────────────

def _get_or_create_session(session_id: str, db):
    from ..models import ChatSession  # noqa: PLC0415
    obj = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
    if not obj:
        obj = ChatSession(session_id=session_id, messages_json="[]")
        db.add(obj)
        db.commit()
        db.refresh(obj)
    return obj


# ── Public API ────────────────────────────────────────────────────────────────

def get_session(session_id: str, db=None) -> list[dict]:
    """Return the last _MAX_MESSAGES messages for the given session."""
    r = _get_redis()
    if r:
        try:
            raw = r.get(_redis_key(session_id))
            if raw:
                messages = json.loads(raw)
                return messages[-_MAX_MESSAGES:]
            return []
        except Exception as exc:  # noqa: BLE001
            logger.error("Redis get_session error: %s", exc)

    if db is None:
        return []
    try:
        obj = _get_or_create_session(session_id, db)
        messages = json.loads(obj.messages_json or "[]")
        return messages[-_MAX_MESSAGES:]
    except Exception as exc:  # noqa: BLE001
        logger.error("DB get_session error: %s", exc)
        return []


def save_message(
    session_id: str,
    role: str,
    content: str,
    metadata: Optional[dict] = None,
    db=None,
) -> None:
    """Append a message to the session history."""
    entry: dict = {"role": role, "content": content}
    if metadata:
        entry["metadata"] = metadata

    r = _get_redis()
    if r:
        try:
            key = _redis_key(session_id)
            raw = r.get(key)
            messages = json.loads(raw) if raw else []
            messages.append(entry)
            r.setex(key, _SESSION_TTL, json.dumps(messages))
            return
        except Exception as exc:  # noqa: BLE001
            logger.error("Redis save_message error: %s", exc)

    if db is None:
        return
    try:
        obj = _get_or_create_session(session_id, db)
        messages = json.loads(obj.messages_json or "[]")
        messages.append(entry)
        obj.messages_json = json.dumps(messages)
        obj.updated_at = datetime.now(timezone.utc)
        db.commit()
    except Exception as exc:  # noqa: BLE001
        logger.error("DB save_message error: %s", exc)


def clear_session(session_id: str, db=None) -> None:
    """Delete all messages for a session."""
    r = _get_redis()
    if r:
        try:
            r.delete(_redis_key(session_id))
        except Exception as exc:  # noqa: BLE001
            logger.error("Redis clear_session error: %s", exc)

    if db is None:
        return
    try:
        from ..models import ChatSession  # noqa: PLC0415
        obj = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
        if obj:
            obj.messages_json = "[]"
            obj.updated_at = datetime.now(timezone.utc)
            db.commit()
    except Exception as exc:  # noqa: BLE001
        logger.error("DB clear_session error: %s", exc)


def update_session_metadata(session_id: str, db=None, **kwargs) -> None:
    """Update customer_name, state_code, last_service, customer_email on the session."""
    allowed = {"customer_name", "customer_email", "state_code", "last_service"}

    if db is None:
        return
    try:
        obj = _get_or_create_session(session_id, db)
        for key, value in kwargs.items():
            if key in allowed:
                setattr(obj, key, value)
        obj.updated_at = datetime.now(timezone.utc)
        db.commit()
    except Exception as exc:  # noqa: BLE001
        logger.error("DB update_session_metadata error: %s", exc)
