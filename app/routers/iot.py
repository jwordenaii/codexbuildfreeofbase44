"""
iot.py — IoT Integration router for JWORDENAI technologies.

Routes:
  GET    /api/v1/iot/devices                  — list registered IoT devices
  POST   /api/v1/iot/devices                  — register a new IoT device
  PUT    /api/v1/iot/devices/{device_id}      — update device record (status, label, firmware)
  DELETE /api/v1/iot/devices/{device_id}      — deregister a device
  POST   /api/v1/iot/readings                 — ingest a telemetry reading
  GET    /api/v1/iot/readings                 — query readings (filter by device / metric / site)
  GET    /api/v1/iot/readings/latest          — latest reading per device (dashboard summary)

Supported device types: drone | wearable | mixer | sensor
Typical metrics: temperature | vibration | gps | heart_rate | mix_ratio | humidity
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.limiter import limiter
from ..core.security import verify_premium_security
from ..database import get_db
from ..models import IoTDevice, IoTReading

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/iot", tags=["iot"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class DeviceCreate(BaseModel):
    device_id: str
    device_type: str          # drone | wearable | mixer | sensor
    label: Optional[str] = None
    job_site: Optional[str] = None
    firmware_version: Optional[str] = None


class DeviceUpdate(BaseModel):
    label: Optional[str] = None
    job_site: Optional[str] = None
    status: Optional[str] = None          # active | offline | maintenance
    firmware_version: Optional[str] = None


class ReadingCreate(BaseModel):
    device_id: str
    metric: str                           # temperature | vibration | gps | heart_rate …
    value: Optional[float] = None
    unit: Optional[str] = None
    payload: Optional[dict] = None        # multi-field readings (e.g. gps lat/lng)
    job_site: Optional[str] = None
    recorded_at: Optional[str] = None    # ISO datetime; defaults to server UTC now


# ── Helpers ───────────────────────────────────────────────────────────────────

def _device_dict(d: IoTDevice) -> dict:
    return {
        "id": d.id,
        "device_id": d.device_id,
        "device_type": d.device_type,
        "label": d.label,
        "job_site": d.job_site,
        "status": d.status,
        "firmware_version": d.firmware_version,
        "last_seen_at": d.last_seen_at.isoformat() if d.last_seen_at else None,
        "created_at": d.created_at.isoformat(),
        "updated_at": d.updated_at.isoformat(),
    }


def _reading_dict(r: IoTReading) -> dict:
    payload = json.loads(r.payload) if r.payload else None
    return {
        "id": r.id,
        "device_id": r.device_id,
        "metric": r.metric,
        "value": r.value,
        "unit": r.unit,
        "payload": payload,
        "job_site": r.job_site,
        "recorded_at": r.recorded_at.isoformat(),
    }


def _parse_dt(s: str) -> datetime:
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
    rows = q.order_by(IoTDevice.label.asc()).all()
    return {"total": len(rows), "devices": [_device_dict(d) for d in rows]}


@router.post("/devices", summary="Register a new IoT device")
@limiter.limit("30/minute")
async def register_device(
    request: Request,
    req: DeviceCreate,
    db: Session = Depends(get_db),
    security: dict = Depends(verify_premium_security),
):
    existing = db.query(IoTDevice).filter(IoTDevice.device_id == req.device_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="device_id already registered")
    device = IoTDevice(
        device_id=req.device_id,
        device_type=req.device_type,
        label=req.label,
        job_site=req.job_site,
        firmware_version=req.firmware_version,
        tenant_id=security.get("tenant_id", "default"),
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return {"status": "registered", **_device_dict(device)}


@router.put("/devices/{device_id}", summary="Update an IoT device")
@limiter.limit("30/minute")
async def update_device(
    request: Request,
    device_id: str,
    req: DeviceUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    device = db.query(IoTDevice).filter(IoTDevice.device_id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    data = req.model_dump(exclude_none=True)
    for key, val in data.items():
        setattr(device, key, val)
    device.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(device)
    return {"status": "updated", **_device_dict(device)}


@router.delete("/devices/{device_id}", summary="Deregister an IoT device")
@limiter.limit("30/minute")
async def deregister_device(
    request: Request,
    device_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    device = db.query(IoTDevice).filter(IoTDevice.device_id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    db.delete(device)
    db.commit()
    return {"status": "deregistered", "device_id": device_id}


# ── Readings ──────────────────────────────────────────────────────────────────

@router.post("/readings", summary="Ingest a telemetry reading from an IoT device")
@limiter.limit("120/minute")
async def ingest_reading(
    request: Request,
    req: ReadingCreate,
    db: Session = Depends(get_db),
    security: dict = Depends(verify_premium_security),
):
    recorded_at = _parse_dt(req.recorded_at) if req.recorded_at else datetime.now(timezone.utc)
    reading = IoTReading(
        device_id=req.device_id,
        metric=req.metric,
        value=req.value,
        unit=req.unit,
        payload=json.dumps(req.payload) if req.payload else None,
        job_site=req.job_site,
        recorded_at=recorded_at,
        tenant_id=security.get("tenant_id", "default"),
    )
    db.add(reading)

    # Update device last_seen_at
    device = db.query(IoTDevice).filter(IoTDevice.device_id == req.device_id).first()
    if device:
        device.last_seen_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(reading)
    return {"status": "ingested", **_reading_dict(reading)}


@router.get("/readings", summary="Query IoT telemetry readings")
@limiter.limit("60/minute")
async def query_readings(
    request: Request,
    device_id: Optional[str] = Query(default=None),
    metric: Optional[str] = Query(default=None),
    job_site: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    q = db.query(IoTReading)
    if device_id:
        q = q.filter(IoTReading.device_id == device_id)
    if metric:
        q = q.filter(IoTReading.metric == metric)
    if job_site:
        q = q.filter(IoTReading.job_site.ilike(f"%{job_site}%"))
    total = q.count()
    rows = q.order_by(IoTReading.recorded_at.desc()).offset(offset).limit(limit).all()
    return {"total": total, "readings": [_reading_dict(r) for r in rows]}


@router.get("/readings/latest", summary="Latest reading per device for dashboard")
@limiter.limit("60/minute")
async def latest_readings(
    request: Request,
    job_site: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """Return the most recent reading per device (across all metrics)."""
    q = db.query(IoTDevice)
    if job_site:
        q = q.filter(IoTDevice.job_site.ilike(f"%{job_site}%"))
    devices = q.all()

    summary = []
    for device in devices:
        latest = (
            db.query(IoTReading)
            .filter(IoTReading.device_id == device.device_id)
            .order_by(IoTReading.recorded_at.desc())
            .first()
        )
        entry = _device_dict(device)
        entry["latest_reading"] = _reading_dict(latest) if latest else None
        summary.append(entry)

    return {"total": len(summary), "devices": summary}
