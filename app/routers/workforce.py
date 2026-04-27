"""
workforce.py — Crew & Skills Matrix router for JWordenAI.

Routes:
  GET    /api/v1/workforce                   — list workforce members
  POST   /api/v1/workforce                   — add member
  PUT    /api/v1/workforce/{id}              — update member
  DELETE /api/v1/workforce/{id}              — remove member
  GET    /api/v1/workforce/available         — query available + qualified members
  GET    /api/v1/workforce/expiring-certs    — members with expiring certifications
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.limiter import limiter
from ..core.security import verify_premium_security
from ..database import get_db
from ..models import WorkforceMember

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/workforce", tags=["workforce"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class WorkforceCreate(BaseModel):
    name: str
    member_type: str          # employee | sub
    trade: Optional[str] = None
    certifications: Optional[list] = None   # [{cert: str, expiry_date: str}]
    skill_ratings: Optional[dict] = None    # {trade: 1-5}
    available: int = 1
    subcontractor_id: Optional[int] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None


class WorkforceUpdate(WorkforceCreate):
    name: Optional[str] = None
    member_type: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _member_dict(m: WorkforceMember) -> dict:
    certs = json.loads(m.certifications) if m.certifications else []
    ratings = json.loads(m.skill_ratings) if m.skill_ratings else {}
    return {
        "id": m.id,
        "name": m.name,
        "member_type": m.member_type,
        "trade": m.trade,
        "certifications": certs,
        "skill_ratings": ratings,
        "available": bool(m.available),
        "subcontractor_id": m.subcontractor_id,
        "phone": m.phone,
        "email": m.email,
        "notes": m.notes,
        "created_at": m.created_at.isoformat(),
        "updated_at": m.updated_at.isoformat(),
    }


def _cert_expiry_status(cert: dict, now: datetime) -> str:
    """Return 'expired', 'soon' (<30d), 'warning' (<90d), or 'ok'."""
    expiry_str = cert.get("expiry_date")
    if not expiry_str:
        return "ok"
    try:
        expiry = datetime.fromisoformat(expiry_str.replace("Z", "+00:00"))
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        days_left = (expiry - now).days
        if days_left < 0:
            return "expired"
        if days_left <= 30:
            return "soon"
        if days_left <= 90:
            return "warning"
        return "ok"
    except Exception:  # noqa: BLE001
        return "ok"


# ── List / CRUD ───────────────────────────────────────────────────────────────

@router.get("", summary="List workforce members")
@limiter.limit("60/minute")
async def list_workforce(
    request: Request,
    member_type: Optional[str] = Query(default=None),
    trade: Optional[str] = Query(default=None),
    available: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    q = db.query(WorkforceMember)
    if member_type:
        q = q.filter(WorkforceMember.member_type == member_type)
    if trade:
        q = q.filter(WorkforceMember.trade.ilike(f"%{trade}%"))
    if available is not None:
        q = q.filter(WorkforceMember.available == available)
    rows = q.order_by(WorkforceMember.name.asc()).all()
    return {"total": len(rows), "members": [_member_dict(m) for m in rows]}


@router.post("", summary="Add a workforce member")
@limiter.limit("30/minute")
async def create_member(
    request: Request,
    req: WorkforceCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    m = WorkforceMember(
        name=req.name,
        member_type=req.member_type,
        trade=req.trade,
        certifications=json.dumps(req.certifications or []),
        skill_ratings=json.dumps(req.skill_ratings or {}),
        available=req.available,
        subcontractor_id=req.subcontractor_id,
        phone=req.phone,
        email=req.email,
        notes=req.notes,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return {"status": "created", **_member_dict(m)}


@router.put("/{member_id}", summary="Update a workforce member")
@limiter.limit("30/minute")
async def update_member(
    request: Request,
    member_id: int,
    req: WorkforceUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    m = db.get(WorkforceMember, member_id)
    if not m:
        raise HTTPException(status_code=404, detail="Member not found")
    data = req.model_dump(exclude_none=True)
    for key, val in data.items():
        if key == "certifications":
            m.certifications = json.dumps(val)
        elif key == "skill_ratings":
            m.skill_ratings = json.dumps(val)
        else:
            setattr(m, key, val)
    m.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(m)
    return {"status": "updated", **_member_dict(m)}


@router.delete("/{member_id}", summary="Remove a workforce member")
@limiter.limit("30/minute")
async def delete_member(
    request: Request,
    member_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    m = db.get(WorkforceMember, member_id)
    if not m:
        raise HTTPException(status_code=404, detail="Member not found")
    db.delete(m)
    db.commit()
    return {"status": "deleted", "id": member_id}


# ── Available + qualified query ───────────────────────────────────────────────

@router.get("/available", summary="Query available and qualified workforce")
@limiter.limit("30/minute")
async def available_query(
    request: Request,
    scope: str = Query(default=""),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """Return available members qualified for the given scope/trade."""
    q = db.query(WorkforceMember).filter(WorkforceMember.available == 1)
    if scope:
        q = q.filter(WorkforceMember.trade.ilike(f"%{scope}%"))
    rows = q.order_by(WorkforceMember.name.asc()).all()
    return {"scope": scope, "count": len(rows), "members": [_member_dict(m) for m in rows]}


# ── Expiring certifications ───────────────────────────────────────────────────

@router.get("/expiring-certs", summary="Members with expiring certifications")
@limiter.limit("30/minute")
async def expiring_certs(
    request: Request,
    days_ahead: int = Query(default=90, ge=1, le=365),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    now = datetime.now(timezone.utc)
    cutoff = now + timedelta(days=days_ahead)
    rows = db.query(WorkforceMember).all()

    alerts = []
    for m in rows:
        certs = json.loads(m.certifications) if m.certifications else []
        for cert in certs:
            status = _cert_expiry_status(cert, now)
            if status in ("expired", "soon", "warning"):
                expiry_str = cert.get("expiry_date", "")
                try:
                    expiry = datetime.fromisoformat(expiry_str.replace("Z", "+00:00"))
                    if expiry.tzinfo is None:
                        expiry = expiry.replace(tzinfo=timezone.utc)
                    if expiry <= cutoff:
                        alerts.append({
                            "member_id": m.id,
                            "member_name": m.name,
                            "trade": m.trade,
                            "cert": cert.get("cert"),
                            "expiry_date": expiry_str,
                            "status": status,
                            "days_left": (expiry - now).days,
                        })
                except Exception:  # noqa: BLE001
                    pass

    alerts.sort(key=lambda x: x["days_left"])
    return {"count": len(alerts), "days_ahead": days_ahead, "alerts": alerts}
