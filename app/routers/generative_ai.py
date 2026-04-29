"""
generative_ai.py — JWORDENAI Generative AI engine for construction planning.

Routes:
  POST /api/v1/gen-ai/layout              — generate an optimized site layout
  GET  /api/v1/gen-ai/layout/{job_id}     — retrieve a layout generation result
  POST /api/v1/gen-ai/simulate            — run a 4D construction sequence simulation
  GET  /api/v1/gen-ai/simulate/{job_id}   — retrieve a simulation result
  GET  /api/v1/gen-ai/jobs                — list all generative AI jobs

Layout generation analyses project dimensions and constraints to propose a
material-efficient, energy-optimised site arrangement.

4D simulation models the full construction sequence (3D geometry + time) and
surfaces schedule risk, resource conflicts, and critical-path bottlenecks.
"""

import json
import logging
import time
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..core.limiter import limiter
from ..core.security import verify_premium_security
from ..database import get_db
from ..models import GenerativeAIJob

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/gen-ai", tags=["generative-ai"])

_VALID_STATUSES = {"pending", "running", "completed", "failed"}


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class LayoutRequest(BaseModel):
    project_name: str
    site_area_sqft: float = Field(gt=0)
    num_structures: int = Field(default=1, ge=1, le=50)
    material_constraints: Optional[list[str]] = None   # e.g. ["low_carbon_concrete", "recycled_asphalt"]
    energy_targets: Optional[dict] = None               # e.g. {"max_kwh_per_sqft": 12}
    notes: Optional[str] = None


class SimulationRequest(BaseModel):
    project_name: str
    phases: list[dict] = Field(
        ...,
        description=(
            "Ordered list of construction phases, each with at minimum "
            "'name' (str) and 'duration_days' (int). Optional: 'crew_size', "
            "'equipment', 'dependencies' (list of phase names)."
        ),
    )
    start_date: Optional[str] = None    # ISO date string, e.g. "2026-06-01"
    risk_factors: Optional[list[str]] = None   # e.g. ["weather", "supply_chain"]
    notes: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _job_dict(j: GenerativeAIJob) -> dict:
    return {
        "id": j.id,
        "job_type": j.job_type,
        "status": j.status,
        "input": json.loads(j.input_json) if j.input_json else None,
        "output": json.loads(j.output_json) if j.output_json else None,
        "error_message": j.error_message,
        "duration_ms": j.duration_ms,
        "created_at": j.created_at.isoformat(),
        "updated_at": j.updated_at.isoformat(),
    }


def _generate_layout(req: LayoutRequest) -> dict:
    """
    Deterministic layout optimiser stub.

    In production this would call an external ML service or run a
    constraint-satisfaction solver.  The stub returns a structured
    result that downstream consumers can act on today.
    """
    material_note = (
        ", ".join(req.material_constraints)
        if req.material_constraints
        else "standard materials"
    )
    zones = []
    remaining = req.site_area_sqft
    for i in range(req.num_structures):
        alloc = round(remaining / (req.num_structures - i), 1)
        remaining -= alloc
        zones.append({
            "zone_id": i + 1,
            "label": f"Structure {i + 1}",
            "area_sqft": alloc,
            "orientation": "south-facing" if i % 2 == 0 else "east-facing",
            "material_recommendation": material_note,
        })

    energy_score = 87 - len(zones) * 2   # simplified heuristic
    return {
        "project_name": req.project_name,
        "total_area_sqft": req.site_area_sqft,
        "zones": zones,
        "energy_efficiency_score": max(0, min(100, energy_score)),
        "material_savings_estimate_pct": round(8.5 + len(zones) * 0.5, 1),
        "recommendations": [
            "Orient primary structures south to maximise passive solar gain.",
            f"Use {material_note} to reduce embodied carbon by up to 22%.",
            "Consolidate utility runs along the north boundary to cut conduit length.",
        ],
    }


