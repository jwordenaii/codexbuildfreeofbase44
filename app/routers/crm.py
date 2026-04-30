"""
crm.py — Lead Pipeline CRM endpoints for JWordenAI.

Provides stage tracking for the lead pipeline with funnel analytics.

Routes:
  GET   /api/v1/crm/leads                 — list leads with pipeline_stage filter
  PATCH /api/v1/crm/leads/{lead_id}/stage — update pipeline stage
  GET   /api/v1/crm/funnel                — stage funnel counts

All endpoints require premium security and are rate-limited.

Caching:
  GET /leads  — 30 s TTL, keyed by filter params
  GET /funnel — 30 s TTL, single key
  PATCH stage — invalidates crm:leads:*, crm:funnel, and analytics caches
"""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.cache import (
    CRM_LEADS_TTL,
    KEY_CRM_FUNNEL,
    cache_get,
    cache_set,
    invalidate_crm_caches,
)
from ..core.limiter import CRM_LIMIT, limiter
from ..core.security import verify_premium_security
from ..database import get_db
from ..models import Lead

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/crm", tags=["crm"])

_VALID_STAGES = {"new", "contacted", "proposal_sent", "negotiating", "won", "lost"}

# Timestamps to set when entering a stage
_STAGE_TIMESTAMPS = {
    "contacted": "contacted_at",
    "proposal_sent": "proposal_sent_at",
    "won": "closed_at",
    "lost": "closed_at",
}


class StageUpdate(BaseModel):
    pipeline_stage: str
    closed_reason: Optional[str] = None


@router.get("/leads", summary="List leads with pipeline stage filter")
@limiter.limit(CRM_LIMIT)
async def list_crm_leads(
    request: Request,
    pipeline_stage: Optional[str] = Query(default=None, max_length=30),
    score_label: Optional[str] = Query(default=None, max_length=10),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """Return paginated leads, optionally filtered by pipeline_stage and score_label."""
    # Build a stable cache key from the query parameters
    params = json.dumps(
        {"stage": pipeline_stage, "label": score_label, "limit": limit, "offset": offset},
        sort_keys=True,
    )
    cache_key = f"crm:leads:{hashlib.md5(params.encode()).hexdigest()}"  # noqa: S324

    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    q = db.query(Lead)
    if pipeline_stage:
        q = q.filter(Lead.pipeline_stage == pipeline_stage)
    if score_label:
        q = q.filter(Lead.score_label == score_label.upper())

    total = q.count()
    leads = q.order_by(Lead.created_at.desc()).offset(offset).limit(limit).all()

    result = {
        "total": total,
        "offset": offset,
        "limit": limit,
        "leads": [
            {
                "id": l.id,
                "name": l.name,
                "email": l.email,
                "phone": l.phone,
                "service_type": l.service_type,
                "urgency": l.urgency,
                "score_label": l.score_label,
                "pipeline_stage": l.pipeline_stage or "new",
                "contacted_at": l.contacted_at.isoformat() if l.contacted_at else None,
                "proposal_sent_at": l.proposal_sent_at.isoformat() if l.proposal_sent_at else None,
                "closed_at": l.closed_at.isoformat() if l.closed_at else None,
                "closed_reason": l.closed_reason,
                "created_at": l.created_at.isoformat(),
            }
            for l in leads
        ],
    }
    cache_set(cache_key, result, CRM_LEADS_TTL)
    return result


@router.patch("/leads/{lead_id}/stage", summary="Update lead pipeline stage")
@limiter.limit(CRM_LIMIT)
async def update_stage(
    request: Request,
    lead_id: int,
    body: StageUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """Move a lead to a new pipeline stage. Sets appropriate timestamps automatically."""
    if body.pipeline_stage not in _VALID_STAGES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid stage. Must be one of: {', '.join(sorted(_VALID_STAGES))}",
        )

    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    lead.pipeline_stage = body.pipeline_stage

    # Set timestamp for this stage
    ts_field = _STAGE_TIMESTAMPS.get(body.pipeline_stage)
    if ts_field and not getattr(lead, ts_field):
        setattr(lead, ts_field, datetime.now(timezone.utc))

    if body.closed_reason and body.pipeline_stage in ("won", "lost"):
        lead.closed_reason = body.closed_reason

    db.commit()
    logger.info("Lead %d moved to stage '%s'", lead_id, body.pipeline_stage)

    # Invalidate CRM and analytics caches — stage change affects funnel counts,
    # KPI win rate, and the analytics dashboard.
    invalidate_crm_caches()

    return {"id": lead_id, "pipeline_stage": lead.pipeline_stage, "status": "updated"}


@router.get("/funnel", summary="Lead conversion funnel counts by stage")
@limiter.limit(CRM_LIMIT)
async def get_funnel(
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """Return aggregate lead counts by pipeline stage for funnel visualization."""
    cached = cache_get(KEY_CRM_FUNNEL)
    if cached is not None:
        return cached

    from sqlalchemy import func  # noqa: PLC0415

    rows = (
        db.query(Lead.pipeline_stage, func.count(Lead.id))
        .group_by(Lead.pipeline_stage)
        .all()
    )
    by_stage = {row[0] or "new": row[1] for row in rows}

    # Ensure all stages are present
    stages = ["new", "contacted", "proposal_sent", "negotiating", "won", "lost"]
    funnel = [{"stage": s, "count": by_stage.get(s, 0)} for s in stages]

    total = sum(item["count"] for item in funnel)
    won = by_stage.get("won", 0)
    win_rate = round(won / total * 100, 1) if total > 0 else 0.0

    result = {
        "funnel": funnel,
        "total": total,
        "won": won,
        "win_rate_pct": win_rate,
    }
    cache_set(KEY_CRM_FUNNEL, result, CRM_LEADS_TTL)
    return result
