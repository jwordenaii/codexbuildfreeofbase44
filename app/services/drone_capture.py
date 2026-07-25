"""
drone_capture.py — Drone media capture pipeline (Ship F).

Stores uploaded photos/videos for a given job, persists a per-job manifest
(JSON), extracts basic metadata when present (filename, size, content type,
optional gps_lat/gps_lng/altitude/captured_at fields supplied by the
uploader), and exposes ortho-ready file groupings.

This intentionally does NOT bundle a heavy GIS stack — orthomosaic
stitching is delegated to an external worker (e.g., OpenDroneMap, WebODM,
or the Maps Platform) and is triggered by a future job runner. We just
collect the inputs and track state.

Storage: DRONE_STORAGE_PATH (defaults to a mounted volume at /data if one
exists, else /tmp — see durable_storage.py). One folder per job_id.
Manifest is jworden_drone_manifest.json alongside it.
"""

from __future__ import annotations

import json
import logging
import os
import tempfile
import threading
import time
import uuid
from pathlib import Path
from typing import Optional

from .durable_storage import durable_data_dir

logger = logging.getLogger(__name__)

_STORAGE = Path(os.environ.get("DRONE_STORAGE_PATH") or str(durable_data_dir() / "jworden_drone"))
_MANIFEST = Path(
    os.environ.get("DRONE_MANIFEST_PATH")
    or str(durable_data_dir() / "jworden_drone_manifest.json")
)
_LOCK = threading.Lock()
_STATE: dict | None = None  # {captures: {job_id: [row]}, jobs: {job_id: meta}}

ALLOWED_CT = {
    "image/jpeg", "image/png", "image/heic", "image/heif", "image/tiff",
    "video/mp4", "video/quicktime", "application/octet-stream",
}
MAX_BYTES = int(os.environ.get("DRONE_MAX_BYTES", str(150 * 1024 * 1024)))  # 150 MB default


def _empty() -> dict:
    return {"captures": {}, "jobs": {}}


def _load() -> dict:
    global _STATE
    if _STATE is not None:
        return _STATE
    if not _MANIFEST.exists():
        _STATE = _empty()
        return _STATE
    try:
        data = json.loads(_MANIFEST.read_text(encoding="utf-8") or "{}")
        if not isinstance(data, dict):
            raise ValueError("manifest root must be object")
        data.setdefault("captures", {})
        data.setdefault("jobs", {})
        _STATE = data
    except Exception as exc:
        logger.exception("drone manifest load failed: %s", exc)
        _STATE = _empty()
    return _STATE


def _save(data: dict) -> None:
    _MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".drone_", dir=str(_MANIFEST.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, sort_keys=True)
        os.replace(tmp, _MANIFEST)
    finally:
        if os.path.exists(tmp):
            try:
                os.unlink(tmp)
            except OSError:
                pass


def _safe_filename(name: str) -> str:
    base = Path(name or "capture").name
    # strip nasty chars
    return "".join(ch for ch in base if ch.isalnum() or ch in "._-")[:120] or "capture"


def store_capture(
    job_id: str,
    filename: str,
    content_type: Optional[str],
    body: bytes,
    *,
    gps_lat: Optional[float] = None,
    gps_lng: Optional[float] = None,
    altitude_m: Optional[float] = None,
    captured_at: Optional[str] = None,
    notes: Optional[str] = None,
    pilot: Optional[str] = None,
) -> dict:
    if not job_id or not job_id.strip():
        raise ValueError("job_id required")
    job_id = job_id.strip()
    if len(body) > MAX_BYTES:
        raise ValueError(f"file too large ({len(body)} > {MAX_BYTES})")
    ct = (content_type or "application/octet-stream").lower()
    if ct not in ALLOWED_CT:
        raise ValueError(f"content_type {ct} not allowed")

    job_dir = _STORAGE / _safe_filename(job_id)
    job_dir.mkdir(parents=True, exist_ok=True)
    cap_id = uuid.uuid4().hex[:12]
    safe = _safe_filename(filename)
    fname = f"{cap_id}_{safe}"
    path = job_dir / fname
    path.write_bytes(body)

    row = {
        "id": cap_id,
        "job_id": job_id,
        "filename": safe,
        "stored_path": str(path),
        "content_type": ct,
        "bytes": len(body),
        "gps_lat": gps_lat,
        "gps_lng": gps_lng,
        "altitude_m": altitude_m,
        "captured_at": captured_at,
        "uploaded_at": int(time.time()),
        "pilot": pilot,
        "notes": notes,
    }
    with _LOCK:
        data = _load()
        data["captures"].setdefault(job_id, []).append(row)
        data["jobs"].setdefault(job_id, {"job_id": job_id, "first_capture_at": row["uploaded_at"]})
        data["jobs"][job_id]["last_capture_at"] = row["uploaded_at"]
        data["jobs"][job_id]["count"] = len(data["captures"][job_id])
        _save(data)
    return row


def list_captures(job_id: str) -> list[dict]:
    with _LOCK:
        data = _load()
        return list(data["captures"].get(job_id, []))


def list_jobs() -> list[dict]:
    with _LOCK:
        data = _load()
        return sorted(data["jobs"].values(), key=lambda j: j.get("last_capture_at", 0), reverse=True)


def delete_capture(job_id: str, capture_id: str) -> bool:
    with _LOCK:
        data = _load()
        rows = data["captures"].get(job_id, [])
        for r in list(rows):
            if r["id"] == capture_id:
                rows.remove(r)
                try:
                    Path(r["stored_path"]).unlink(missing_ok=True)
                except Exception as exc:
                    logger.debug("unlink %s failed: %s", r["stored_path"], exc)
                if not rows:
                    data["captures"].pop(job_id, None)
                    data["jobs"].pop(job_id, None)
                else:
                    data["jobs"][job_id]["count"] = len(rows)
                _save(data)
                return True
        return False


def snapshot() -> dict:
    with _LOCK:
        data = _load()
        return {
            "storage_path": str(_STORAGE),
            "max_bytes": MAX_BYTES,
            "jobs": list(data["jobs"].values()),
            "total_captures": sum(len(v) for v in data["captures"].values()),
        }
