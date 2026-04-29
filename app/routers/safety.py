"""
safety.py — Safety Culture Dashboard router for JWordenAI.

Routes:
  GET    /api/v1/safety/toolbox                — list toolbox talks
  POST   /api/v1/safety/toolbox                — create toolbox talk
  DELETE /api/v1/safety/toolbox/{id}           — delete toolbox talk
  GET    /api/v1/safety/incidents              — list incidents
  POST   /api/v1/safety/incidents              — create incident
  DELETE /api/v1/safety/incidents/{id}         — delete incident
  GET    /api/v1/safety/osha-rate              — calculate OSHA recordable rate
  GET    /api/v1/safety/scores                 — per-site safety scores

  Real-time AI monitoring (JWORDENAI):
  POST   /api/v1/safety/monitor                — submit site observation for AI analysis
  GET    /api/v1/safety/monitor/alerts         — list AI-generated safety alerts
  PUT    /api/v1/safety/monitor/alerts/{id}    — update alert status (acknowledge / resolve)
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ValidationError
from sqlalchemy.orm import Session

from ..core.limiter import limiter
from ..core.security import verify_premium_security
from ..database import get_db
from ..models import SafetyIncident, SafetyMonitorAlert, SafetyToolboxTalk

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/safety", tags=["safety"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class ToolboxCreate(BaseModel):
    job_site: str
    talk_date: str          # ISO datetime string
    topic: str
    foreman: Optional[str] = None
    crew_count: int = 0
    signed_off: int = 0
    notes: Optional[str] = None


class IncidentCreate(BaseModel):
    job_site: str
    incident_date: str      # ISO datetime string
    incident_type: str      # near-miss | first-aid | recordable
    root_cause: Optional[str] = None
    description: Optional[str] = None
    corrective_action: Optional[str] = None
    osha_recordable: int = 0
    days_away: int = 0


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_dt(s: str) -> datetime:
    dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def _talk_dict(t: SafetyToolboxTalk) -> dict:
    return {
        "id": t.id,
        "job_site": t.job_site,
        "talk_date": t.talk_date.isoformat(),
        "topic": t.topic,
        "foreman": t.foreman,
        "crew_count": t.crew_count,
        "signed_off": bool(t.signed_off),
        "notes": t.notes,
        "created_at": t.created_at.isoformat(),
    }


def _incident_dict(i: SafetyIncident) -> dict:
    return {
        "id": i.id,
        "job_site": i.job_site,
        "incident_date": i.incident_date.isoformat(),
        "incident_type": i.incident_type,
        "root_cause": i.root_cause,
        "description": i.description,
        "corrective_action": i.corrective_action,
        "osha_recordable": bool(i.osha_recordable),
        "days_away": i.days_away,
        "created_at": i.created_at.isoformat(),
    }


# ── Toolbox talk endpoints ────────────────────────────────────────────────────

@router.get("/toolbox", summary="List toolbox talks")
@limiter.limit("60/minute")
async def list_toolbox_talks(
    request: Request,
    job_site: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    q = db.query(SafetyToolboxTalk)
    if job_site:
        q = q.filter(SafetyToolboxTalk.job_site.ilike(f"%{job_site}%"))
    total = q.count()
    rows = q.order_by(SafetyToolboxTalk.talk_date.desc()).offset(offset).limit(limit).all()
    return {"total": total, "talks": [_talk_dict(t) for t in rows]}


@router.post("/toolbox", summary="Create a toolbox talk record")
@limiter.limit("30/minute")
async def create_toolbox_talk(
    request: Request,
    req: ToolboxCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    talk = SafetyToolboxTalk(
        job_site=req.job_site,
        talk_date=_parse_dt(req.talk_date),
        topic=req.topic,
        foreman=req.foreman,
        crew_count=req.crew_count,
        signed_off=req.signed_off,
        notes=req.notes,
    )
    db.add(talk)
    db.commit()
    db.refresh(talk)
    return {"status": "created", **_talk_dict(talk)}


@router.delete("/toolbox/{talk_id}", summary="Delete a toolbox talk")
@limiter.limit("30/minute")
async def delete_toolbox_talk(
    request: Request,
    talk_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    talk = db.get(SafetyToolboxTalk, talk_id)
    if not talk:
        raise HTTPException(status_code=404, detail="Talk not found")
    db.delete(talk)
    db.commit()
    return {"status": "deleted", "id": talk_id}


# ── Incident endpoints ────────────────────────────────────────────────────────

@router.get("/incidents", summary="List safety incidents")
@limiter.limit("60/minute")
async def list_incidents(
    request: Request,
    job_site: Optional[str] = Query(default=None),
    incident_type: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    q = db.query(SafetyIncident)
    if job_site:
        q = q.filter(SafetyIncident.job_site.ilike(f"%{job_site}%"))
    if incident_type:
        q = q.filter(SafetyIncident.incident_type == incident_type)
    total = q.count()
    rows = q.order_by(SafetyIncident.incident_date.desc()).offset(offset).limit(limit).all()
    return {"total": total, "incidents": [_incident_dict(i) for i in rows]}


@router.post("/incidents", summary="Log a safety incident")
@limiter.limit("30/minute")
async def create_incident(
    request: Request,
    req: IncidentCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    incident = SafetyIncident(
        job_site=req.job_site,
        incident_date=_parse_dt(req.incident_date),
        incident_type=req.incident_type,
        root_cause=req.root_cause,
        description=req.description,
        corrective_action=req.corrective_action,
        osha_recordable=req.osha_recordable,
        days_away=req.days_away,
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return {"status": "created", **_incident_dict(incident)}


@router.delete("/incidents/{incident_id}", summary="Delete an incident")
@limiter.limit("30/minute")
async def delete_incident(
    request: Request,
    incident_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    incident = db.get(SafetyIncident, incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    db.delete(incident)
    db.commit()
    return {"status": "deleted", "id": incident_id}


# ── OSHA rate + per-site scores ───────────────────────────────────────────────

@router.get("/osha-rate", summary="Calculate OSHA recordable incident rate per 100 workers")
@limiter.limit("30/minute")
async def osha_rate(
    request: Request,
    total_hours_worked: float = Query(default=200000.0, ge=1),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """
    OSHA TRIR formula: (Number of Recordable Incidents × 200,000) / Total Hours Worked
    200,000 = 100 employees × 50 weeks × 40 hours
    """
    recordable_count = db.query(SafetyIncident).filter(SafetyIncident.osha_recordable == 1).count()
    trir = (recordable_count * 200_000) / total_hours_worked if total_hours_worked > 0 else 0.0
    return {
        "recordable_incidents": recordable_count,
        "total_hours_worked": total_hours_worked,
        "trir": round(trir, 2),
        "benchmark_industry_avg": 3.4,  # BLS construction average
        "status": "below_benchmark" if trir <= 3.4 else "above_benchmark",
    }


@router.get("/scores", summary="Per-site safety scores")
@limiter.limit("30/minute")
async def site_scores(
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """Aggregate safety score per job site (talks count, incidents count, recordables)."""
    talks = db.query(SafetyToolboxTalk).all()
    incidents = db.query(SafetyIncident).all()

    sites: dict[str, dict] = {}

    for t in talks:
        sites.setdefault(t.job_site, {"job_site": t.job_site, "talks": 0, "incidents": 0, "recordables": 0})
        sites[t.job_site]["talks"] += 1

    for i in incidents:
        sites.setdefault(i.job_site, {"job_site": i.job_site, "talks": 0, "incidents": 0, "recordables": 0})
        sites[i.job_site]["incidents"] += 1
        if i.osha_recordable:
            sites[i.job_site]["recordables"] += 1

    # Simple score: 100 - (10 * recordables) - (3 * incidents) + min(talks, 10)
    for s in sites.values():
        score = 100 - (10 * s["recordables"]) - (3 * s["incidents"]) + min(s["talks"], 10)
        s["score"] = max(0, min(100, score))

    return {"sites": sorted(sites.values(), key=lambda x: x["score"], reverse=True)}


# ── Real-time AI safety monitoring (JWORDENAI) ────────────────────────────────

_VALID_ALERT_TYPES = {"ppe_violation", "hazard", "crowd", "equipment", "environmental", "other"}
_VALID_SEVERITIES = {"low", "medium", "high", "critical"}
_VALID_ALERT_STATUSES = {"open", "acknowledged", "resolved"}
_VALID_SOURCES = {"camera", "drone", "wearable", "manual"}


class MonitorObservation(BaseModel):
    job_site: str
    source: str                         # camera | drone | wearable | manual
    source_device_id: Optional[str] = None
    raw_observation: str                # free-text or structured description from sensor/operator
    observed_at: Optional[str] = None  # ISO datetime; defaults to now


class AlertUpdate(BaseModel):
    status: str                         # acknowledged | resolved
    notes: Optional[str] = None


def _score_observation(raw: str) -> tuple[str, str, float]:
    """
    Simple keyword-based severity classifier.

    Returns (alert_type, severity, confidence).
    In production this would call a vision model or NLP classifier.
    """
    text = raw.lower()
    if any(k in text for k in ("no helmet", "no ppe", "missing ppe", "no hard hat", "no vest")):
        return "ppe_violation", "high", 0.85
    if any(k in text for k in ("fall", "collapse", "fire", "explosion", "injury")):
        return "hazard", "critical", 0.92
    if any(k in text for k in ("overcrowding", "too many workers", "crowd")):
        return "crowd", "medium", 0.75
    if any(k in text for k in ("equipment failure", "breakdown", "malfunction")):
        return "equipment", "high", 0.80
    if any(k in text for k in ("spill", "runoff", "dust", "pollution")):
        return "environmental", "medium", 0.70
    return "other", "low", 0.55


def _alert_dict(a: SafetyMonitorAlert) -> dict:
    return {
        "id": a.id,
        "job_site": a.job_site,
        "alert_type": a.alert_type,
        "severity": a.severity,
        "description": a.description,
        "source": a.source,
        "source_device_id": a.source_device_id,
        "ai_confidence": a.ai_confidence,
        "status": a.status,
        "resolved_at": a.resolved_at.isoformat() if a.resolved_at else None,
        "created_at": a.created_at.isoformat(),
    }


@router.post("/monitor", summary="Submit a site observation for AI safety analysis")
@limiter.limit("60/minute")
async def submit_observation(
    request: Request,
    db: Session = Depends(get_db),
    security: dict = Depends(verify_premium_security),
):
    """
    Accept a real-time site observation from any data source (camera feed,
    drone telemetry, wearable alert, or manual entry) and classify it using
    the JWORDENAI safety AI engine.  If the observation warrants an alert a
    ``SafetyMonitorAlert`` record is created and returned.
    """
    try:
        body = await request.json()
        req = MonitorObservation.model_validate(body)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc

    if req.source not in _VALID_SOURCES:
        raise HTTPException(
            status_code=422,
            detail=f"source must be one of: {', '.join(sorted(_VALID_SOURCES))}",
        )

    alert_type, severity, confidence = _score_observation(req.raw_observation)
    tenant_id = security.get("tenant_id", "default")

    alert = SafetyMonitorAlert(
        job_site=req.job_site,
        alert_type=alert_type,
        severity=severity,
        description=req.raw_observation[:2000],
        source=req.source,
        source_device_id=req.source_device_id,
        ai_confidence=confidence,
        status="open",
        tenant_id=tenant_id,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    return {
        "status": "alert_created",
        "alert": _alert_dict(alert),
    }


@router.get("/monitor/alerts", summary="List AI-generated safety monitor alerts")
@limiter.limit("60/minute")
async def list_monitor_alerts(
    request: Request,
    job_site: Optional[str] = Query(default=None),
    severity: Optional[str] = Query(default=None),
    alert_status: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    q = db.query(SafetyMonitorAlert)
    if job_site:
        q = q.filter(SafetyMonitorAlert.job_site.ilike(f"%{job_site}%"))
    if severity:
        q = q.filter(SafetyMonitorAlert.severity == severity)
    if alert_status:
        q = q.filter(SafetyMonitorAlert.status == alert_status)
    total = q.count()
    rows = q.order_by(SafetyMonitorAlert.created_at.desc()).offset(offset).limit(limit).all()
    return {"total": total, "alerts": [_alert_dict(a) for a in rows]}


@router.put("/monitor/alerts/{alert_id}", summary="Acknowledge or resolve a safety alert")
@limiter.limit("30/minute")
async def update_alert_status(
    request: Request,
    alert_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    try:
        body = await request.json()
        req = AlertUpdate.model_validate(body)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc

    if req.status not in {"acknowledged", "resolved"}:
        raise HTTPException(
            status_code=422,
            detail="status must be 'acknowledged' or 'resolved'",
        )
    alert = db.get(SafetyMonitorAlert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.status = req.status
    if req.status == "resolved":
        alert.resolved_at = datetime.now(timezone.utc)
    if req.notes:
        alert.description = (alert.description or "") + f"\n\n[Note] {req.notes}"
    db.commit()
    db.refresh(alert)
    return {"status": "updated", "alert": _alert_dict(alert)}
