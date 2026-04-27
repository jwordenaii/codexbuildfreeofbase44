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
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.limiter import limiter
from ..core.security import verify_premium_security
from ..database import get_db
from ..models import SafetyIncident, SafetyToolboxTalk

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
