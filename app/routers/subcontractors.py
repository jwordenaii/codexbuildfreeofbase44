"""
subcontractors.py — Subcontractor roster and compliance management for JWordenAI.

Routes:
  GET    /api/v1/subcontractors           — list subcontractors
  POST   /api/v1/subcontractors           — add subcontractor
  PUT    /api/v1/subcontractors/{id}      — update subcontractor
  DELETE /api/v1/subcontractors/{id}      — deactivate subcontractor
  GET    /api/v1/subcontractors/expiring  — get expiring certifications

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
from ..models import SubcontractorPerformance, SubcontractorRoster
from ..services.subcontractor_monitor import get_compliance_summary, get_expiring_certs

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/subcontractors", tags=["subcontractors"])


def _parse_dt(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
    except Exception:  # noqa: BLE001
        return None


class SubcontractorCreate(BaseModel):
    name: str
    company: str
    email: Optional[str] = None
    phone: Optional[str] = None
    state_code: str
    license_number: Optional[str] = None
    license_expiry: Optional[str] = None   # ISO date string
    insurance_expiry: Optional[str] = None
    bond_expiry: Optional[str] = None
    bond_amount: Optional[float] = None
    insurance_carrier: Optional[str] = None
    notes: Optional[str] = None


class SubcontractorUpdate(SubcontractorCreate):
    name: Optional[str] = None
    company: Optional[str] = None
    state_code: Optional[str] = None


def _parse_dt(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
    except Exception:  # noqa: BLE001
        return None


def _sub_to_dict(s: SubcontractorRoster) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "company": s.company,
        "email": s.email,
        "phone": s.phone,
        "state_code": s.state_code,
        "license_number": s.license_number,
        "license_expiry": s.license_expiry.isoformat() if s.license_expiry else None,
        "insurance_expiry": s.insurance_expiry.isoformat() if s.insurance_expiry else None,
        "bond_expiry": s.bond_expiry.isoformat() if s.bond_expiry else None,
        "bond_amount": s.bond_amount,
        "insurance_carrier": s.insurance_carrier,
        "is_active": s.is_active,
        "notes": s.notes,
        "created_at": s.created_at.isoformat(),
    }


@router.get("", summary="List subcontractors")
@limiter.limit("60/minute")
async def list_subcontractors(
    request: Request,
    is_active: Optional[int] = Query(default=1),
    state_code: Optional[str] = Query(default=None, max_length=2),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    q = db.query(SubcontractorRoster)
    if is_active is not None:
        q = q.filter(SubcontractorRoster.is_active == is_active)
    if state_code:
        q = q.filter(SubcontractorRoster.state_code == state_code.upper())

    total = q.count()
    subs = q.order_by(SubcontractorRoster.name.asc()).offset(offset).limit(limit).all()
    return {
        "total": total,
        "subcontractors": [_sub_to_dict(s) for s in subs],
        "compliance_summary": get_compliance_summary(db),
    }


@router.post("", summary="Add a subcontractor")
@limiter.limit("30/minute")
async def create_subcontractor(
    request: Request,
    req: SubcontractorCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    sub = SubcontractorRoster(
        name=req.name,
        company=req.company,
        email=req.email,
        phone=req.phone,
        state_code=req.state_code.upper(),
        license_number=req.license_number,
        license_expiry=_parse_dt(req.license_expiry),
        insurance_expiry=_parse_dt(req.insurance_expiry),
        bond_expiry=_parse_dt(req.bond_expiry),
        bond_amount=req.bond_amount,
        insurance_carrier=req.insurance_carrier,
        notes=req.notes,
        is_active=1,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return {"status": "created", **_sub_to_dict(sub)}


@router.put("/{sub_id}", summary="Update a subcontractor")
@limiter.limit("30/minute")
async def update_subcontractor(
    request: Request,
    sub_id: int,
    req: SubcontractorUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    sub = db.get(SubcontractorRoster, sub_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Subcontractor not found")

    update_data = req.model_dump(exclude_none=True)
    for key, val in update_data.items():
        if key in ("license_expiry", "insurance_expiry", "bond_expiry"):
            setattr(sub, key, _parse_dt(val))
        elif key == "state_code" and val:
            sub.state_code = val.upper()
        else:
            setattr(sub, key, val)

    sub.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(sub)
    return {"status": "updated", **_sub_to_dict(sub)}


@router.delete("/{sub_id}", summary="Deactivate a subcontractor")
@limiter.limit("30/minute")
async def deactivate_subcontractor(
    request: Request,
    sub_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    sub = db.get(SubcontractorRoster, sub_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Subcontractor not found")

    sub.is_active = 0
    sub.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"status": "deactivated", "id": sub_id}


@router.get("/expiring", summary="Get subcontractors with expiring certifications")
@limiter.limit("60/minute")
async def expiring_certs(
    request: Request,
    days_ahead: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """Return subcontractors with license, insurance, or bond expiring within days_ahead."""
    expiring = get_expiring_certs(db, days_ahead=days_ahead)
    return {
        "count": len(expiring),
        "days_ahead": days_ahead,
        "expiring": expiring,
    }


# ── Performance history endpoints ─────────────────────────────────────────────

class PerformanceCreate(BaseModel):
    subcontractor_id: Optional[int] = None
    project_name: str
    scope: Optional[str] = None
    on_time: int = 1
    quality_rating: Optional[int] = None   # 1-5
    payment_dispute: int = 0
    rehire_recommended: int = 1
    notes: Optional[str] = None
    project_date: Optional[str] = None


def _perf_dict(p: SubcontractorPerformance) -> dict:
    return {
        "id": p.id,
        "subcontractor_id": p.subcontractor_id,
        "project_name": p.project_name,
        "scope": p.scope,
        "on_time": bool(p.on_time),
        "quality_rating": p.quality_rating,
        "payment_dispute": bool(p.payment_dispute),
        "rehire_recommended": bool(p.rehire_recommended),
        "notes": p.notes,
        "project_date": p.project_date.isoformat() if p.project_date else None,
        "created_at": p.created_at.isoformat(),
    }


@router.get("/{sub_id}/performance", summary="Get performance history for a subcontractor")
@limiter.limit("60/minute")
async def get_performance(
    request: Request,
    sub_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    rows = (
        db.query(SubcontractorPerformance)
        .filter(SubcontractorPerformance.subcontractor_id == sub_id)
        .order_by(SubcontractorPerformance.project_date.desc())
        .all()
    )
    total = len(rows)
    on_time_pct = round(sum(1 for r in rows if r.on_time) / total * 100, 1) if total else None
    avg_quality = (
        round(sum(r.quality_rating for r in rows if r.quality_rating) / sum(1 for r in rows if r.quality_rating), 1)
        if any(r.quality_rating for r in rows) else None
    )
    disputes = sum(1 for r in rows if r.payment_dispute)
    rehire_pct = round(sum(1 for r in rows if r.rehire_recommended) / total * 100, 1) if total else None
    return {
        "subcontractor_id": sub_id,
        "total_projects": total,
        "on_time_pct": on_time_pct,
        "avg_quality_rating": avg_quality,
        "payment_disputes": disputes,
        "rehire_pct": rehire_pct,
        "history": [_perf_dict(r) for r in rows],
    }


@router.post("/{sub_id}/performance", summary="Add a performance record for a subcontractor")
@limiter.limit("30/minute")
async def add_performance(
    request: Request,
    sub_id: int,
    req: PerformanceCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    perf = SubcontractorPerformance(
        subcontractor_id=sub_id,
        project_name=req.project_name,
        scope=req.scope,
        on_time=req.on_time,
        quality_rating=req.quality_rating,
        payment_dispute=req.payment_dispute,
        rehire_recommended=req.rehire_recommended,
        notes=req.notes,
        project_date=_parse_dt(req.project_date),
    )
    db.add(perf)
    db.commit()
    db.refresh(perf)
    return {"status": "created", **_perf_dict(perf)}


@router.delete("/performance/{perf_id}", summary="Delete a performance record")
@limiter.limit("30/minute")
async def delete_performance(
    request: Request,
    perf_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    perf = db.get(SubcontractorPerformance, perf_id)
    if not perf:
        raise HTTPException(status_code=404, detail="Performance record not found")
    db.delete(perf)
    db.commit()
    return {"status": "deleted", "id": perf_id}

