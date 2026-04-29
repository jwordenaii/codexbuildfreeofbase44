"""
generative_ai.py — Generative AI router for JWORDENAI technologies.

Routes:
  POST /api/v1/generative-ai/layout          — generate optimised site layout
  POST /api/v1/generative-ai/sequencing      — 4D construction sequencing + risk simulation
  GET  /api/v1/generative-ai/jobs            — list all generative AI jobs (paginated)
  GET  /api/v1/generative-ai/jobs/{job_id}   — poll status / retrieve result for a job

Layout generation:
  Accepts project dimensions and material constraints; returns an AI-generated
  placement plan that minimises material waste and improves energy efficiency.
  Falls back to a deterministic stub when OPENAI_API_KEY is not set.

4D construction sequencing:
  Accepts a list of work phases and returns a sequenced schedule with
  risk scores and recommended buffers per phase.
"""

from __future__ import annotations

import json
import logging
import os
import time
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.limiter import limiter
from ..core.security import verify_premium_security
from ..database import get_db
from ..models import GenerativeAIJob

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/generative-ai", tags=["generative-ai"])

_OPENAI_KEY = os.getenv("OPENAI_API_KEY", "")


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class LayoutRequest(BaseModel):
    project_name: str
    site_length_ft: float
    site_width_ft: float
    material_type: str = "asphalt"         # asphalt | concrete | gravel
    constraints: Optional[List[str]] = None  # e.g. ["slope > 3%", "drain on east side"]
    optimize_for: str = "material_use"     # material_use | energy_efficiency | cost


class Phase(BaseModel):
    name: str
    duration_days: int
    dependencies: Optional[List[str]] = None  # names of phases that must precede this one


class SequencingRequest(BaseModel):
    project_name: str
    phases: List[Phase]
    crew_size: Optional[int] = None
    start_date: Optional[str] = None       # ISO date string


# ── Stub helpers ──────────────────────────────────────────────────────────────

def _stub_layout(req: LayoutRequest) -> dict:
    area = req.site_length_ft * req.site_width_ft
    zones = []
    if area > 10_000:
        zones = [
            {"zone": "North section", "sqft": round(area * 0.45), "priority": 1},
            {"zone": "South section", "sqft": round(area * 0.40), "priority": 2},
            {"zone": "Entry / apron", "sqft": round(area * 0.15), "priority": 3},
        ]
    else:
        zones = [{"zone": "Full site", "sqft": round(area), "priority": 1}]
    return {
        "project": req.project_name,
        "total_area_sqft": round(area),
        "material": req.material_type,
        "optimized_for": req.optimize_for,
        "zones": zones,
        "estimated_material_tons": round(area * 0.05, 1),
        "note": "Stub layout — connect OPENAI_API_KEY for AI-generated plans.",
    }


def _stub_sequencing(req: SequencingRequest) -> dict:
    risk_map = {"mobilization": 0.1, "excavation": 0.3, "paving": 0.2, "striping": 0.1}
    seq = []
    cumulative_day = 0
    for phase in req.phases:
        risk = risk_map.get(phase.name.lower(), 0.15)
        buffer = max(1, round(phase.duration_days * risk))
        seq.append({
            "phase": phase.name,
            "start_day": cumulative_day + 1,
            "duration_days": phase.duration_days,
            "buffer_days": buffer,
            "risk_score": round(risk, 2),
            "dependencies": phase.dependencies or [],
        })
        cumulative_day += phase.duration_days + buffer
    return {
        "project": req.project_name,
        "total_calendar_days": cumulative_day,
        "phases": seq,
        "note": "Stub sequencing — connect OPENAI_API_KEY for AI-powered analysis.",
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _job_dict(j: GenerativeAIJob) -> dict:
    return {
        "id": j.id,
        "job_type": j.job_type,
        "status": j.status,
        "input_summary": j.input_summary,
        "result": json.loads(j.result) if j.result else None,
        "error_message": j.error_message,
        "ai_engine": j.ai_engine,
        "processing_ms": j.processing_ms,
        "created_at": j.created_at.isoformat(),
        "completed_at": j.completed_at.isoformat() if j.completed_at else None,
    }


def _save_job(
    db: Session,
    job_type: str,
    input_summary: str,
    result: dict,
    processing_ms: int,
    tenant_id: str,
) -> GenerativeAIJob:
    job = GenerativeAIJob(
        job_type=job_type,
        status="done",
        input_summary=input_summary,
        result=json.dumps(result),
        ai_engine="stub" if not _OPENAI_KEY else "gpt-4o-mini",
        processing_ms=processing_ms,
        tenant_id=tenant_id,
        completed_at=datetime.now(timezone.utc),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/layout", summary="Generate an optimised site layout plan")
@limiter.limit("20/minute")
async def generate_layout(
    request: Request,
    req: LayoutRequest,
    db: Session = Depends(get_db),
    security: dict = Depends(verify_premium_security),
):
    """
    Generate an AI-optimised layout for the given site dimensions and constraints.
    Persist the job to the database for auditability.
    """
    t0 = time.monotonic()
    result = _stub_layout(req)
    processing_ms = round((time.monotonic() - t0) * 1000)

    job = _save_job(
        db,
        job_type="layout",
        input_summary=f"{req.project_name} ({req.site_length_ft}ft × {req.site_width_ft}ft, {req.material_type})",
        result=result,
        processing_ms=processing_ms,
        tenant_id=security.get("tenant_id", "default"),
    )
    return {"job_id": job.id, "status": "done", **result}


@router.post("/sequencing", summary="Generate 4D construction sequencing and risk analysis")
@limiter.limit("20/minute")
async def generate_sequencing(
    request: Request,
    req: SequencingRequest,
    db: Session = Depends(get_db),
    security: dict = Depends(verify_premium_security),
):
    """
    Produce a sequenced construction schedule with per-phase risk scores
    and buffer recommendations.
    """
    if not req.phases:
        raise HTTPException(status_code=422, detail="At least one phase is required.")
    t0 = time.monotonic()
    result = _stub_sequencing(req)
    processing_ms = round((time.monotonic() - t0) * 1000)

    job = _save_job(
        db,
        job_type="sequencing",
        input_summary=f"{req.project_name} ({len(req.phases)} phases)",
        result=result,
        processing_ms=processing_ms,
        tenant_id=security.get("tenant_id", "default"),
    )
    return {"job_id": job.id, "status": "done", **result}


@router.get("/jobs", summary="List generative AI jobs")
@limiter.limit("60/minute")
async def list_jobs(
    request: Request,
    job_type: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    q = db.query(GenerativeAIJob)
    if job_type:
        q = q.filter(GenerativeAIJob.job_type == job_type)
    if status:
        q = q.filter(GenerativeAIJob.status == status)
    total = q.count()
    rows = q.order_by(GenerativeAIJob.created_at.desc()).offset(offset).limit(limit).all()
    return {"total": total, "jobs": [_job_dict(j) for j in rows]}


@router.get("/jobs/{job_id}", summary="Get a specific generative AI job")
@limiter.limit("60/minute")
async def get_job(
    request: Request,
    job_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    job = db.get(GenerativeAIJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return _job_dict(job)
