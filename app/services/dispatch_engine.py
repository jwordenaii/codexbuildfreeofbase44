"""
dispatch_engine.py — Dump-truck logistics for paving jobs.

Owner-managed, premium tier. In-memory roster (trucks + drivers + jobs)
with optional Google Maps Distance Matrix integration to auto-rank truck
assignments by drive-time + load capacity vs job demand.

Persistence: file-backed JSON at DISPATCH_STATE_PATH (defaults next to
runtime config dir). Atomic write, single lock.

Public surface (consumed by app/routers/dispatch_router.py):

    list_trucks() / upsert_truck(payload)            / delete_truck(id)
    list_drivers() / upsert_driver(payload)          / delete_driver(id)
    list_jobs()   / upsert_job(payload)              / delete_job(id)
    assign(job_id)            → recommended truck+driver ranked by score
    snapshot()                → full state for the UI

The scoring fn is intentionally simple so it works fully offline. When a
GOOGLE_MAPS_API_KEY is present and lat/lng are filled in, real drive-time
replaces haversine distance.
"""

from __future__ import annotations

import json
import logging
import math
import os
import tempfile
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Optional

import httpx

from . import runtime_config
from .durable_storage import durable_data_dir

logger = logging.getLogger(__name__)

_STATE_PATH = Path(
    os.environ.get("DISPATCH_STATE_PATH")
    or str(durable_data_dir() / "jworden_dispatch_state.json")
)
_LOCK = threading.Lock()
_STATE: dict[str, dict[str, dict]] | None = None  # {trucks:{id:row}, drivers:{...}, jobs:{...}}


# ── Persistence ───────────────────────────────────────────────────────────────

def _empty_state() -> dict[str, dict[str, dict]]:
    return {"trucks": {}, "drivers": {}, "jobs": {}}


def _load() -> dict[str, dict[str, dict]]:
    global _STATE
    if _STATE is not None:
        return _STATE
    if not _STATE_PATH.exists():
        _STATE = _empty_state()
        return _STATE
    try:
        raw = _STATE_PATH.read_text(encoding="utf-8")
        data = json.loads(raw or "{}")
        if not isinstance(data, dict):
            raise ValueError("dispatch state root must be an object")
        for k in ("trucks", "drivers", "jobs"):
            data.setdefault(k, {})
            if not isinstance(data[k], dict):
                data[k] = {}
        _STATE = data
    except Exception as exc:
        logger.exception("dispatch state load failed; starting empty: %s", exc)
        _STATE = _empty_state()
    return _STATE


def _save(data: dict) -> None:
    _STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".dispatch_", dir=str(_STATE_PATH.parent))
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


# ── CRUD helpers ──────────────────────────────────────────────────────────────

_ALLOWED_TRUCK_FIELDS = {
    "id", "name", "plate", "capacity_tons", "type", "status", "lat", "lng",
    "home_yard", "notes", "active",
}
_ALLOWED_DRIVER_FIELDS = {
    "id", "name", "phone", "cdl_class", "status", "shift_start", "shift_end",
    "preferred_truck_id", "notes", "active",
}
_ALLOWED_JOB_FIELDS = {
    "id", "site_name", "address", "lat", "lng", "tons_needed", "lift_count",
    "scheduled_start", "scheduled_end", "priority", "status", "notes",
    "assigned_truck_id", "assigned_driver_id",
}


def _normalize(payload: dict, allowed: set[str]) -> dict:
    out: dict = {}
    for k, v in (payload or {}).items():
        if k in allowed and v is not None:
            out[k] = v
    return out


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def list_trucks() -> list[dict]:
    with _LOCK:
        data = _load()
        return sorted(data["trucks"].values(), key=lambda r: r.get("name", ""))


def list_drivers() -> list[dict]:
    with _LOCK:
        data = _load()
        return sorted(data["drivers"].values(), key=lambda r: r.get("name", ""))


def list_jobs() -> list[dict]:
    with _LOCK:
        data = _load()
        return sorted(data["jobs"].values(), key=lambda r: r.get("scheduled_start", ""))


def upsert_truck(payload: dict) -> dict:
    row = _normalize(payload, _ALLOWED_TRUCK_FIELDS)
    if not row.get("name"):
        raise ValueError("truck.name required")
    row.setdefault("status", "available")
    row.setdefault("active", True)
    row.setdefault("capacity_tons", 14.0)
    with _LOCK:
        data = _load()
        rid = row.get("id") or _new_id("trk")
        row["id"] = rid
        data["trucks"][rid] = row
        _save(data)
        return row


def upsert_driver(payload: dict) -> dict:
    row = _normalize(payload, _ALLOWED_DRIVER_FIELDS)
    if not row.get("name"):
        raise ValueError("driver.name required")
    row.setdefault("status", "available")
    row.setdefault("active", True)
    with _LOCK:
        data = _load()
        rid = row.get("id") or _new_id("drv")
        row["id"] = rid
        data["drivers"][rid] = row
        _save(data)
        return row


