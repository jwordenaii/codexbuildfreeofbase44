"""
generative_ai.py — JWORDENAI Generative AI router.

Routes:
  POST   /api/v1/generative-ai/jobs              — submit a generative AI job
  GET    /api/v1/generative-ai/jobs              — list generative AI jobs
  GET    /api/v1/generative-ai/jobs/{id}         — get job status / result
  DELETE /api/v1/generative-ai/jobs/{id}         — remove a job record
  POST   /api/v1/generative-ai/layout            — quick layout generation (synchronous stub)
  POST   /api/v1/generative-ai/sequencing        — quick 4D sequencing (synchronous stub)
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
from ..models import GenerativeAIJob

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/generative-ai", tags=["generative-ai"])

# ── Schemas ───────────────────────────────────────────────────────────────────

class JobCreate(BaseModel):
    job_type: str                        # layout | sequencing | risk_analysis
    job_site: Optional[str] = None
    input_params: Optional[dict] = None


class LayoutRequest(BaseModel):
    job_site: str
    area_sqft: Optional[float] = None
    constraints: Optional[dict] = None   # e.g. {"min_passes": 2, "material": "asphalt"}


class SequencingRequest(BaseModel):
    job_site: str
    phases: Optional[list] = None        # ordered list of phase names
    crew_size: Optional[int] = None
    start_date: Optional[str] = None     # ISO date


# ── Helpers ───────────────────────────────────────────────────────────────────

def _job_dict(j: GenerativeAIJob) -> dict:
    return {
        "id": j.id,
        "job_type": j.job_type,
        "status": j.status,
        "job_site": j.job_site,
        "input_params": json.loads(j.input_params) if j.input_params else None,
        "result_summary": json.loads(j.result_summary) if j.result_summary else None,
        "error_message": j.error_message,
        "created_at": j.created_at.isoformat(),
        "updated_at": j.updated_at.isoformat(),
    }


def _stub_layout_result(req: LayoutRequest) -> dict:
    """Return a deterministic stub layout plan (no external AI call required)."""
    area = req.area_sqft or 5000.0
    passes = (req.constraints or {}).get("min_passes", 2)
    material = (req.constraints or {}).get("material", "asphalt")
    return {
        "job_site": req.job_site,
        "optimized_area_sqft": area,
        "material": material,
        "recommended_passes": passes,
        "estimated_material_tons": round(area * 0.05 * passes, 1),
        "energy_efficiency_score": 87,
        "layout_zones": [
            {"zone": "A", "sqft": round(area * 0.4), "priority": 1},
            {"zone": "B", "sqft": round(area * 0.35), "priority": 2},
            {"zone": "C", "sqft": round(area * 0.25), "priority": 3},
        ],
        "note": "JWORDENAI™ layout stub — connect OPENAI_API_KEY for full generative output.",
    }


def _stub_sequencing_result(req: SequencingRequest) -> dict:
    """Return a deterministic stub 4D construction sequence."""
    phases = req.phases or ["Mobilization", "Base Prep", "Paving", "Finishing", "Cleanup"]
    crew = req.crew_size or 6
    schedule = []
    day = 1
    for phase in phases:
        duration = max(1, len(phase) % 4 + 1)
        schedule.append({
            "phase": phase,
            "start_day": day,
            "end_day": day + duration - 1,
            "crew_assigned": crew,
            "risk_level": "low" if day < 5 else "medium",
        })
        day += duration
    return {
        "job_site": req.job_site,
        "total_days": day - 1,
        "crew_size": crew,
        "schedule": schedule,
        "risk_summary": "No critical path conflicts detected.",
        "note": "JWORDENAI™ sequencing stub — connect OPENAI_API_KEY for full 4D simulation.",
    }


# ── Job CRUD ──────────────────────────────────────────────────────────────────

@router.post("/jobs", summary="Submit a generative AI job")
@limiter.limit("20/minute")
async def submit_job(
    request: Request,
    req: JobCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    valid_types = {"layout", "sequencing", "risk_analysis"}
    if req.job_type not in valid_types:
        raise HTTPException(status_code=422, detail=f"job_type must be one of {sorted(valid_types)}")

    job = GenerativeAIJob(
        job_type=req.job_type,
        job_site=req.job_site,
        input_params=json.dumps(req.input_params or {}),
        status="queued",
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    logger.info("Generative AI job #%s (%s) queued for site %r", job.id, job.job_type, job.job_site)
    return {"status": "queued", **_job_dict(job)}


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


@router.get("/jobs/{job_id}", summary="Get a generative AI job")
@limiter.limit("60/minute")
async def get_job(
    request: Request,
    job_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    j = db.get(GenerativeAIJob, job_id)
    if not j:
        raise HTTPException(status_code=404, detail="Job not found")
    return _job_dict(j)


@router.delete("/jobs/{job_id}", summary="Delete a generative AI job record")
@limiter.limit("20/minute")
async def delete_job(
    request: Request,
    job_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    j = db.get(GenerativeAIJob, job_id)
    if not j:
        raise HTTPException(status_code=404, detail="Job not found")
    db.delete(j)
    db.commit()
    return {"status": "deleted", "id": job_id}


# ── Quick synchronous endpoints ───────────────────────────────────────────────

@router.post("/layout", summary="Generate an optimized site layout plan")
@limiter.limit("20/minute")
async def generate_layout(
    request: Request,
    req: LayoutRequest,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """
    Generate a material-efficient layout plan for the given job site.
    Records the request as a completed GenerativeAIJob for audit trail.
    """
    result = _stub_layout_result(req)

    job = GenerativeAIJob(
        job_type="layout",
        job_site=req.job_site,
        input_params=json.dumps(req.model_dump()),
        status="done",
        result_summary=json.dumps(result),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return {"job_id": job.id, "status": "done", "result": result}


@router.post("/sequencing", summary="Generate a 4D construction sequence with risk analysis")
@limiter.limit("20/minute")
async def generate_sequencing(
    request: Request,
    req: SequencingRequest,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """
    Generate a 4D construction schedule and risk analysis for the given site.
    Records the request as a completed GenerativeAIJob for audit trail.
    """
    result = _stub_sequencing_result(req)

    job = GenerativeAIJob(
        job_type="sequencing",
        job_site=req.job_site,
        input_params=json.dumps(req.model_dump()),
        status="done",
        result_summary=json.dumps(result),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return {"job_id": job.id, "status": "done", "result": result}