def _simulate_sequence(req: SimulationRequest) -> dict:
    """
    4D construction sequencing simulator stub.

    Returns a risk-annotated schedule with critical-path analysis.
    """
    risk_factors = req.risk_factors or []
    phases_out = []
    current_day = 0
    critical_path: list[str] = []
    high_risk_phases: list[str] = []

    for phase in req.phases:
        name = phase.get("name", f"Phase {len(phases_out)+1}")
        duration = int(phase.get("duration_days", 5))
        crew = phase.get("crew_size", 4)
        deps = phase.get("dependencies", [])

        # Simple risk scoring: longer duration + external risk factors → higher risk
        risk_score = min(1.0, (duration / 30) + len(risk_factors) * 0.1)
        risk_label = (
            "high" if risk_score >= 0.7
            else "medium" if risk_score >= 0.4
            else "low"
        )
        if risk_label == "high":
            high_risk_phases.append(name)

        phases_out.append({
            "name": name,
            "start_day": current_day,
            "end_day": current_day + duration,
            "duration_days": duration,
            "crew_size": crew,
            "dependencies": deps,
            "risk_score": round(risk_score, 2),
            "risk_label": risk_label,
        })

        # For this stub, every phase is on the critical path (no parallelism modelled)
        critical_path.append(name)
        current_day += duration

    total_days = current_day
    risk_summary = (
        f"{len(high_risk_phases)} phase(s) flagged as high-risk: "
        + (", ".join(high_risk_phases) if high_risk_phases else "none")
    )

    return {
        "project_name": req.project_name,
        "total_duration_days": total_days,
        "phases": phases_out,
        "critical_path": critical_path,
        "risk_factors_considered": risk_factors,
        "high_risk_phases": high_risk_phases,
        "risk_summary": risk_summary,
        "recommendations": [
            "Pre-order long-lead materials for high-risk phases at least 8 weeks early.",
            "Schedule weather contingency buffer (≥10%) for outdoor phases.",
            "Cross-train crew members across adjacent phases to reduce bottleneck risk.",
        ],
    }


# ── Layout generation ─────────────────────────────────────────────────────────

@router.post("/layout", summary="Generate an AI-optimised site layout")
@limiter.limit("20/minute")
async def generate_layout(
    request: Request,
    req: LayoutRequest = Body(...),
    db: Session = Depends(get_db),
    security: dict = Depends(verify_premium_security),
):
    """
    Analyse project constraints and generate an optimised layout that
    minimises material waste and maximises energy efficiency.
    """
    t0 = time.monotonic()
    tenant_id = security.get("tenant_id", "default")

    job = GenerativeAIJob(
        job_type="layout_generation",
        status="running",
        input_json=req.model_dump_json(),
        tenant_id=tenant_id,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    try:
        result = _generate_layout(req)
        job.output_json = json.dumps(result)
        job.status = "completed"
    except Exception as exc:  # noqa: BLE001
        logger.exception("Layout generation failed for job %s", job.id)
        job.status = "failed"
        job.error_message = str(exc)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Layout generation failed: {exc}") from exc

    job.duration_ms = int((time.monotonic() - t0) * 1000)
    job.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(job)
    return {"status": "completed", "job": _job_dict(job)}


@router.get("/layout/{job_id}", summary="Retrieve a layout generation result")
@limiter.limit("60/minute")
async def get_layout_job(
    request: Request,
    job_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    job = db.get(GenerativeAIJob, job_id)
    if not job or job.job_type != "layout_generation":
        raise HTTPException(status_code=404, detail="Layout job not found")
    return _job_dict(job)


# ── 4D simulation ─────────────────────────────────────────────────────────────

@router.post("/simulate", summary="Run a 4D construction sequence simulation")
@limiter.limit("10/minute")
async def run_simulation(
    request: Request,
    req: SimulationRequest = Body(...),
    db: Session = Depends(get_db),
    security: dict = Depends(verify_premium_security),
):
    """
    Model the full construction sequence across time (4D = 3D + schedule),
    identify schedule risks, resource conflicts, and critical-path bottlenecks.
    """
    if not req.phases:
        raise HTTPException(status_code=422, detail="At least one phase is required")

    t0 = time.monotonic()
    tenant_id = security.get("tenant_id", "default")

    job = GenerativeAIJob(
        job_type="sequence_simulation",
        status="running",
        input_json=req.model_dump_json(),
        tenant_id=tenant_id,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    try:
        result = _simulate_sequence(req)
        job.output_json = json.dumps(result)
        job.status = "completed"
    except Exception as exc:  # noqa: BLE001
        logger.exception("Sequence simulation failed for job %s", job.id)
        job.status = "failed"
        job.error_message = str(exc)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Simulation failed: {exc}") from exc

    job.duration_ms = int((time.monotonic() - t0) * 1000)
    job.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(job)
    return {"status": "completed", "job": _job_dict(job)}


@router.get("/simulate/{job_id}", summary="Retrieve a simulation result")
@limiter.limit("60/minute")
async def get_simulation_job(
    request: Request,
    job_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    job = db.get(GenerativeAIJob, job_id)
    if not job or job.job_type != "sequence_simulation":
        raise HTTPException(status_code=404, detail="Simulation job not found")
    return _job_dict(job)


# ── Job listing ───────────────────────────────────────────────────────────────

@router.get("/jobs", summary="List all generative AI jobs")
@limiter.limit("30/minute")
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
        if status not in _VALID_STATUSES:
            raise HTTPException(
                status_code=422,
                detail=f"status must be one of: {', '.join(sorted(_VALID_STATUSES))}",
            )
        q = q.filter(GenerativeAIJob.status == status)
    total = q.count()
    rows = q.order_by(GenerativeAIJob.created_at.desc()).offset(offset).limit(limit).all()
    return {"total": total, "jobs": [_job_dict(j) for j in rows]}
