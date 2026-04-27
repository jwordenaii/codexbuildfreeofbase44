"""
cashflow.py — 13-Week Cash Flow Projection router for JWordenAI.

Routes:
  GET    /api/v1/cashflow/entries           — list cash flow entries
  POST   /api/v1/cashflow/entries           — create cash flow entry
  DELETE /api/v1/cashflow/entries/{id}      — delete entry
  GET    /api/v1/cashflow/forecast          — 13-week rolling forecast
  GET    /api/v1/cashflow/alert             — get alert threshold config
  POST   /api/v1/cashflow/alert             — upsert alert threshold config
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.limiter import limiter
from ..core.security import verify_premium_security
from ..database import get_db
from ..models import CashFlowAlert, CashFlowEntry

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/cashflow", tags=["cashflow"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class EntryCreate(BaseModel):
    entry_type: str         # income | expense
    amount: float
    expected_date: str      # ISO datetime/date string
    category: Optional[str] = None
    description: Optional[str] = None
    source: Optional[str] = "manual"
    source_id: Optional[int] = None


class AlertUpsert(BaseModel):
    threshold_amount: float = 10000.0
    alert_email: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_dt(s: str) -> datetime:
    dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def _entry_dict(e: CashFlowEntry) -> dict:
    return {
        "id": e.id,
        "entry_type": e.entry_type,
        "amount": e.amount,
        "expected_date": e.expected_date.isoformat(),
        "category": e.category,
        "description": e.description,
        "source": e.source,
        "source_id": e.source_id,
        "created_at": e.created_at.isoformat(),
    }


# ── Entry endpoints ───────────────────────────────────────────────────────────

@router.get("/entries", summary="List cash flow entries")
@limiter.limit("60/minute")
async def list_entries(
    request: Request,
    entry_type: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    q = db.query(CashFlowEntry)
    if entry_type:
        q = q.filter(CashFlowEntry.entry_type == entry_type)
    total = q.count()
    rows = q.order_by(CashFlowEntry.expected_date.asc()).offset(offset).limit(limit).all()
    return {"total": total, "entries": [_entry_dict(e) for e in rows]}


@router.post("/entries", summary="Add a cash flow entry")
@limiter.limit("60/minute")
async def create_entry(
    request: Request,
    req: EntryCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    if req.entry_type not in ("income", "expense"):
        raise HTTPException(status_code=422, detail="entry_type must be 'income' or 'expense'")
    entry = CashFlowEntry(
        entry_type=req.entry_type,
        amount=req.amount,
        expected_date=_parse_dt(req.expected_date),
        category=req.category,
        description=req.description,
        source=req.source,
        source_id=req.source_id,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return {"status": "created", **_entry_dict(entry)}


@router.delete("/entries/{entry_id}", summary="Delete a cash flow entry")
@limiter.limit("30/minute")
async def delete_entry(
    request: Request,
    entry_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    entry = db.get(CashFlowEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(entry)
    db.commit()
    return {"status": "deleted", "id": entry_id}


# ── 13-week rolling forecast ──────────────────────────────────────────────────

@router.get("/forecast", summary="13-week rolling cash flow forecast")
@limiter.limit("30/minute")
async def forecast(
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """
    Bucket all future entries into 13 weekly buckets from today.
    Returns weekly net + running cumulative balance.
    """
    now = datetime.now(timezone.utc)
    # Start of current week (Monday)
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)

    weeks = []
    for i in range(13):
        ws = week_start + timedelta(weeks=i)
        we = ws + timedelta(weeks=1)
        weeks.append({"label": f"{ws.month}/{ws.day}", "start": ws, "end": we, "income": 0.0, "expense": 0.0})

    entries = db.query(CashFlowEntry).all()
    for e in entries:
        edate = e.expected_date
        if edate.tzinfo is None:
            edate = edate.replace(tzinfo=timezone.utc)
        for w in weeks:
            if w["start"] <= edate < w["end"]:
                if e.entry_type == "income":
                    w["income"] += e.amount
                else:
                    w["expense"] += e.amount
                break

    # Build running balance
    cumulative = 0.0
    for w in weeks:
        net = w["income"] - w["expense"]
        cumulative += net
        w["net"] = round(net, 2)
        w["cumulative"] = round(cumulative, 2)

    # Get alert threshold
    alert_row = db.query(CashFlowAlert).filter(CashFlowAlert.is_active == 1).first()
    threshold = alert_row.threshold_amount if alert_row else 10_000.0

    # Clean output (remove start/end datetime objects)
    output_weeks = [
        {k: v for k, v in w.items() if k not in ("start", "end")}
        for w in weeks
    ]

    min_balance = min((w["cumulative"] for w in weeks), default=0.0)
    return {
        "weeks": output_weeks,
        "threshold": threshold,
        "min_projected_balance": round(min_balance, 2),
        "alert_triggered": min_balance < threshold,
    }


# ── Alert threshold endpoints ─────────────────────────────────────────────────

@router.get("/alert", summary="Get cash flow alert threshold")
@limiter.limit("30/minute")
async def get_alert(
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    row = db.query(CashFlowAlert).filter(CashFlowAlert.is_active == 1).first()
    if not row:
        return {"threshold_amount": 10000.0, "alert_email": None, "configured": False}
    return {
        "id": row.id,
        "threshold_amount": row.threshold_amount,
        "alert_email": row.alert_email,
        "configured": True,
    }


@router.post("/alert", summary="Set cash flow alert threshold")
@limiter.limit("10/minute")
async def set_alert(
    request: Request,
    req: AlertUpsert,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    row = db.query(CashFlowAlert).filter(CashFlowAlert.is_active == 1).first()
    if row:
        row.threshold_amount = req.threshold_amount
        row.alert_email = req.alert_email
        row.updated_at = datetime.now(timezone.utc)
    else:
        row = CashFlowAlert(threshold_amount=req.threshold_amount, alert_email=req.alert_email)
        db.add(row)
    db.commit()
    db.refresh(row)
    return {"status": "saved", "threshold_amount": row.threshold_amount, "alert_email": row.alert_email}
