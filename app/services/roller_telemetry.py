"""
roller_telemetry.py — Compaction tracker (Ship H).

Receives accelerometer / GPS samples streamed from a phone strapped to a
roller, computes a rolling pass-count per spatial cell, an IRI proxy
(stddev of vertical accel within window), and exposes the latest state
per session. Persists to a single JSON file (atomic) for ops review.

Sample shape (POST /samples):
    { session_id, lat, lng, vert_accel_g, speed_mph?, heading_deg?, t_ms? }

Cells are ~3m x 3m squares (~1e-5 deg). Pass count == unique session
crossings into a cell. IRI proxy = stddev of |vert_accel_g - 1| over
trailing 64 samples.
"""

from __future__ import annotations

import json
import logging
import math
import os
import statistics
import tempfile
import threading
import time
from collections import deque
from pathlib import Path
from typing import Optional

from .durable_storage import durable_data_dir

logger = logging.getLogger(__name__)

_STATE_PATH = Path(
    os.environ.get("ROLLER_STATE_PATH")
    or str(durable_data_dir() / "jworden_roller_state.json")
)
_LOCK = threading.Lock()
_STATE: dict | None = None
_RECENT: dict[str, deque] = {}  # session_id -> deque of |g-1|
_WINDOW = 64

CELL_DEG = 1e-5 * 3  # ≈ 3 meters


def _empty() -> dict:
    return {"sessions": {}}


def _load() -> dict:
    global _STATE
    if _STATE is not None:
        return _STATE
    if not _STATE_PATH.exists():
        _STATE = _empty()
        return _STATE
    try:
        data = json.loads(_STATE_PATH.read_text(encoding="utf-8") or "{}")
        if not isinstance(data, dict):
            raise ValueError("root must be object")
        data.setdefault("sessions", {})
        _STATE = data
    except Exception as exc:
        logger.exception("roller state load failed: %s", exc)
        _STATE = _empty()
    return _STATE


def _save(data: dict) -> None:
    _STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".roller_", dir=str(_STATE_PATH.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, sort_keys=True)
        os.replace(tmp, _STATE_PATH)
    finally:
        if os.path.exists(tmp):
            try:
                os.unlink(tmp)
            except OSError:
                pass


def _cell(lat: float, lng: float) -> str:
    cx = math.floor(lat / CELL_DEG)
    cy = math.floor(lng / CELL_DEG)
    return f"{cx}:{cy}"


def start_session(session_id: str, *, job_id: Optional[str] = None,
                  operator: Optional[str] = None, mix: Optional[str] = None) -> dict:
    with _LOCK:
        data = _load()
        sess = data["sessions"].setdefault(session_id, {
            "session_id": session_id,
            "job_id": job_id,
            "operator": operator,
            "mix": mix,
            "started_at": int(time.time()),
            "last_at": int(time.time()),
            "samples": 0,
            "cells": {},                 # cell -> {passes, last_g, iri_proxy}
            "last_cell": None,
        })
        # update mutable fields without overwriting timestamps
        if job_id: sess["job_id"] = job_id
        if operator: sess["operator"] = operator
        if mix: sess["mix"] = mix
        _save(data)
        return sess


def ingest(session_id: str, *, lat: float, lng: float, vert_accel_g: float,
           speed_mph: Optional[float] = None, heading_deg: Optional[float] = None,
           t_ms: Optional[int] = None) -> dict:
    cell = _cell(lat, lng)
    dq = _RECENT.setdefault(session_id, deque(maxlen=_WINDOW))
    dq.append(abs(vert_accel_g - 1.0))
    iri = statistics.pstdev(dq) if len(dq) >= 4 else 0.0

    with _LOCK:
        data = _load()
        sess = data["sessions"].setdefault(session_id, {
            "session_id": session_id,
            "started_at": int(time.time()),
            "samples": 0,
            "cells": {},
            "last_cell": None,
        })
        sess["last_at"] = int(t_ms / 1000) if t_ms else int(time.time())
        sess["samples"] = sess.get("samples", 0) + 1
        info = sess["cells"].setdefault(cell, {"passes": 0, "samples": 0})
        info["samples"] += 1
        # Count a new pass when entering this cell from a different one
        if sess.get("last_cell") != cell:
            info["passes"] += 1
            sess["last_cell"] = cell
        info["last_g"] = round(vert_accel_g, 3)
        info["iri_proxy"] = round(iri, 4)
        if speed_mph is not None: info["last_speed"] = speed_mph
        if heading_deg is not None: info["last_heading"] = heading_deg
        _save(data)
        return {"cell": cell, "passes": info["passes"], "iri_proxy": info["iri_proxy"]}


def end_session(session_id: str) -> bool:
    with _LOCK:
        data = _load()
        sess = data["sessions"].get(session_id)
        if not sess:
            return False
        sess["ended_at"] = int(time.time())
        _save(data)
        _RECENT.pop(session_id, None)
        return True


def get_session(session_id: str) -> Optional[dict]:
    with _LOCK:
        data = _load()
        sess = data["sessions"].get(session_id)
        if not sess:
            return None
        cells = sess.get("cells", {})
        passes = [c["passes"] for c in cells.values()] or [0]
        iris = [c.get("iri_proxy", 0) for c in cells.values()] or [0]
        return {
            **sess,
            "summary": {
                "cells": len(cells),
                "max_pass": max(passes),
                "avg_pass": round(sum(passes) / max(len(passes), 1), 2),
                "avg_iri": round(sum(iris) / max(len(iris), 1), 4),
            },
        }


def list_sessions() -> list[dict]:
    with _LOCK:
        data = _load()
        rows = []
        for s in data["sessions"].values():
            rows.append({
                "session_id": s["session_id"],
                "job_id": s.get("job_id"),
                "operator": s.get("operator"),
                "started_at": s.get("started_at"),
                "last_at": s.get("last_at"),
                "ended_at": s.get("ended_at"),
                "samples": s.get("samples", 0),
                "cells": len(s.get("cells", {})),
            })
        return sorted(rows, key=lambda r: r.get("last_at", 0), reverse=True)


def snapshot() -> dict:
    return {"state_path": str(_STATE_PATH), "sessions": list_sessions(), "cell_meters": 3}