def upsert_job(payload: dict) -> dict:
    row = _normalize(payload, _ALLOWED_JOB_FIELDS)
    if not row.get("site_name"):
        raise ValueError("job.site_name required")
    row.setdefault("status", "scheduled")
    row.setdefault("priority", "normal")
    row.setdefault("tons_needed", 0.0)
    with _LOCK:
        data = _load()
        rid = row.get("id") or _new_id("job")
        row["id"] = rid
        data["jobs"][rid] = row
        _save(data)
        return row


def delete_truck(rid: str) -> bool:
    with _LOCK:
        data = _load()
        existed = data["trucks"].pop(rid, None) is not None
        if existed:
            _save(data)
        return existed


def delete_driver(rid: str) -> bool:
    with _LOCK:
        data = _load()
        existed = data["drivers"].pop(rid, None) is not None
        if existed:
            _save(data)
        return existed


def delete_job(rid: str) -> bool:
    with _LOCK:
        data = _load()
        existed = data["jobs"].pop(rid, None) is not None
        if existed:
            _save(data)
        return existed


# ── Routing & scoring ─────────────────────────────────────────────────────────

def _haversine_mi(a_lat: float, a_lng: float, b_lat: float, b_lng: float) -> float:
    R = 3958.8
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dphi = math.radians(b_lat - a_lat)
    dl = math.radians(b_lng - a_lng)
    h = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


async def _maps_drive_minutes(o_lat, o_lng, d_lat, d_lng) -> Optional[float]:
    key = (runtime_config.get("GOOGLE_MAPS_API_KEY") or "").strip()
    if not key:
        return None
    try:
        params = {
            "origins": f"{o_lat},{o_lng}",
            "destinations": f"{d_lat},{d_lng}",
            "mode": "driving",
            "key": key,
        }
        async with httpx.AsyncClient(timeout=8.0) as c:
            r = await c.get("https://maps.googleapis.com/maps/api/distancematrix/json", params=params)
        data = r.json()
        elem = data["rows"][0]["elements"][0]
        if elem.get("status") != "OK":
            return None
        return float(elem["duration"]["value"]) / 60.0
    except Exception as exc:
        logger.debug("maps drive_minutes failed: %s", exc)
        return None


async def assign(job_id: str) -> dict:
    """Rank available trucks+drivers for the given job. Returns {job, ranked:[...]}."""
    with _LOCK:
        data = _load()
        job = data["jobs"].get(job_id)
        if not job:
            raise KeyError(f"job {job_id} not found")
        trucks = [t for t in data["trucks"].values() if t.get("active") and t.get("status") != "out-of-service"]
        drivers = [d for d in data["drivers"].values() if d.get("active") and d.get("status") != "off-duty"]

    tons_needed = float(job.get("tons_needed") or 0)
    j_lat, j_lng = job.get("lat"), job.get("lng")
    ranked: list[dict] = []
    for t in trucks:
        cap = float(t.get("capacity_tons") or 0)
        cap_score = min(1.0, cap / max(1.0, tons_needed)) if tons_needed else 1.0
        # distance / drive time
        miles = None
        drive_min = None
        if isinstance(j_lat, (int, float)) and isinstance(j_lng, (int, float)) and \
           isinstance(t.get("lat"), (int, float)) and isinstance(t.get("lng"), (int, float)):
            miles = _haversine_mi(t["lat"], t["lng"], j_lat, j_lng)
            drive_min = await _maps_drive_minutes(t["lat"], t["lng"], j_lat, j_lng)
        # score: prefer high capacity match + low drive time
        time_penalty = 0.0
        if drive_min is not None:
            time_penalty = min(1.0, drive_min / 90.0)
        elif miles is not None:
            time_penalty = min(1.0, miles / 75.0)
        score = round((cap_score * 0.6) + ((1 - time_penalty) * 0.4), 3)
        # pair with best free driver (preferred match wins)
        preferred = next((d for d in drivers if d.get("preferred_truck_id") == t["id"]), None)
        driver = preferred or (drivers[0] if drivers else None)
        ranked.append({
            "truck": t,
            "driver": driver,
            "miles": round(miles, 1) if miles is not None else None,
            "drive_minutes": round(drive_min, 1) if drive_min is not None else None,
            "capacity_score": round(cap_score, 3),
            "score": score,
        })
    ranked.sort(key=lambda r: r["score"], reverse=True)
    return {"job": job, "ranked": ranked, "ts": int(time.time())}


def snapshot() -> dict:
    with _LOCK:
        data = _load()
        return {
            "trucks": list(data["trucks"].values()),
            "drivers": list(data["drivers"].values()),
            "jobs": list(data["jobs"].values()),
            "maps_configured": bool((runtime_config.get("GOOGLE_MAPS_API_KEY") or "").strip()),
        }
