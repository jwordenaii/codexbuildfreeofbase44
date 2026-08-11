"""
autonomy_state.py — Single source of truth for the Jarvis kill switch.

Defense-in-depth layer 2: even if the frontend is compromised or bypassed,
the backend will refuse autonomous action when frozen.

Design:
  - Persisted to a JSON file (path from env JARVIS_AUTONOMY_STATE_PATH,
    default: the durable data dir, see durable_storage.py) so a freeze
    survives both a process restart and a redeploy.
  - Thread-safe via a single module-level lock.
  - Read is cheap; check before any autonomous side-effect.
  - "frozen" forces master=False and disables all per-domain switches.
"""
from __future__ import annotations
import json
import os
import threading
from datetime import datetime, timezone
from typing import Any

from . import durable_kv
from .durable_storage import durable_data_dir

# SAFETY: this holds the Jarvis kill switch (`frozen`), so losing it is not a
# cosmetic bug — it silently re-enables autonomous action that an operator
# deliberately stopped.
#
# Two distinct ways that used to happen, both fixed here:
#   1. Redeploy. The state file lived on /tmp, and jworden-api has no volume
#      mounted, so every deploy reset `frozen` back to False.
#   2. Divergence. jworden-api runs two machines. Any file-based store gives
#      each machine its own copy, so a freeze issued against machine A would
#      leave machine B happily acting on its own.
# Postgres is durable AND shared, so it is the source of truth. The file is
# kept only as a fallback for when the database is unreachable.
_KV_KEY = "jarvis_autonomy"
_STATE_PATH = os.environ.get("JARVIS_AUTONOMY_STATE_PATH") or str(
    durable_data_dir() / "jarvis_autonomy.json"
)
_LOCK = threading.Lock()

_DEFAULT: dict[str, Any] = {
    "master":   False,
    "domains":  {},
    "frozen":   False,
    "frozenAt": None,
    "reason":   None,
    "updatedAt": None,
}


def _merged(data: Any) -> dict[str, Any] | None:
    if not isinstance(data, dict):
        return None
    merged = dict(_DEFAULT)
    merged.update(data)
    return merged


def _read_disk() -> dict[str, Any]:
    """
    Read current state. Postgres wins; the file is consulted only when the
    database is unreachable or has never been written.

    Fail-safe direction matters here: if BOTH stores are unreadable we return
    _DEFAULT, which has frozen=False *and* master=False. So a storage outage
    degrades to "autonomy off", never to "autonomy on".
    """
    raw = durable_kv.get(_KV_KEY)
    if raw:
        try:
            merged = _merged(json.loads(raw))
            if merged is not None:
                return merged
        except json.JSONDecodeError:
            pass

    try:
        with open(_STATE_PATH, "r", encoding="utf-8") as f:
            merged = _merged(json.load(f))
        if merged is None:
            return dict(_DEFAULT)
        # Promote pre-KV state so the next redeploy keeps it.
        if raw is None:
            durable_kv.set(_KV_KEY, json.dumps(merged))
        return merged
    except FileNotFoundError:
        return dict(_DEFAULT)
    except (OSError, json.JSONDecodeError):
        return dict(_DEFAULT)


def _write_disk(state: dict[str, Any]) -> None:
    durable_kv.set(_KV_KEY, json.dumps(state))
    try:
        os.makedirs(os.path.dirname(_STATE_PATH) or ".", exist_ok=True)
        tmp = _STATE_PATH + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(state, f)
        os.replace(tmp, _STATE_PATH)
    except OSError:
        # File cache failed — Postgres (if reachable) still holds the state,
        # and it is the authoritative store.
        pass


def get_state() -> dict[str, Any]:
    with _LOCK:
        return _read_disk()


def is_frozen() -> bool:
    return bool(get_state().get("frozen"))


def freeze(reason: str = "manual") -> dict[str, Any]:
    with _LOCK:
        state = _read_disk()
        state["master"]    = False
        state["domains"]   = {}
        state["frozen"]    = True
        state["frozenAt"]  = datetime.now(timezone.utc).isoformat()
        state["reason"]    = str(reason)[:200]
        state["updatedAt"] = state["frozenAt"]
        _write_disk(state)
        return state


def unfreeze() -> dict[str, Any]:
    with _LOCK:
        state = _read_disk()
        state["frozen"]    = False
        state["frozenAt"]  = None
        state["reason"]    = None
        state["updatedAt"] = datetime.now(timezone.utc).isoformat()
        _write_disk(state)
        return state


def set_master(enabled: bool) -> dict[str, Any]:
    with _LOCK:
        state = _read_disk()
        if state.get("frozen"):
            return state  # cannot toggle while frozen
        state["master"]    = bool(enabled)
        state["updatedAt"] = datetime.now(timezone.utc).isoformat()
        _write_disk(state)
        return state


def set_domain(domain_id: str, enabled: bool) -> dict[str, Any]:
    with _LOCK:
        state = _read_disk()
        if state.get("frozen") or not state.get("master"):
            return state
        domains = dict(state.get("domains") or {})
        domains[str(domain_id)] = bool(enabled)
        state["domains"]   = domains
        state["updatedAt"] = datetime.now(timezone.utc).isoformat()
        _write_disk(state)
        return state
