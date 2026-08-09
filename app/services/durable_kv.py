"""
durable_kv.py — Postgres-backed key/value store for small pieces of state that
MUST survive a redeploy and MUST be identical on every machine.

WHY THIS EXISTS (verified 2026-07-26, do not "simplify" back to files):

`durable_storage.durable_data_dir()` resolves to a mounted volume if one
exists and otherwise falls back to /tmp. On the live Fly app `jworden-api`
there are **zero volumes attached** (`flyctl volumes list -a jworden-api`
returns an empty table), so that fallback is what actually runs in
production — meaning file-backed "durable" state was still being wiped on
every redeploy.

Attaching a Fly volume would not fix it either. `jworden-api` runs **two**
machines, and a Fly volume attaches to exactly one machine. Two machines
would each get their own copy and silently diverge — which for the Jarvis
kill switch means machine A honours a freeze while machine B keeps acting
autonomously. That is strictly worse than the bug it would be fixing.

Postgres (DATABASE_URL, already configured and in use) is the one store that
is both durable across redeploys and shared by every machine. So small
control-plane state lives here.

Scope — this is deliberately NOT a blob store. Uploaded staff photos, signed
documents, drone/lidar captures are files and still land on
durable_data_dir(); those need a real volume or object storage and are
tracked separately. Do not stuff binaries in here.

Contract:
  - Nothing in this module raises. Every call degrades to the caller's own
    fallback (usually the local file) so a database blip can never take the
    API down or, worse, silently un-freeze autonomy.
  - Values are opaque strings; callers serialise/deserialise their own JSON.
  - Last write wins, exactly like the file store it replaces.
"""

from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

# Set once we've established there is no usable database, so we stop paying
# the connection-attempt cost on every read in a SQLite/local dev run.
_DISABLED = False


def _enabled() -> bool:
    """True only when a real (non-SQLite) database is configured."""
    global _DISABLED
    if _DISABLED:
        return False
    url = (os.getenv("DATABASE_URL") or "").strip()
    if not url or url.startswith("sqlite"):
        # Local dev with the SQLite fallback: the file store is already
        # durable there (it's the developer's own disk), so there is nothing
        # to gain and a circular-import risk to avoid.
        _DISABLED = True
        return False
    return True


def _table():
    """Imported lazily — app.models imports app.database, and this module is
    itself imported by runtime_config, which is imported very early."""
    from ..models import DurableKV  # noqa: PLC0415

    return DurableKV


def get(key: str) -> str | None:
    """Return the stored value, or None if absent/unavailable."""
    if not _enabled():
        return None
    try:
        from ..database import SessionLocal  # noqa: PLC0415

        DurableKV = _table()
        db = SessionLocal()
        try:
            row = db.query(DurableKV).filter(DurableKV.key == key).one_or_none()
            return row.value if row else None
        finally:
            db.close()
    except Exception as exc:  # noqa: BLE001
        logger.warning("durable_kv.get(%s) failed, falling back to file: %s", key, exc)
        return None


def set(key: str, value: str) -> bool:  # noqa: A001 - deliberate KV verb
    """Upsert a value. Returns True only if it was actually persisted."""
    if not _enabled():
        return False
    try:
        from datetime import datetime, timezone  # noqa: PLC0415

        from ..database import SessionLocal  # noqa: PLC0415

        DurableKV = _table()
        db = SessionLocal()
        try:
            row = db.query(DurableKV).filter(DurableKV.key == key).one_or_none()
            if row is None:
                row = DurableKV(key=key, value=value)
                db.add(row)
            else:
                row.value = value
                row.updated_at = datetime.now(timezone.utc)
            db.commit()
            return True
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()
    except Exception as exc:  # noqa: BLE001
        logger.warning("durable_kv.set(%s) failed, file store is now authoritative: %s", key, exc)
        return False


def delete(key: str) -> bool:
    if not _enabled():
        return False
    try:
        from ..database import SessionLocal  # noqa: PLC0415

        DurableKV = _table()
        db = SessionLocal()
        try:
            db.query(DurableKV).filter(DurableKV.key == key).delete()
            db.commit()
            return True
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()
    except Exception as exc:  # noqa: BLE001
        logger.warning("durable_kv.delete(%s) failed: %s", key, exc)
        return False


def available() -> bool:
    """Cheap health probe for the admin UI: can we actually reach the store?"""
    if not _enabled():
        return False
    try:
        from ..database import SessionLocal  # noqa: PLC0415

        DurableKV = _table()
        db = SessionLocal()
        try:
            db.query(DurableKV).limit(1).all()
            return True
        finally:
            db.close()
    except Exception:  # noqa: BLE001
        return False
