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
  GET    /api/v1/safety/ai-monitor             — real-time AI safety monitoring snapshot
  POST   /api/v1/safety/ai-monitor/alert       — submit a real-time sensor alert for AI triage
  POST   /api/v1/safety/monitor                — create AI-classified field observation alert
  GET    /api/v1/safety/monitor/alerts         — list safety monitor alerts
  PUT    /api/v1/safety/monitor/alerts/{id}    — acknowledge or resolve a safety alert
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.limiter import limiter
from ..core.security import verify_premium_security
from ..database import get_db
from ..models import SafetyAlert, SafetyIncident, SafetyToolboxTalk

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
    from fastapi import HTTPException  # noqa: PLC0415
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
    from fastapi import HTTPException  # noqa: PLC0415
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


# ── Real-time AI safety monitoring ────────────────────────────────────────────

# Risk thresholds for the AI monitor (configurable via env in a production system)
_INCIDENT_RATE_WARN = 0.5   # incidents per 1000 crew-hours (warning)
_INCIDENT_RATE_HIGH = 1.0   # incidents per 1000 crew-hours (high risk)


class AIAlertCreate(BaseModel):
    job_site: str
    sensor_type: str               # e.g. "wearable_heart_rate", "gas_detector", "proximity"
    reading_value: float
    unit: Optional[str] = None
    device_id: Optional[str] = None
    context: Optional[str] = None  # free-text from the device or operator


