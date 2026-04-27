"""
project_metrics.py — Project Performance Scorecard / Reputation Engine for JWordenAI.

Routes:
  GET    /api/v1/project-metrics             — list scorecards
  POST   /api/v1/project-metrics             — create scorecard entry
  PUT    /api/v1/project-metrics/{id}        — update scorecard entry
  DELETE /api/v1/project-metrics/{id}        — delete scorecard entry
  GET    /api/v1/project-metrics/trends      — portfolio-level trend aggregation
  POST   /api/v1/project-metrics/{id}/case-study — GPT-4o case study generation
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.limiter import limiter
from ..core.security import verify_premium_security
from ..database import get_db
from ..models import ProjectMetric

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/project-metrics", tags=["project-metrics"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class MetricCreate(BaseModel):
    project_name: str
    lead_id: Optional[int] = None
    actual_cost: Optional[float] = None
    estimated_cost: Optional[float] = None
    scheduled_days: Optional[int] = None
    actual_days: Optional[int] = None
    client_nps: Optional[int] = None       # 0-10
    punch_list_items: int = 0
    punch_list_closed: int = 0
    completion_date: Optional[str] = None  # ISO date string


class MetricUpdate(MetricCreate):
    project_name: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_dt(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def _metric_dict(m: ProjectMetric) -> dict:
    cost_accuracy = None
    if m.actual_cost and m.estimated_cost and m.estimated_cost > 0:
        cost_accuracy = round((1 - abs(m.actual_cost - m.estimated_cost) / m.estimated_cost) * 100, 1)
    schedule_adherence = None
    if m.actual_days and m.scheduled_days and m.scheduled_days > 0:
        schedule_adherence = round((m.scheduled_days / m.actual_days) * 100, 1)
    punch_closure = None
    if m.punch_list_items and m.punch_list_items > 0:
        punch_closure = round((m.punch_list_closed / m.punch_list_items) * 100, 1)
    return {
        "id": m.id,
        "project_name": m.project_name,
        "lead_id": m.lead_id,
        "actual_cost": m.actual_cost,
        "estimated_cost": m.estimated_cost,
        "scheduled_days": m.scheduled_days,
        "actual_days": m.actual_days,
        "client_nps": m.client_nps,
        "punch_list_items": m.punch_list_items,
        "punch_list_closed": m.punch_list_closed,
        "case_study_published": bool(m.case_study_published),
        "case_study_text": m.case_study_text,
        "completion_date": m.completion_date.isoformat() if m.completion_date else None,
        # Computed metrics
        "cost_accuracy_pct": cost_accuracy,
        "schedule_adherence_pct": schedule_adherence,
        "punch_closure_pct": punch_closure,
        "created_at": m.created_at.isoformat(),
        "updated_at": m.updated_at.isoformat(),
    }


# ── CRUD endpoints ────────────────────────────────────────────────────────────

@router.get("", summary="List project scorecards")
@limiter.limit("60/minute")
async def list_metrics(
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    rows = db.query(ProjectMetric).order_by(ProjectMetric.created_at.desc()).all()
    return {"total": len(rows), "metrics": [_metric_dict(m) for m in rows]}


@router.post("", summary="Create a project scorecard entry")
@limiter.limit("30/minute")
async def create_metric(
    request: Request,
    req: MetricCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    m = ProjectMetric(
        project_name=req.project_name,
        lead_id=req.lead_id,
        actual_cost=req.actual_cost,
        estimated_cost=req.estimated_cost,
        scheduled_days=req.scheduled_days,
        actual_days=req.actual_days,
        client_nps=req.client_nps,
        punch_list_items=req.punch_list_items,
        punch_list_closed=req.punch_list_closed,
        completion_date=_parse_dt(req.completion_date),
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return {"status": "created", **_metric_dict(m)}


@router.put("/{metric_id}", summary="Update a project scorecard")
@limiter.limit("30/minute")
async def update_metric(
    request: Request,
    metric_id: int,
    req: MetricUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    m = db.get(ProjectMetric, metric_id)
    if not m:
        raise HTTPException(status_code=404, detail="Metric not found")
    for key, val in req.model_dump(exclude_none=True).items():
        if key == "completion_date":
            m.completion_date = _parse_dt(val)
        else:
            setattr(m, key, val)
    m.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(m)
    return {"status": "updated", **_metric_dict(m)}


@router.delete("/{metric_id}", summary="Delete a project scorecard")
@limiter.limit("30/minute")
async def delete_metric(
    request: Request,
    metric_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    m = db.get(ProjectMetric, metric_id)
    if not m:
        raise HTTPException(status_code=404, detail="Metric not found")
    db.delete(m)
    db.commit()
    return {"status": "deleted", "id": metric_id}


# ── Portfolio trends ──────────────────────────────────────────────────────────

@router.get("/trends", summary="Portfolio-level performance trends")
@limiter.limit("30/minute")
async def trends(
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    rows = db.query(ProjectMetric).order_by(ProjectMetric.completion_date.asc()).all()
    if not rows:
        return {"count": 0, "averages": {}, "projects": []}

    # Aggregate averages
    cost_acc = [
        (1 - abs(m.actual_cost - m.estimated_cost) / m.estimated_cost) * 100
        for m in rows if m.actual_cost and m.estimated_cost and m.estimated_cost > 0
    ]
    sched_adh = [
        (m.scheduled_days / m.actual_days) * 100
        for m in rows if m.actual_days and m.scheduled_days and m.actual_days > 0
    ]
    nps_vals = [m.client_nps for m in rows if m.client_nps is not None]
    punch_rates = [
        (m.punch_list_closed / m.punch_list_items) * 100
        for m in rows if m.punch_list_items and m.punch_list_items > 0
    ]

    def avg(lst):
        return round(sum(lst) / len(lst), 1) if lst else None

    return {
        "count": len(rows),
        "averages": {
            "cost_accuracy_pct": avg(cost_acc),
            "schedule_adherence_pct": avg(sched_adh),
            "avg_client_nps": avg(nps_vals),
            "punch_closure_pct": avg(punch_rates),
        },
        "projects": [_metric_dict(m) for m in rows],
    }


# ── Case study generation ─────────────────────────────────────────────────────

@router.post("/{metric_id}/case-study", summary="Generate GPT-4o case study card")
@limiter.limit("5/minute")
async def generate_case_study(
    request: Request,
    metric_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    m = db.get(ProjectMetric, metric_id)
    if not m:
        raise HTTPException(status_code=404, detail="Metric not found")

    text = _build_case_study(m)
    m.case_study_text = text
    m.case_study_published = 1
    m.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(m)
    return {"status": "generated", "case_study_text": text}


def _build_case_study(m: ProjectMetric) -> str:
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        return _fallback_case_study(m)
    try:
        from openai import OpenAI  # noqa: PLC0415
        client = OpenAI(api_key=api_key)
        cost_note = ""
        if m.actual_cost and m.estimated_cost and m.estimated_cost > 0:
            pct = round(abs(m.actual_cost - m.estimated_cost) / m.estimated_cost * 100, 1)
            direction = "under" if m.actual_cost <= m.estimated_cost else "over"
            cost_note = f"Completed {pct}% {direction} budget."
        sched_note = ""
        if m.actual_days and m.scheduled_days:
            diff = m.actual_days - m.scheduled_days
            sched_note = f"Delivered {abs(diff)} day(s) {'early' if diff <= 0 else 'late'}."
        nps_note = f"Client NPS: {m.client_nps}/10." if m.client_nps is not None else ""

        prompt = (
            f"Write a 2-paragraph marketing case study card for J. Worden & Sons Asphalt Paving. "
            f"Project: {m.project_name}. {cost_note} {sched_note} {nps_note} "
            f"Be professional, specific, and highlight the firm's craftsmanship and reliability."
        )
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0.7,
        )
        return resp.choices[0].message.content.strip()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Case study GPT-4o failed: %s", exc)
        return _fallback_case_study(m)


def _fallback_case_study(m: ProjectMetric) -> str:
    lines = [f"**{m.project_name}**", ""]
    lines.append("J. Worden & Sons Asphalt Paving successfully completed this project, demonstrating our commitment to quality workmanship and on-time delivery.")
    if m.actual_cost and m.estimated_cost:
        lines.append(f"The project was delivered within the estimated budget of ${m.estimated_cost:,.0f}.")
    if m.client_nps is not None:
        lines.append(f"Client satisfaction score: {m.client_nps}/10.")
    return "\n".join(lines)
