"""
innovations.py — Innovation Lab Tracker router for JWordenAI.

Routes:
  GET    /api/v1/innovations             — list innovation entries
  POST   /api/v1/innovations             — log a new innovation trial
  PUT    /api/v1/innovations/{id}        — update an entry
  DELETE /api/v1/innovations/{id}        — delete an entry
  GET    /api/v1/innovations/adopted     — summary of adopted methods
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
from ..models import Innovation

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/innovations", tags=["innovations"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class InnovationCreate(BaseModel):
    method_name: str
    job_site: Optional[str] = None
    date_tested: Optional[str] = None      # ISO date string
    cost_to_test: Optional[float] = None
    result: str                             # pass | fail | adopted
    category: Optional[str] = None         # drone | materials | robotics | process
    notes: Optional[str] = None


class InnovationUpdate(InnovationCreate):
    method_name: Optional[str] = None
    result: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_dt(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def _innov_dict(i: Innovation) -> dict:
    return {
        "id": i.id,
        "method_name": i.method_name,
        "job_site": i.job_site,
        "date_tested": i.date_tested.isoformat() if i.date_tested else None,
        "cost_to_test": i.cost_to_test,
        "result": i.result,
        "category": i.category,
        "notes": i.notes,
        "created_at": i.created_at.isoformat(),
        "updated_at": i.updated_at.isoformat(),
    }


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("", summary="List innovation log entries")
@limiter.limit("60/minute")
async def list_innovations(
    request: Request,
    category: Optional[str] = Query(default=None),
    result: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    q = db.query(Innovation)
    if category:
        q = q.filter(Innovation.category == category)
    if result:
        q = q.filter(Innovation.result == result)
    total = q.count()
    rows = q.order_by(Innovation.created_at.desc()).offset(offset).limit(limit).all()
    return {"total": total, "innovations": [_innov_dict(i) for i in rows]}


@router.post("", summary="Log a new innovation trial")
@limiter.limit("30/minute")
async def create_innovation(
    request: Request,
    req: InnovationCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    if req.result not in ("pass", "fail", "adopted"):
        raise HTTPException(status_code=422, detail="result must be pass | fail | adopted")
    innov = Innovation(
        method_name=req.method_name,
        job_site=req.job_site,
        date_tested=_parse_dt(req.date_tested),
        cost_to_test=req.cost_to_test,
        result=req.result,
        category=req.category,
        notes=req.notes,
    )
    db.add(innov)
    db.commit()
    db.refresh(innov)
    return {"status": "created", **_innov_dict(innov)}


@router.put("/{innov_id}", summary="Update an innovation entry")
@limiter.limit("30/minute")
async def update_innovation(
    request: Request,
    innov_id: int,
    req: InnovationUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    innov = db.get(Innovation, innov_id)
    if not innov:
        raise HTTPException(status_code=404, detail="Innovation not found")
    for key, val in req.model_dump(exclude_none=True).items():
        if key == "date_tested":
            innov.date_tested = _parse_dt(val)
        else:
            setattr(innov, key, val)
    innov.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(innov)
    return {"status": "updated", **_innov_dict(innov)}


@router.delete("/{innov_id}", summary="Delete an innovation entry")
@limiter.limit("30/minute")
async def delete_innovation(
    request: Request,
    innov_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    innov = db.get(Innovation, innov_id)
    if not innov:
        raise HTTPException(status_code=404, detail="Innovation not found")
    db.delete(innov)
    db.commit()
    return {"status": "deleted", "id": innov_id}


# ── Adopted methods summary ───────────────────────────────────────────────────

@router.get("/adopted", summary="Summary of adopted innovation methods")
@limiter.limit("30/minute")
async def adopted_methods(
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    adopted = db.query(Innovation).filter(Innovation.result == "adopted").order_by(Innovation.date_tested.desc()).all()
    by_category: dict[str, list] = {}
    total_cost = 0.0
    for i in adopted:
        cat = i.category or "other"
        by_category.setdefault(cat, [])
        by_category[cat].append(i.method_name)
        total_cost += i.cost_to_test or 0.0

    return {
        "total_adopted": len(adopted),
        "total_test_investment": round(total_cost, 2),
        "by_category": by_category,
        "methods": [_innov_dict(i) for i in adopted],
    }