@router.get("/ai-monitor", summary="Real-time AI safety monitoring snapshot")
@limiter.limit("30/minute")
async def ai_safety_monitor(
    request: Request,
    job_site: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """
    Returns an AI-generated safety risk snapshot for one or all job sites.

    The risk level is derived from recent incident rates and toolbox talk
    compliance, providing an introductory real-time monitoring signal that
    can be extended with live IoT sensor feeds.
    """
    now = datetime.now(timezone.utc)

    iq = db.query(SafetyIncident)
    tq = db.query(SafetyToolboxTalk)
    if job_site:
        iq = iq.filter(SafetyIncident.job_site.ilike(f"%{job_site}%"))
        tq = tq.filter(SafetyToolboxTalk.job_site.ilike(f"%{job_site}%"))

    incidents = iq.all()
    talks = tq.all()

    # Aggregate per site
    sites: dict[str, dict] = {}
    for i in incidents:
        s = sites.setdefault(i.job_site, {
            "job_site": i.job_site, "incidents": 0, "recordables": 0,
            "talks": 0, "signed_off_talks": 0,
        })
        s["incidents"] += 1
        if i.osha_recordable:
            s["recordables"] += 1

    for t in talks:
        s = sites.setdefault(t.job_site, {
            "job_site": t.job_site, "incidents": 0, "recordables": 0,
            "talks": 0, "signed_off_talks": 0,
        })
        s["talks"] += 1
        if t.signed_off:
            s["signed_off_talks"] += 1

    # Compute AI risk signal per site
    results = []
    for s in sites.values():
        total_incidents = s["incidents"]
        talk_compliance = (
            s["signed_off_talks"] / s["talks"] if s["talks"] > 0 else 0.0
        )
        # Approximate incident rate per 1000 crew-hours (assume 200 h / incident data point)
        approx_rate = total_incidents / max(s["talks"] * 200, 200) * 1000

        if s["recordables"] > 0 or approx_rate >= _INCIDENT_RATE_HIGH:
            risk_level = "high"
            recommendation = (
                "Immediate review required: recordable incidents detected. "
                "Consider site standdown and safety audit."
            )
        elif approx_rate >= _INCIDENT_RATE_WARN or talk_compliance < 0.5:
            risk_level = "medium"
            recommendation = (
                "Elevated risk signal: ensure all crew members complete toolbox talks "
                "and review recent near-miss reports."
            )
        else:
            risk_level = "low"
            recommendation = (
                "Safety profile looks healthy. Maintain current toolbox talk cadence."
            )

        results.append({
            "job_site": s["job_site"],
            "risk_level": risk_level,
            "total_incidents": total_incidents,
            "recordable_incidents": s["recordables"],
            "toolbox_talks": s["talks"],
            "talk_compliance_pct": round(talk_compliance * 100, 1),
            "ai_recommendation": recommendation,
            "snapshot_at": now.isoformat(),
        })

    results.sort(key=lambda x: {"high": 0, "medium": 1, "low": 2}.get(x["risk_level"], 3))
    return {
        "total_sites": len(results),
        "generated_at": now.isoformat(),
        "monitor": results,
    }


@router.post("/ai-monitor/alert", summary="Submit a real-time sensor alert for AI triage")
@limiter.limit("60/minute")
async def ai_monitor_alert(
    request: Request,
    req: AIAlertCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """
    Accept a real-time sensor reading and return an AI-triaged risk assessment
    and recommended action.  Automatically creates a safety incident record when
    the reading exceeds critical thresholds.
    """
    now = datetime.now(timezone.utc)

    # Simple threshold rules per sensor type
    thresholds: dict[str, dict] = {
        "gas_detector":          {"warn": 10.0,  "critical": 25.0,  "unit": "ppm"},
        "wearable_heart_rate":   {"warn": 120.0, "critical": 160.0, "unit": "bpm"},
        "proximity":             {"warn": 5.0,   "critical": 2.0,   "unit": "m"},
        "noise_level":           {"warn": 85.0,  "critical": 100.0, "unit": "dB"},
        "temperature_f":         {"warn": 95.0,  "critical": 105.0, "unit": "°F"},
    }

    rule = thresholds.get(req.sensor_type, {"warn": None, "critical": None, "unit": req.unit})
    warn_thresh = rule["warn"]
    crit_thresh = rule["critical"]

    # For proximity sensors, lower is more dangerous
    is_proximity = req.sensor_type == "proximity"

    if warn_thresh is not None:
        if is_proximity:
            is_critical = req.reading_value <= crit_thresh
            is_warning = req.reading_value <= warn_thresh and not is_critical
        else:
            is_critical = req.reading_value >= crit_thresh
            is_warning = req.reading_value >= warn_thresh and not is_critical
    else:
        is_critical = False
        is_warning = False

    if is_critical:
        severity = "critical"
        action = (
            f"CRITICAL: {req.sensor_type} reading of {req.reading_value} {req.unit or rule['unit']} "
            f"exceeds safety threshold. Evacuate the affected zone immediately and notify supervisor."
        )
        # Auto-create a safety incident record
        incident = SafetyIncident(
            job_site=req.job_site,
            incident_date=now,
            incident_type="near-miss",
            root_cause=f"AI-triaged sensor alert: {req.sensor_type}",
            description=(
                f"Automated alert from device {req.device_id or 'unknown'}. "
                f"Reading: {req.reading_value} {req.unit or ''}. Context: {req.context or 'N/A'}"
            ),
            corrective_action=action,
            osha_recordable=0,
            days_away=0,
        )
        db.add(incident)
        db.commit()
        db.refresh(incident)
        incident_id = incident.id
    elif is_warning:
        severity = "warning"
        action = (
            f"WARNING: {req.sensor_type} reading of {req.reading_value} {req.unit or rule['unit']} "
            f"is approaching unsafe levels. Monitor closely and prepare to evacuate if it rises further."
        )
        incident_id = None
    else:
        severity = "normal"
        action = f"Reading of {req.reading_value} {req.unit or rule['unit']} is within safe parameters."
        incident_id = None

    return {
        "job_site": req.job_site,
        "sensor_type": req.sensor_type,
        "device_id": req.device_id,
        "reading_value": req.reading_value,
        "severity": severity,
        "ai_action": action,
        "incident_id": incident_id,
        "triaged_at": now.isoformat(),
    }


# ── Safety Monitor CRUD ───────────────────────────────────────────────────────

_VALID_MONITOR_SOURCES = {"camera", "drone", "sensor", "wearable", "manual"}


def _classify_observation(text: str) -> tuple[str, str, float]:
    """Return (alert_type, severity, ai_confidence) from raw observation text."""
    t = text.lower()
    # PPE violations
    ppe_terms = {"helmet", "hard hat", "hardhat", "ppe", "vest", "glove", "goggle", "harness", "boot"}
    if any(term in t for term in ppe_terms):
        return "ppe_violation", "high", 0.91
    # Structural/fall/collapse hazards
    hazard_terms = {"fall", "collapse", "unstable", "edge", "trench", "cave", "sink", "break", "crack", "structural"}
    if any(term in t for term in hazard_terms):
        return "hazard", "critical", 0.88
    # Equipment failures
    equip_terms = {"equipment", "failure", "malfunction", "broken", "leak", "fire", "smoke", "paver", "roller", "compactor"}
    if any(term in t for term in equip_terms):
        return "equipment_failure", "high", 0.85
    # Near-miss general
    nearmiss_terms = {"near miss", "near-miss", "close call", "almost", "narrowly"}
    if any(term in t for term in nearmiss_terms):
        return "near_miss", "medium", 0.80
    return "general", "low", 0.70


def _alert_dict(a: SafetyAlert) -> dict:
    return {
        "id": a.id,
        "job_site": a.job_site,
        "source": a.source,
        "source_device_id": a.source_device_id,
        "raw_observation": a.raw_observation,
        "alert_type": a.alert_type,
        "severity": a.severity,
        "status": a.status,
        "ai_confidence": a.ai_confidence,
        "notes": a.notes,
        "resolved_at": a.resolved_at.isoformat() if a.resolved_at else None,
        "created_at": a.created_at.isoformat(),
        "updated_at": a.updated_at.isoformat(),
    }


class MonitorCreate(BaseModel):
    job_site: str
    source: str
    source_device_id: Optional[str] = None
    raw_observation: str


class AlertUpdate(BaseModel):
    status: str  # acknowledged | resolved
    notes: Optional[str] = None


@router.post("/monitor", summary="Create AI-classified field observation alert")
@limiter.limit("60/minute")
async def create_monitor_alert(
    request: Request,
    req: MonitorCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """
    Accept a raw field observation and classify it using keyword-based AI rules.
    Persists the alert and returns classification details.
    """
    if req.source not in _VALID_MONITOR_SOURCES:
        raise HTTPException(
            status_code=422,
            detail=f"source must be one of: {sorted(_VALID_MONITOR_SOURCES)}",
        )

    alert_type, severity, confidence = _classify_observation(req.raw_observation)

    alert = SafetyAlert(
        job_site=req.job_site,
        source=req.source,
        source_device_id=req.source_device_id,
        raw_observation=req.raw_observation,
        alert_type=alert_type,
        severity=severity,
        status="open",
        ai_confidence=confidence,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return {"status": "alert_created", "alert": _alert_dict(alert)}


@router.get("/monitor/alerts", summary="List safety monitor alerts")
@limiter.limit("60/minute")
async def list_monitor_alerts(
    request: Request,
    status: Optional[str] = Query(default=None),
    severity: Optional[str] = Query(default=None),
    job_site: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    q = db.query(SafetyAlert).order_by(SafetyAlert.created_at.desc())
    if status:
        q = q.filter(SafetyAlert.status == status)
    if severity:
        q = q.filter(SafetyAlert.severity == severity)
    if job_site:
        q = q.filter(SafetyAlert.job_site.ilike(f"%{job_site}%"))
    total = q.count()
    alerts = q.limit(limit).all()
    return {"total": total, "alerts": [_alert_dict(a) for a in alerts]}


@router.put("/monitor/alerts/{alert_id}", summary="Acknowledge or resolve a safety alert")
@limiter.limit("60/minute")
async def update_monitor_alert(
    request: Request,
    alert_id: int,
    req: AlertUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    valid_statuses = {"acknowledged", "resolved"}
    if req.status not in valid_statuses:
        raise HTTPException(status_code=422, detail=f"status must be one of: {sorted(valid_statuses)}")

    alert = db.query(SafetyAlert).filter(SafetyAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.status = req.status
    if req.notes:
        alert.notes = req.notes
    if req.status == "resolved":
        alert.resolved_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(alert)
    return {"alert": _alert_dict(alert)}
