"""
lien_calendar.py router — Mechanics lien deadline tracker endpoints for JWordenAI.

Routes:
  POST /api/v1/liens/calculate    — calculate deadlines (no DB save)
  POST /api/v1/liens/track        — save a project to LienCalendarEntry
  GET  /api/v1/liens/upcoming     — list upcoming deadlines
  GET  /api/v1/liens/entries      — list all entries

Requires premium security.
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
from ..models import LienCalendarEntry
from ..services.lien_calendar import calculate_deadlines, get_upcoming_deadlines

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/liens", tags=["lien-calendar"])


class LienCalcRequest(BaseModel):
    state_code: str
    project_start_date: str   # ISO format date string
    last_furnishing_date: str  # ISO format date string


class LienTrackRequest(BaseModel):
    customer_name: str
    project_address: str
    state_code: str
    project_start_date: str
    last_furnishing_date: str
    notes: Optional[str] = None


def _parse_date(date_str: str) -> datetime:
    """Parse an ISO date string, adding UTC timezone."""
    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"Invalid date format: {date_str}. Use ISO 8601.") from exc


@router.post("/calculate", summary="Calculate lien deadlines without saving")
@limiter.limit("60/minute")
async def calculate_lien_deadlines(
    request: Request,
    req: LienCalcRequest,
    _: dict = Depends(verify_premium_security),
):
    """
    Calculate preliminary notice, lien filing, and foreclosure deadlines
    for a given state and project dates. Does not save to database.
    """
    start = _parse_date(req.project_start_date)
    last_furnish = _parse_date(req.last_furnishing_date)

    result = calculate_deadlines(req.state_code, start, last_furnish)
    return {"status": "ok", **result}


@router.post("/track", summary="Track a project's lien deadlines in the database")
@limiter.limit("30/minute")
async def track_lien_project(
    request: Request,
    req: LienTrackRequest,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """Save a project to the lien calendar and return calculated deadlines."""
    start = _parse_date(req.project_start_date)
    last_furnish = _parse_date(req.last_furnishing_date)

    deadlines = calculate_deadlines(req.state_code, start, last_furnish)

    def _parse_opt(d: Optional[str]) -> Optional[datetime]:
        if not d:
            return None
        try:
            dt = datetime.fromisoformat(d.replace("Z", "+00:00"))
            return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
        except Exception:  # noqa: BLE001
            return None

    entry = LienCalendarEntry(
        customer_name=req.customer_name,
        project_address=req.project_address,
        state_code=req.state_code.upper(),
        project_start_date=start,
        last_furnishing_date=last_furnish,
        preliminary_notice_deadline=_parse_opt(deadlines.get("preliminary_notice_deadline")),
        lien_filing_deadline=_parse_opt(deadlines.get("lien_filing_deadline")),
        foreclosure_deadline=_parse_opt(deadlines.get("foreclosure_deadline")),
        notes=req.notes,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    return {"status": "tracked", "id": entry.id, **deadlines}


@router.get("/upcoming", summary="List upcoming lien deadlines")
@limiter.limit("60/minute")
async def upcoming_deadlines(
    request: Request,
    days_ahead: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """Return LienCalendarEntry records with deadlines within days_ahead."""
    deadlines = get_upcoming_deadlines(db, days_ahead=days_ahead)
    return {"count": len(deadlines), "days_ahead": days_ahead, "entries": deadlines}


@router.get("/entries", summary="List all lien calendar entries")
@limiter.limit("60/minute")
async def list_entries(
    request: Request,
    state_code: Optional[str] = Query(default=None, max_length=2),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """Return all lien calendar entries with optional state filter."""
    q = db.query(LienCalendarEntry)
    if state_code:
        q = q.filter(LienCalendarEntry.state_code == state_code.upper())

    total = q.count()
    entries = q.order_by(LienCalendarEntry.created_at.desc()).offset(offset).limit(limit).all()

    return {
        "total": total,
        "entries": [
            {
                "id": e.id,
                "customer_name": e.customer_name,
                "project_address": e.project_address,
                "state_code": e.state_code,
                "lien_filing_deadline": e.lien_filing_deadline.isoformat() if e.lien_filing_deadline else None,
                "foreclosure_deadline": e.foreclosure_deadline.isoformat() if e.foreclosure_deadline else None,
                "preliminary_notice_deadline": e.preliminary_notice_deadline.isoformat() if e.preliminary_notice_deadline else None,
                "notes": e.notes,
                "created_at": e.created_at.isoformat(),
            }
            for e in entries
        ],
    }
