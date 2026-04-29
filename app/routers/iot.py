"""
iot.py — JWORDENAI IoT Integration router.

Routes:
  GET    /api/v1/iot/devices              — list registered IoT devices
  POST   /api/v1/iot/devices              — register a new IoT device
  PUT    /api/v1/iot/devices/{id}         — update device metadata / status
  DELETE /api/v1/iot/devices/{id}         — deregister a device
  POST   /api/v1/iot/readings             — ingest a telemetry reading (single)
  POST   /api/v1/iot/readings/batch       — ingest multiple readings at once
  GET    /api/v1/iot/readings             — query readings (filter by device/site/metric)
  GET    /api/v1/iot/summary              — per-site/device summary (latest readings + status)
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
    device_type: str                     # drone | wearable | mixer | sensor
    label: Optional[str] = None
    job_site: Optional[str] = None
    status: str = "active"
    firmware_ver: Optional[str] = None
    meta: Optional[dict] = None


class DeviceUpdate(BaseModel):
    label: Optional[str] = None
    job_site: Optional[str] = None
    status: Optional[str] = None
    firmware_ver: Optional[str] = None
    meta: Optional[dict] = None


class ReadingCreate(BaseModel):
    device_id: str
    device_type: Optional[str] = None
    job_site: Optional[str] = None
    metric: str
    value: float
    unit: Optional[str] = None
    recorded_at: Optional[str] = None   # ISO datetime; defaults to now


class ReadingBatch(BaseModel):
    readings: list[ReadingCreate]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _device_dict(d: IoTDevice) -> dict:
    return {
        "id": d.id,
        "device_id": d.device_id,
        "device_type": d.device_type,
        "label": d.label,
        "job_site": d.job_site,
        "status": d.status,
        "firmware_ver": d.firmware_ver,
        "meta": json.loads(d.meta) if d.meta else None,
        "created_at": d.created_at.isoformat(),
        "updated_at": d.updated_at.isoformat(),
    }


def _reading_dict(r: IoTReading) -> dict:
    return {
        "id": r.id,
        "device_id": r.device_id,
        "device_type": r.device_type,
        "job_site": r.job_site,
        "metric": r.metric,
        "value": r.value,
        "unit": r.unit,
        "recorded_at": r.recorded_at.isoformat() if r.recorded_at else None,
    }


def _parse_recorded_at(s: Optional[str]) -> datetime:
    if not s:
        return datetime.now(timezone.utc)
    dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def _ingest_reading(req: ReadingCreate, db: Session) -> IoTReading:
    reading = IoTReading(
        device_id=req.device_id,
        device_type=req.device_type,
        job_site=req.job_site,
        metric=req.metric,
        value=req.value,
        unit=req.unit,
        recorded_at=_parse_recorded_at(req.recorded_at),
    )
    db.add(reading)
    return reading


# ── Device endpoints ──────────────────────────────────────────────────────────

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
    _: dict = Depends(verify_premium_security),
):
    existing = db.query(IoTDevice).filter(IoTDevice.device_id == req.device_id).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Device '{req.device_id}' already registered")
    d = IoTDevice(
        device_id=req.device_id,
        device_type=req.device_type,
        label=req.label,
        job_site=req.job_site,
        status=req.status,
        firmware_ver=req.firmware_ver,
        meta=json.dumps(req.meta) if req.meta else None,
    )
    db.add(d)
    db.commit()
    db.refresh(d)
    logger.info("IoT device registered: %s (%s)", d.device_id, d.device_type)
    return {"status": "registered", **_device_dict(d)}


@router.put("/devices/{id}", summary="Update IoT device metadata or status")
@limiter.limit("30/minute")
async def update_device(
    request: Request,
    id: int,
    req: DeviceUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    d = db.get(IoTDevice, id)
    if not d:
        raise HTTPException(status_code=404, detail="Device not found")
    data = req.model_dump(exclude_none=True)
    for key, val in data.items():
        if key == "meta":
            d.meta = json.dumps(val)
        else:
            setattr(d, key, val)
    d.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(d)
    return {"status": "updated", **_device_dict(d)}


@router.delete("/devices/{id}", summary="Deregister an IoT device")
@limiter.limit("20/minute")
async def delete_device(
    request: Request,
    id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    d = db.get(IoTDevice, id)
    if not d:
        raise HTTPException(status_code=404, detail="Device not found")
    db.delete(d)
    db.commit()
    return {"status": "deleted", "id": id}


# ── Reading endpoints ─────────────────────────────────────────────────────────

@router.post("/readings", summary="Ingest a single IoT telemetry reading")
@limiter.limit("120/minute")
async def ingest_reading(
    request: Request,
    req: ReadingCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    reading = _ingest_reading(req, db)
    db.commit()
    db.refresh(reading)
    return {"status": "ingested", **_reading_dict(reading)}


@router.post("/readings/batch", summary="Ingest multiple IoT telemetry readings")
@limiter.limit("30/minute")
async def ingest_readings_batch(
    request: Request,
    req: ReadingBatch,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    if not req.readings:
        raise HTTPException(status_code=422, detail="readings list must not be empty")
    if len(req.readings) > 500:
        raise HTTPException(status_code=422, detail="Batch size limit is 500 readings")
    for r in req.readings:
        _ingest_reading(r, db)
    db.commit()
    return {"status": "ingested", "count": len(req.readings)}


@router.get("/readings", summary="Query IoT telemetry readings")
@limiter.limit("60/minute")
async def get_readings(
    request: Request,
    device_id: Optional[str] = Query(default=None),
    job_site: Optional[str] = Query(default=None),
    metric: Optional[str] = Query(default=None),
    device_type: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    q = db.query(IoTReading)
    if device_id:
        q = q.filter(IoTReading.device_id == device_id)
    if job_site:
        q = q.filter(IoTReading.job_site.ilike(f"%{job_site}%"))
    if metric:
        q = q.filter(IoTReading.metric == metric)
    if device_type:
        q = q.filter(IoTReading.device_type == device_type)
    total = q.count()
    rows = q.order_by(IoTReading.recorded_at.desc()).offset(offset).limit(limit).all()
    return {"total": total, "readings": [_reading_dict(r) for r in rows]}


@router.get("/summary", summary="Per-site IoT device and latest-reading summary")
@limiter.limit("30/minute")
async def iot_summary(
    request: Request,
    job_site: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """
    Return an aggregated summary: for each job site, list devices and their
    most recent reading per metric.
    """
    dq = db.query(IoTDevice)
    if job_site:
        dq = dq.filter(IoTDevice.job_site.ilike(f"%{job_site}%"))
    devices = dq.all()

    sites: dict[str, dict] = {}
    for d in devices:
        site_key = d.job_site or "unassigned"
        sites.setdefault(site_key, {"job_site": site_key, "devices": []})

        # Latest reading per metric for this device
        readings = (
            db.query(IoTReading)
            .filter(IoTReading.device_id == d.device_id)
            .order_by(IoTReading.recorded_at.desc())
            .limit(20)
            .all()
        )
        seen_metrics: set[str] = set()
        latest: list[dict] = []
        for r in readings:
            if r.metric not in seen_metrics:
                seen_metrics.add(r.metric)
                latest.append(_reading_dict(r))

        sites[site_key]["devices"].append({
            **_device_dict(d),
            "latest_readings": latest,
        })

    return {"sites": list(sites.values())}
