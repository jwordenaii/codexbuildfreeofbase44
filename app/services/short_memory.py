"""
Short-term conversational memory for Jarvis.

This used to be a module-level dict with a FIFO deque per session, and the
docstring said "replace with DB-backed store later". Two things made that
urgent rather than tidy:

  * jworden-api runs more than one Fly machine behind a shared hostname, and
    consecutive requests in the same conversation are not pinned to one of
    them. A turn answered by machine A left no trace on machine B, so Jarvis
    appeared to forget what was said one message ago — intermittently, which
    is the hardest kind of bug to believe.
  * Every deploy wiped every in-flight conversation.

Memory is now written to the `chat_sessions` table (which already existed and
was unused by this module), so it is shared across machines and survives
restarts. The in-process dict is kept as a write-through cache: it absorbs the
repeated reads inside a single turn, and it is what answers if the database is
briefly unreachable.

Failure policy: memory is an enhancement, never a dependency. Any database
error is logged and swallowed — a degraded Jarvis that has forgotten the last
few turns is worth far more than a Jarvis that returns 500 because Postgres
blinked.
"""

from __future__ import annotations

import json
import logging
import threading
import time
from collections import deque
from typing import Deque, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

_LIMIT = 12

# session_key -> (fetched_at, messages). The timestamp lets a machine notice
# that its copy is stale and re-read what the other machine has written.
_STORE: Dict[str, Deque[str]] = {}
_FETCHED_AT: Dict[str, float] = {}
_LOCK = threading.Lock()

# How long a cached read is trusted before going back to the database. Short
# enough that a reply written by the other machine shows up within one turn.
_CACHE_TTL_SECONDS = 5.0

# Bound the process-local cache so a long-lived machine serving many sessions
# cannot grow it without limit.
_MAX_CACHED_SESSIONS = 500


def _session_scope():
    """Yield a database session, or None when the database is unavailable."""
    try:
        from ..database import SessionLocal  # noqa: PLC0415

        return SessionLocal()
    except Exception as exc:  # noqa: BLE001
        logger.warning("[short_memory] database unavailable: %s", exc)
        return None


def _load_from_db(session_key: str) -> Optional[List[str]]:
    db = _session_scope()
    if db is None:
        return None
    try:
        from ..models import ChatSession  # noqa: PLC0415

        row = (
            db.query(ChatSession)
            .filter(ChatSession.session_id == session_key)
            .one_or_none()
        )
        if row is None:
            return []
        messages = json.loads(row.messages_json or "[]")
        if not isinstance(messages, list):
            return []
        return [str(m) for m in messages][-_LIMIT:]
    except Exception as exc:  # noqa: BLE001
        logger.warning("[short_memory] load failed for %s: %s", session_key, exc)
        return None
    finally:
        db.close()


def _save_to_db(session_key: str, messages: List[str]) -> None:
    db = _session_scope()
    if db is None:
        return
    try:
        from ..models import ChatSession  # noqa: PLC0415

        row = (
            db.query(ChatSession)
            .filter(ChatSession.session_id == session_key)
            .one_or_none()
        )
        payload = json.dumps(messages[-_LIMIT:])
        if row is None:
            db.add(ChatSession(session_id=session_key, messages_json=payload))
        else:
            row.messages_json = payload
        db.commit()
    except Exception as exc:  # noqa: BLE001
        # A unique-constraint race between the two machines lands here; the
        # next append reconciles, so there is nothing to do but roll back.
        logger.warning("[short_memory] save failed for %s: %s", session_key, exc)
        try:
            db.rollback()
        except Exception:  # noqa: BLE001
            pass
    finally:
        db.close()


def _cached(session_key: str) -> Optional[Deque[str]]:
    fetched = _FETCHED_AT.get(session_key)
    if fetched is None:
        return None
    if time.time() - fetched > _CACHE_TTL_SECONDS:
        return None
    return _STORE.get(session_key)


def _put_cache(session_key: str, messages: List[str]) -> Deque[str]:
    buf: Deque[str] = deque(messages[-_LIMIT:], maxlen=_LIMIT)
    _STORE[session_key] = buf
    _FETCHED_AT[session_key] = time.time()
    if len(_STORE) > _MAX_CACHED_SESSIONS:
        oldest = min(_FETCHED_AT, key=_FETCHED_AT.get)
        _STORE.pop(oldest, None)
        _FETCHED_AT.pop(oldest, None)
    return buf


def append(session_key: str, message: str) -> None:
    """Record one line of conversation. Never raises."""
    if not session_key:
        return
    with _LOCK:
        buf = _cached(session_key)
        if buf is None:
            loaded = _load_from_db(session_key)
            # A failed load returns None; starting from whatever this process
            # already had beats dropping the turn on the floor.
            buf = _put_cache(session_key, loaded if loaded is not None else list(_STORE.get(session_key, [])))
        buf.append(message)
        _FETCHED_AT[session_key] = time.time()
        snapshot = list(buf)
    _save_to_db(session_key, snapshot)


def get(session_key: str) -> List[str]:
    """Return recent lines for this session, newest last. Never raises."""
    if not session_key:
        return []
    with _LOCK:
        buf = _cached(session_key)
        if buf is not None:
            return list(buf)
    loaded = _load_from_db(session_key)
    if loaded is None:
        # Database unreachable — fall back to whatever this process holds.
        with _LOCK:
            return list(_STORE.get(session_key, []))
    with _LOCK:
        return list(_put_cache(session_key, loaded))


def clear(session_key: str) -> None:
    """Forget a session everywhere. Never raises."""
    if not session_key:
        return
    with _LOCK:
        _STORE.pop(session_key, None)
        _FETCHED_AT.pop(session_key, None)

    db = _session_scope()
    if db is None:
        return
    try:
        from ..models import ChatSession  # noqa: PLC0415

        db.query(ChatSession).filter(ChatSession.session_id == session_key).delete()
        db.commit()
    except Exception as exc:  # noqa: BLE001
        logger.warning("[short_memory] clear failed for %s: %s", session_key, exc)
        try:
            db.rollback()
        except Exception:  # noqa: BLE001
            pass
    finally:
        db.close()
