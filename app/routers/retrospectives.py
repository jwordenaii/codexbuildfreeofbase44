"""
retrospectives.py — Post-Project Lessons Learned Engine for JWordenAI.

Routes:
  GET    /api/v1/retrospectives              — list retrospectives
  POST   /api/v1/retrospectives              — create retrospective
  PUT    /api/v1/retrospectives/{id}         — update retrospective
  DELETE /api/v1/retrospectives/{id}         — delete retrospective
  POST   /api/v1/retrospectives/{id}/tag     — AI-tag a retrospective via GPT-4o
  GET    /api/v1/retrospectives/surface      — surface relevant lessons for a bid
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.limiter import limiter
from ..core.security import verify_premium_security
from ..database import get_db
from ..models import ProjectRetrospective

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/retrospectives", tags=["retrospectives"])


class RetrospectiveCreate(BaseModel):
    project_name: str
    project_type: Optional[str] = None
    region: Optional[str] = None
    closed_date: Optional[str] = None          # ISO date string
    schedule_variance_days: Optional[int] = None
    cost_variance_pct: Optional[float] = None
    supply_chain_issues: Optional[str] = None
    soil_conditions: Optional[str] = None
    design_conflicts: Optional[str] = None
    lessons_learned: Optional[str] = None


class RetrospectiveUpdate(RetrospectiveCreate):
    project_name: Optional[str] = None


def _parse_dt(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
    except Exception:  # noqa: BLE001
        return None


def _to_dict(r: ProjectRetrospective) -> dict:
    return {
        "id": r.id,
        "project_name": r.project_name,
        "project_type": r.project_type,
        "region": r.region,
        "closed_date": r.closed_date.isoformat() if r.closed_date else None,
        "schedule_variance_days": r.schedule_variance_days,
        "cost_variance_pct": r.cost_variance_pct,
        "supply_chain_issues": r.supply_chain_issues,
        "soil_conditions": r.soil_conditions,
        "design_conflicts": r.design_conflicts,
        "lessons_learned": r.lessons_learned,
        "ai_tags": json.loads(r.ai_tags) if r.ai_tags else [],
        "created_at": r.created_at.isoformat(),
        "updated_at": r.updated_at.isoformat(),
    }


@router.get("", summary="List project retrospectives")
@limiter.limit("60/minute")
async def list_retrospectives(
    request: Request,
    project_type: Optional[str] = Query(default=None),
    region: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    q = db.query(ProjectRetrospective)
    if project_type:
        q = q.filter(ProjectRetrospective.project_type.ilike(f"%{project_type}%"))
    if region:
        q = q.filter(ProjectRetrospective.region.ilike(f"%{region}%"))
    total = q.count()
    rows = q.order_by(ProjectRetrospective.created_at.desc()).offset(offset).limit(limit).all()
    return {"total": total, "retrospectives": [_to_dict(r) for r in rows]}


@router.post("", summary="Create a retrospective")
@limiter.limit("30/minute")
async def create_retrospective(
    request: Request,
    req: RetrospectiveCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    retro = ProjectRetrospective(
        project_name=req.project_name,
        project_type=req.project_type,
        region=req.region,
        closed_date=_parse_dt(req.closed_date),
        schedule_variance_days=req.schedule_variance_days,
        cost_variance_pct=req.cost_variance_pct,
        supply_chain_issues=req.supply_chain_issues,
        soil_conditions=req.soil_conditions,
        design_conflicts=req.design_conflicts,
        lessons_learned=req.lessons_learned,
    )
    db.add(retro)
    db.commit()
    db.refresh(retro)
    return {"status": "created", **_to_dict(retro)}


@router.put("/{retro_id}", summary="Update a retrospective")
@limiter.limit("30/minute")
async def update_retrospective(
    request: Request,
    retro_id: int,
    req: RetrospectiveUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    retro = db.get(ProjectRetrospective, retro_id)
    if not retro:
        raise HTTPException(status_code=404, detail="Retrospective not found")
    for key, val in req.model_dump(exclude_none=True).items():
        if key == "closed_date":
            retro.closed_date = _parse_dt(val)
        else:
            setattr(retro, key, val)
    retro.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(retro)
    return {"status": "updated", **_to_dict(retro)}


@router.delete("/{retro_id}", summary="Delete a retrospective")
@limiter.limit("30/minute")
async def delete_retrospective(
    request: Request,
    retro_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    retro = db.get(ProjectRetrospective, retro_id)
    if not retro:
        raise HTTPException(status_code=404, detail="Retrospective not found")
    db.delete(retro)
    db.commit()
    return {"status": "deleted", "id": retro_id}


@router.post("/{retro_id}/tag", summary="AI-tag a retrospective via GPT-4o")
@limiter.limit("10/minute")
async def ai_tag_retrospective(
    request: Request,
    retro_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    retro = db.get(ProjectRetrospective, retro_id)
    if not retro:
        raise HTTPException(status_code=404, detail="Retrospective not found")

    tags = _generate_tags(retro)
    retro.ai_tags = json.dumps(tags)
    retro.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(retro)
    return {"status": "tagged", "tags": tags, **_to_dict(retro)}


@router.get("/surface", summary="Surface relevant past lessons for a new bid")
@limiter.limit("30/minute")
async def surface_lessons(
    request: Request,
    project_type: str = Query(default=""),
    region: str = Query(default=""),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """Return up to 3 retrospectives most relevant to the given project type and region."""
    q = db.query(ProjectRetrospective)
    results = []

    # Exact-match candidates first
    if project_type:
        matches = q.filter(ProjectRetrospective.project_type.ilike(f"%{project_type}%"))
        if region:
            matches = matches.filter(ProjectRetrospective.region.ilike(f"%{region}%"))
        results = matches.order_by(ProjectRetrospective.created_at.desc()).limit(3).all()

    # Fall back to region-only if not enough results
    if len(results) < 3 and region:
        existing_ids = {r.id for r in results}
        more = (
            q.filter(ProjectRetrospective.region.ilike(f"%{region}%"))
            .filter(~ProjectRetrospective.id.in_(existing_ids or [0]))
            .order_by(ProjectRetrospective.created_at.desc())
            .limit(3 - len(results))
            .all()
        )
        results.extend(more)

    # Final fallback: most recent lessons
    if len(results) < 3:
        existing_ids = {r.id for r in results}
        more = (
            q.filter(~ProjectRetrospective.id.in_(existing_ids or [0]))
            .order_by(ProjectRetrospective.created_at.desc())
            .limit(3 - len(results))
            .all()
        )
        results.extend(more)

    return {
        "project_type": project_type,
        "region": region,
        "count": len(results),
        "lessons": [_to_dict(r) for r in results],
    }


# ── AI tagging helper ─────────────────────────────────────────────────────────

def _generate_tags(retro: ProjectRetrospective) -> list[str]:
    """Generate AI tags using GPT-4o; fall back to rule-based tags."""
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        return _rule_based_tags(retro)

    try:
        from openai import OpenAI  # noqa: PLC0415
        client = OpenAI(api_key=api_key)
        text = "\n".join(filter(None, [
            f"Project type: {retro.project_type}",
            f"Region: {retro.region}",
            f"Supply chain issues: {retro.supply_chain_issues}",
            f"Soil conditions: {retro.soil_conditions}",
            f"Design conflicts: {retro.design_conflicts}",
            f"Lessons: {retro.lessons_learned}",
        ]))
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a construction project risk analyst. "
                        "Return a JSON array of 3-8 short tags (strings) that best categorize "
                        "the risk factors and lessons from this project retrospective. "
                        "Tags should be lowercase kebab-case, e.g. 'drainage-issue', 'supply-delay', 'soil-instability'. "
                        "Return ONLY the JSON array, no explanation."
                    ),
                },
                {"role": "user", "content": text},
            ],
            max_tokens=150,
            temperature=0.3,
        )
        raw = resp.choices[0].message.content.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)
    except Exception as exc:  # noqa: BLE001
        logger.warning("GPT-4o tagging failed, using rule-based: %s", exc)
        return _rule_based_tags(retro)


def _rule_based_tags(retro: ProjectRetrospective) -> list[str]:
    tags = []
    if retro.project_type:
        tags.append(retro.project_type.lower().replace(" ", "-"))
    if retro.region:
        tags.append(f"region-{retro.region.lower().replace(' ', '-')}")
    if retro.supply_chain_issues:
        tags.append("supply-chain")
    if retro.soil_conditions:
        tags.append("soil-conditions")
    if retro.design_conflicts:
        tags.append("design-conflict")
    if retro.schedule_variance_days and retro.schedule_variance_days > 0:
        tags.append("schedule-overrun")
    if retro.cost_variance_pct and retro.cost_variance_pct > 0:
        tags.append("cost-overrun")
    return tags or ["general"]
