"""
lidar_ingest.py — iPhone LiDAR / 3D scan ingestion + parcel matcher (Ship G).

Accepts USDZ / OBJ / PLY / GLB scans uploaded from a phone in the field,
stores them per parcel/job, persists a manifest, and (when given a
lat/lng) attempts a best-effort parcel match using a simple nearest-
parcel lookup over an optional CSV registry.

Parcel registry: file at PARCEL_REGISTRY_PATH (CSV with header
parcel_id,owner,address,lat,lng,acres). When unset or missing, parcel
matching returns null but the scan still ingests cleanly.

Storage layout: LIDAR_STORAGE_PATH/<parcel_id_or_unmatched>/<scan_id>_<filename>
(defaults to a mounted volume at /data if one exists, else /tmp — see
durable_storage.py).
"""

from __future__ import annotations

import csv
import json
import logging
import math
import os
import tempfile
import threading
import time
import uuid
from pathlib import Path
from typing import Optional

from .durable_storage import durable_data_dir

logger = logging.getLogger(__name__)

_STORAGE = Path(os.environ.get("LIDAR_STORAGE_PATH") or str(durable_data_dir() / "jworden_lidar"))
_MANIFEST = Path(
    os.environ.get("LIDAR_MANIFEST_PATH")
    or str(durable_data_dir() / "jworden_lidar_manifest.json")
)
_PARCEL_CSV = Path(os.environ.get("PARCEL_REGISTRY_PATH", ""))
_LOCK = threading.Lock()
_PARCEL_LOCK = threading.Lock()
_STATE: dict | None = None
_PARCELS: list[dict] | None = None

ALLOWED_CT = {
    "model/vnd.usdz+zip", "model/usd",
    "model/obj", "text/plain",
    "model/gltf-binary", "model/gltf+json",
    "application/octet-stream", "application/zip",
    "model/ply", "application/x-ply",
}
MAX_BYTES = int(os.environ.get("LIDAR_MAX_BYTES", str(500 * 1024 * 1024)))


def _empty() -> dict:
    return {"scans": {}, "parcels": {}}  # parcels keyed by parcel_id-or-"unmatched"


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
        data.setdefault("scans", {})
        data.setdefault("parcels", {})
        _STATE = data
    except Exception as exc:
        logger.exception("lidar manifest load failed: %s", exc)
        _STATE = _empty()
    return _STATE


def _save(data: dict) -> None:
    _MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".lidar_", dir=str(_MANIFEST.parent))
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


def _load_parcels() -> list[dict]:
    global _PARCELS
    if _PARCELS is not None:
        return _PARCELS
    rows: list[dict] = []
    if _PARCEL_CSV and _PARCEL_CSV.exists():
        try:
            with _PARCEL_CSV.open("r", encoding="utf-8", newline="") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        row["lat"] = float(row.get("lat", ""))
                        row["lng"] = float(row.get("lng", ""))
                    except (TypeError, ValueError):
                        continue
                    rows.append(row)
        except Exception as exc:
            logger.warning("parcel registry load failed: %s", exc)
    _PARCELS = rows
    return _PARCELS


def _safe(name: str) -> str:
    base = Path(name or "scan").name
    return "".join(ch for ch in base if ch.isalnum() or ch in "._-")[:140] or "scan"


def _haversine_mi(a_lat: float, a_lng: float, b_lat: float, b_lng: float) -> float:
    R = 3958.8
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dphi = math.radians(b_lat - a_lat)
    dl = math.radians(b_lng - a_lng)
    h = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def match_parcel(lat: Optional[float], lng: Optional[float], radius_mi: float = 0.25) -> Optional[dict]:
    if lat is None or lng is None:
        return None
    with _PARCEL_LOCK:
        parcels = _load_parcels()
    if not parcels:
        return None
    best = None
    best_d = float("inf")
    for p in parcels:
        d = _haversine_mi(lat, lng, p["lat"], p["lng"])
        if d < best_d:
            best_d = d
            best = p
    if best and best_d <= radius_mi:
        return {**best, "distance_mi": round(best_d, 4)}
    return None


def store_scan(
    *,
    filename: str,
    content_type: Optional[str],
    body: bytes,
    job_id: Optional[str] = None,
    parcel_id: Optional[str] = None,
    gps_lat: Optional[float] = None,
    gps_lng: Optional[float] = None,
    captured_at: Optional[str] = None,
    operator: Optional[str] = None,
    notes: Optional[str] = None,
) -> dict:
    if len(body) > MAX_BYTES:
        raise ValueError(f"file too large ({len(body)} > {MAX_BYTES})")
    ct = (content_type or "application/octet-stream").lower()
    if ct not in ALLOWED_CT:
        raise ValueError(f"content_type {ct} not allowed")

    matched = None
    if not parcel_id and gps_lat is not None and gps_lng is not None:
        matched = match_parcel(gps_lat, gps_lng)
        if matched:
            parcel_id = matched.get("parcel_id")

    bucket = _safe(parcel_id or "unmatched")
    scan_dir = _STORAGE / bucket
    scan_dir.mkdir(parents=True, exist_ok=True)
    sid = uuid.uuid4().hex[:12]
    fname = f"{sid}_{_safe(filename)}"
    path = scan_dir / fname
    path.write_bytes(body)

    row = {
        "id": sid,
        "job_id": job_id,
        "parcel_id": parcel_id,
        "matched_parcel": matched,
        "filename": _safe(filename),
        "stored_path": str(path),
        "content_type": ct,
        "bytes": len(body),
        "gps_lat": gps_lat,
        "gps_lng": gps_lng,
        "captured_at": captured_at,
        "uploaded_at": int(time.time()),
        "operator": operator,
        "notes": notes,
    }

    with _LOCK:
        data = _load()
        data["scans"].setdefault(bucket, []).append(row)
        meta = data["parcels"].setdefault(bucket, {
            "bucket": bucket,
            "parcel_id": parcel_id,
            "first_scan_at": row["uploaded_at"],
        })
        meta["last_scan_at"] = row["uploaded_at"]
        meta["count"] = len(data["scans"][bucket])
        _save(data)
    return row


def list_scans(bucket: str) -> list[dict]:
    with _LOCK:
        data = _load()
        return list(data["scans"].get(bucket, []))


def list_parcels() -> list[dict]:
    with _LOCK:
        data = _load()
        return sorted(data["parcels"].values(), key=lambda j: j.get("last_scan_at", 0), reverse=True)


def delete_scan(bucket: str, scan_id: str) -> bool:
    with _LOCK:
        data = _load()
        rows = data["scans"].get(bucket, [])
        for r in list(rows):
            if r["id"] == scan_id:
                rows.remove(r)
                try:
                    Path(r["stored_path"]).unlink(missing_ok=True)
                except Exception as exc:
                    logger.debug("unlink %s failed: %s", r["stored_path"], exc)
                if not rows:
                    data["scans"].pop(bucket, None)
                    data["parcels"].pop(bucket, None)
                else:
                    data["parcels"][bucket]["count"] = len(rows)
                _save(data)
                return True
        return False


def snapshot() -> dict:
    with _LOCK:
        data = _load()
        with _PARCEL_LOCK:
            parcels_loaded = len(_load_parcels())
        return {
            "storage_path": str(_STORAGE),
            "max_bytes": MAX_BYTES,
            "parcel_registry": str(_PARCEL_CSV) if _PARCEL_CSV else None,
            "parcels_loaded": parcels_loaded,
            "buckets": list(data["parcels"].values()),
            "total_scans": sum(len(v) for v in data["scans"].values()),
        }
