"""
iot.py — JWORDENAI IoT Integration hub for construction hardware.

Routes:
  GET    /api/v1/iot/devices              — list registered IoT devices
  POST   /api/v1/iot/devices              — register a new device
  PUT    /api/v1/iot/devices/{id}         — update device metadata
  DELETE /api/v1/iot/devices/{id}         — decommission a device
  POST   /api/v1/iot/ingest               — ingest a batch of telemetry data points
  GET    /api/v1/iot/stream/{device_id}   — latest readings for a device
  GET    /api/v1/iot/health               — aggregated device-fleet health summary

Supported device types: drone | wearable | mixer | sensor | camera | other

Data pipelines are compatible with the JWORDENAI backend event bus and can be
extended to push readings to a time-series store (e.g. InfluxDB) via Celery
tasks without changing this API surface.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..core.limiter import limiter
from ..core.security import verify_premium_security
from ..database import get_db
from ..models import IoTDataPoint, IoTDevice

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/iot", tags=["iot"])

_VALID_DEVICE_TYPES = {"drone", "wearable", "mixer", "sensor", "camera", "other"}
_VALID_STATUSES = {"active", "inactive", "maintenance"}


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class DeviceCreate(BaseModel):
    device_id: str = Field(..., min_length=1, max_length=100)
    device_name: Optional[str] = None
    device_type: str                        # drone | wearable | mixer | sensor | camera | other
    manufacturer: Optional[str] = None
    firmware_version: Optional[str] = None
    job_site: Optional[str] = None
    status: str = "active"
    meta: Optional[dict] = None             # arbitrary key/value config


class DeviceUpdate(BaseModel):
    device_name: Optional[str] = None
    device_type: Optional[str] = None
    manufacturer: Optional[str] = None
    firmware_version: Optional[str] = None
    job_site: Optional[str] = None
    status: Optional[str] = None
    meta: Optional[dict] = None


class TelemetryPoint(BaseModel):
    device_id: str
    metric: str                             # e.g. "battery_pct", "temp_f", "altitude_ft"
    value_numeric: Optional[float] = None
    value_text: Optional[str] = None
    unit: Optional[str] = None
    recorded_at: Optional[str] = None      # ISO datetime; defaults to server time


class IngestRequest(BaseModel):
    readings: list[TelemetryPoint] = Field(..., min_length=1, max_length=500)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _device_dict(d: IoTDevice) -> dict:
    return {
        "id": d.id,
        "device_id": d.device_id,
        "device_name": d.device_name,
        "device_type": d.device_type,
        "manufacturer": d.manufacturer,
        "firmware_version": d.firmware_version,
        "job_site": d.job_site,
        "status": d.status,
        "last_seen_at": d.last_seen_at.isoformat() if d.last_seen_at else None,
        "meta": json.loads(d.meta_json) if d.meta_json else {},
        "created_at": d.created_at.isoformat(),
        "updated_at": d.updated_at.isoformat(),
    }


def _reading_dict(r: IoTDataPoint) -> dict:
    return {
        "id": r.id,
        "device_id": r.device_id,
        "metric": r.metric,
        "value_numeric": r.value_numeric,
        "value_text": r.value_text,
        "unit": r.unit,
        "recorded_at": r.recorded_at.isoformat(),
    }


def _parse_dt(s: Optional[str]) -> datetime:
    if not s:
        return datetime.now(timezone.utc)
    dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


# ── Device CRUD ───────────────────────────────────────────────────────────────

@router.get("/devices", summary="List registered IoT devices")
@limiter.limit("60/minute")
async def list_devices(
    request: Request,
    device_type: Optional[str] = Query(default=None),
    job_site: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    q = db.query(IoTDevice)
    if device_type:
        q = q.filter(IoTDevice.device_type == device_type)
    if job_site:
        q = q.filter(IoTDevice.job_site.ilike(f"%{job_site}%"))
    if status:
        q = q.filter(IoTDevice.status == status)
    total = q.count()
    rows = q.order_by(IoTDevice.device_id.asc()).offset(offset).limit(limit).all()
    return {"total": total, "devices": [_device_dict(d) for d in rows]}


@router.post("/devices", summary="Register a new IoT device")
@limiter.limit("30/minute")
async def register_device(
    request: Request,
    req: DeviceCreate = Body(...),
    db: Session = Depends(get_db),
    security: dict = Depends(verify_premium_security),
):
    if req.device_type not in _VALID_DEVICE_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"device_type must be one of: {', '.join(sorted(_VALID_DEVICE_TYPES))}",
        )
    if req.status not in _VALID_STATUSES:
        raise HTTPException(
            status_code=422,
            detail=f"status must be one of: {', '.join(sorted(_VALID_STATUSES))}",
        )
    existing = db.query(IoTDevice).filter(IoTDevice.device_id == req.device_id).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Device '{req.device_id}' is already registered")

    device = IoTDevice(
        device_id=req.device_id,
        device_name=req.device_name,
        device_type=req.device_type,
        manufacturer=req.manufacturer,
        firmware_version=req.firmware_version,
        job_site=req.job_site,
        status=req.status,
        meta_json=json.dumps(req.meta or {}),
        tenant_id=security.get("tenant_id", "default"),
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return {"result": "registered", **_device_dict(device)}


@router.put("/devices/{device_db_id}", summary="Update IoT device metadata")
@limiter.limit("30/minute")
async def update_device(
    request: Request,
    device_db_id: int,
    req: DeviceUpdate = Body(...),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    device = db.get(IoTDevice, device_db_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    data = req.model_dump(exclude_none=True)
    if "device_type" in data and data["device_type"] not in _VALID_DEVICE_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"device_type must be one of: {', '.join(sorted(_VALID_DEVICE_TYPES))}",
        )
    if "status" in data and data["status"] not in _VALID_STATUSES:
        raise HTTPException(
            status_code=422,
            detail=f"status must be one of: {', '.join(sorted(_VALID_STATUSES))}",
        )
    for key, val in data.items():
        if key == "meta":
            device.meta_json = json.dumps(val)
        else:
            setattr(device, key, val)
    device.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(device)
    return {"status": "updated", **_device_dict(device)}


@router.delete("/devices/{device_db_id}", summary="Decommission an IoT device")
@limiter.limit("20/minute")
async def delete_device(
    request: Request,
    device_db_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    device = db.get(IoTDevice, device_db_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    db.delete(device)
    db.commit()
    return {"status": "deleted", "id": device_db_id}


# ── Telemetry ingestion ───────────────────────────────────────────────────────

@router.post("/ingest", summary="Ingest IoT telemetry data points")
@limiter.limit("120/minute")
async def ingest_telemetry(
    request: Request,
    req: IngestRequest = Body(...),
    db: Session = Depends(get_db),
    security: dict = Depends(verify_premium_security),
):
    """
    Accept a batch of up to 500 telemetry readings and persist them.
    Also updates each device's ``last_seen_at`` timestamp.
    """
    tenant_id = security.get("tenant_id", "default")
    now = datetime.now(timezone.utc)
    device_ids_seen: set[str] = set()

    rows = []
    for point in req.readings:
        rows.append(IoTDataPoint(
            device_id=point.device_id,
            metric=point.metric,
            value_numeric=point.value_numeric,
            value_text=point.value_text,
            unit=point.unit,
            recorded_at=_parse_dt(point.recorded_at),
            tenant_id=tenant_id,
        ))
        device_ids_seen.add(point.device_id)

    db.add_all(rows)

    # Bulk-update last_seen_at for devices that reported in
    if device_ids_seen:
        db.query(IoTDevice).filter(
            IoTDevice.device_id.in_(device_ids_seen)
        ).update({"last_seen_at": now, "updated_at": now}, synchronize_session="fetch")

    db.commit()
    return {"status": "ingested", "count": len(rows), "devices_updated": list(device_ids_seen)}


# ── Stream (latest readings) ──────────────────────────────────────────────────

@router.get("/stream/{device_id}", summary="Latest telemetry readings for a device")
@limiter.limit("120/minute")
async def device_stream(
    request: Request,
    device_id: str,
    limit: int = Query(default=20, ge=1, le=200),
    metric: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    q = db.query(IoTDataPoint).filter(IoTDataPoint.device_id == device_id)
    if metric:
        q = q.filter(IoTDataPoint.metric == metric)
    readings = q.order_by(IoTDataPoint.recorded_at.desc()).limit(limit).all()
    return {
        "device_id": device_id,
        "count": len(readings),
        "readings": [_reading_dict(r) for r in readings],
    }


# ── Fleet health summary ──────────────────────────────────────────────────────

@router.get("/health", summary="Aggregated IoT fleet health summary")
@limiter.limit("30/minute")
async def fleet_health(
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """Return per-type and per-status device counts plus recent activity."""
    total = db.query(IoTDevice).count()

    by_status: dict[str, int] = {}
    for status_val, count in db.query(IoTDevice.status, func.count(IoTDevice.id)).group_by(IoTDevice.status).all():
        by_status[status_val] = count

    by_type: dict[str, int] = {}
    for type_val, count in db.query(IoTDevice.device_type, func.count(IoTDevice.id)).group_by(IoTDevice.device_type).all():
        by_type[type_val] = count

    # Last 24 h reading count
    from datetime import timedelta
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    readings_24h = db.query(IoTDataPoint).filter(IoTDataPoint.recorded_at >= since).count()

    return {
        "total_devices": total,
        "by_status": by_status,
        "by_type": by_type,
        "readings_last_24h": readings_24h,
        "active_count": by_status.get("active", 0),
        "inactive_count": by_status.get("inactive", 0),
        "maintenance_count": by_status.get("maintenance", 0),
    }
