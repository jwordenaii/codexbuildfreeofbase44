"""
bid_intelligence.py — AI Bid Win-Rate Optimizer for JWordenAI.

Routes:
  GET    /api/v1/bid-intelligence/outcomes         — list proposal outcomes
  POST   /api/v1/bid-intelligence/outcomes         — record a bid outcome
  PUT    /api/v1/bid-intelligence/outcomes/{id}    — update outcome
  DELETE /api/v1/bid-intelligence/outcomes/{id}    — delete outcome
  GET    /api/v1/bid-intelligence/win-analysis     — GPT-4o win/loss pattern analysis
  GET    /api/v1/bid-intelligence/summary          — quick win-rate stats
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
from ..models import ProposalOutcome

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/bid-intelligence", tags=["bid-intelligence"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class OutcomeCreate(BaseModel):
    lead_id: int
    lead_name: Optional[str] = None
    service_type: Optional[str] = None
    region: Optional[str] = None
    proposal_amount_low: Optional[float] = None
    proposal_amount_high: Optional[float] = None
    outcome: str                              # won | lost | no-decision
    competitor_name: Optional[str] = None
    competitor_price: Optional[float] = None
    notes: Optional[str] = None


class OutcomeUpdate(OutcomeCreate):
    lead_id: Optional[int] = None
    outcome: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _out_dict(o: ProposalOutcome) -> dict:
    return {
        "id": o.id,
        "lead_id": o.lead_id,
        "lead_name": o.lead_name,
        "service_type": o.service_type,
        "region": o.region,
        "proposal_amount_low": o.proposal_amount_low,
        "proposal_amount_high": o.proposal_amount_high,
        "outcome": o.outcome,
        "competitor_name": o.competitor_name,
        "competitor_price": o.competitor_price,
        "notes": o.notes,
        "outcome_recorded_at": o.outcome_recorded_at.isoformat(),
        "created_at": o.created_at.isoformat(),
    }


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("/outcomes", summary="List proposal outcomes")
@limiter.limit("60/minute")
async def list_outcomes(
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    rows = db.query(ProposalOutcome).order_by(ProposalOutcome.outcome_recorded_at.desc()).all()
    return {"total": len(rows), "outcomes": [_out_dict(o) for o in rows]}


@router.post("/outcomes", summary="Record a bid outcome")
@limiter.limit("30/minute")
async def create_outcome(
    request: Request,
    req: OutcomeCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    if req.outcome not in ("won", "lost", "no-decision"):
        raise HTTPException(status_code=422, detail="outcome must be won | lost | no-decision")
    o = ProposalOutcome(
        lead_id=req.lead_id,
        lead_name=req.lead_name,
        service_type=req.service_type,
        region=req.region,
        proposal_amount_low=req.proposal_amount_low,
        proposal_amount_high=req.proposal_amount_high,
        outcome=req.outcome,
        competitor_name=req.competitor_name,
        competitor_price=req.competitor_price,
        notes=req.notes,
    )
    db.add(o)
    db.commit()
    db.refresh(o)
    return {"status": "created", **_out_dict(o)}


@router.put("/outcomes/{outcome_id}", summary="Update a bid outcome")
@limiter.limit("30/minute")
async def update_outcome(
    request: Request,
    outcome_id: int,
    req: OutcomeUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    o = db.get(ProposalOutcome, outcome_id)
    if not o:
        raise HTTPException(status_code=404, detail="Outcome not found")
    for key, val in req.model_dump(exclude_none=True).items():
        setattr(o, key, val)
    db.commit()
    db.refresh(o)
    return {"status": "updated", **_out_dict(o)}


@router.delete("/outcomes/{outcome_id}", summary="Delete a bid outcome")
@limiter.limit("30/minute")
async def delete_outcome(
    request: Request,
    outcome_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    o = db.get(ProposalOutcome, outcome_id)
    if not o:
        raise HTTPException(status_code=404, detail="Outcome not found")
    db.delete(o)
    db.commit()
    return {"status": "deleted", "id": outcome_id}


# ── Summary stats ─────────────────────────────────────────────────────────────

@router.get("/summary", summary="Quick win-rate statistics")
@limiter.limit("30/minute")
async def summary(
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    rows = db.query(ProposalOutcome).all()
    total = len(rows)
    won = sum(1 for r in rows if r.outcome == "won")
    lost = sum(1 for r in rows if r.outcome == "lost")
    no_decision = sum(1 for r in rows if r.outcome == "no-decision")
    win_rate = round((won / total) * 100, 1) if total > 0 else 0.0

    # By service
    by_service: dict[str, dict] = {}
    for r in rows:
        svc = r.service_type or "unknown"
        by_service.setdefault(svc, {"service": svc, "total": 0, "won": 0})
        by_service[svc]["total"] += 1
        if r.outcome == "won":
            by_service[svc]["won"] += 1

    for s in by_service.values():
        s["win_rate_pct"] = round((s["won"] / s["total"]) * 100, 1) if s["total"] > 0 else 0.0

    return {
        "total_bids": total,
        "won": won,
        "lost": lost,
        "no_decision": no_decision,
        "win_rate_pct": win_rate,
        "by_service": sorted(by_service.values(), key=lambda x: x["total"], reverse=True),
    }


# ── GPT-4o win analysis ───────────────────────────────────────────────────────

@router.get("/win-analysis", summary="GPT-4o win/loss pattern analysis")
@limiter.limit("5/minute")
async def win_analysis(
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    rows = db.query(ProposalOutcome).order_by(ProposalOutcome.outcome_recorded_at.desc()).limit(100).all()
    if len(rows) < 2:
        return {"analysis": "Not enough bid data yet. Record at least 2 bid outcomes to unlock AI analysis.", "insights": []}

    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        return _rule_based_analysis(rows)

    try:
        from openai import OpenAI  # noqa: PLC0415
        client = OpenAI(api_key=api_key)

        bid_summary = "\n".join([
            f"- {r.outcome.upper()} | {r.service_type or '?'} | {r.region or '?'} | "
            f"${r.proposal_amount_low or 0:,.0f}–${r.proposal_amount_high or 0:,.0f} | "
            f"Competitor: {r.competitor_name or 'unknown'} @ ${r.competitor_price or 0:,.0f}"
            for r in rows[:50]
        ])

        prompt = (
            "You are a bid strategy analyst for a construction company. "
            "Analyze the following bid history and return 3-5 specific, actionable insights "
            "as a JSON array of strings. Focus on: which scopes win most, pricing patterns, "
            "regional trends, and format recommendations.\n\n"
            f"Bid history:\n{bid_summary}\n\n"
            "Return ONLY a JSON array of insight strings."
        )
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=400,
            temperature=0.4,
        )
        raw = resp.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        import json  # noqa: PLC0415
        insights = json.loads(raw)
        return {"analysis": "AI-powered analysis based on your bid history.", "insights": insights}
    except Exception as exc:  # noqa: BLE001
        logger.warning("Win analysis GPT-4o failed: %s", exc)
        return _rule_based_analysis(rows)


def _rule_based_analysis(rows) -> dict:
    won = [r for r in rows if r.outcome == "won"]
    lost = [r for r in rows if r.outcome == "lost"]
    insights = []

    if rows:
        win_rate = round(len(won) / len(rows) * 100, 1)
        insights.append(f"Overall win rate: {win_rate}% across {len(rows)} tracked bids.")

    service_wins: dict[str, int] = {}
    service_totals: dict[str, int] = {}
    for r in rows:
        svc = r.service_type or "unknown"
        service_totals[svc] = service_totals.get(svc, 0) + 1
        if r.outcome == "won":
            service_wins[svc] = service_wins.get(svc, 0) + 1

    best_svc = max(
        (s for s in service_wins if service_totals.get(s, 0) > 0),
        key=lambda s: service_wins[s] / service_totals[s],
        default=None,
    )
    if best_svc:
        rate = round(service_wins[best_svc] / service_totals[best_svc] * 100, 1)
        insights.append(f"Highest win rate by service: {best_svc} at {rate}%.")

    if won:
        avg_price = sum((r.proposal_amount_low or 0) for r in won) / len(won)
        insights.append(f"Average winning bid amount: ${avg_price:,.0f} (low estimate).")

    return {"analysis": "Rule-based analysis (add OpenAI key for AI insights).", "insights": insights}
