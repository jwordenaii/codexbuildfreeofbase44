"""
kpi_wall.py — Continuous Improvement KPI Wall aggregate endpoint for JWordenAI.

Routes:
  GET /api/v1/kpi-wall    — aggregate KPIs from all modules

Caching:
  Results are cached for 5 minutes (KPI_WALL_TTL).  The cache_warmer Celery
  task pre-populates this key every 5 minutes so the endpoint is always fast.
  The internal ``_compute_kpi_wall`` function is exported for use by the
  cache warmer without going through the HTTP layer.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ..core.cache import KPI_WALL_TTL, KEY_KPI_WALL, cache_get, cache_set
from ..core.limiter import ANALYTICS_LIMIT, limiter
from ..core.security import verify_premium_security
from ..database import get_db
from ..models import (
    CashFlowEntry,
    Lead,
    ProjectMetric,
    ProposalOutcome,
    SafetyIncident,
    WorkforceMember,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/kpi-wall", tags=["kpi-wall"])


def _compute_kpi_wall(db: Session) -> dict:
    """
    Compute all KPI wall metrics from the database.

    Extracted from the route handler so the cache warmer can call it
    directly without going through the HTTP layer.
    """
    now = datetime.now(timezone.utc)
    twelve_months_ago = now - timedelta(days=365)

    # ── 1. Bid-to-Win Ratio (from proposal outcomes) ──────────────────────────
    outcomes = db.query(ProposalOutcome).filter(
        ProposalOutcome.outcome_recorded_at >= twelve_months_ago
    ).all()
    total_bids = len(outcomes)
    won_bids = sum(1 for o in outcomes if o.outcome == "won")
    win_rate = round((won_bids / total_bids) * 100, 1) if total_bids > 0 else None

    # ── 2. On-time Delivery Rate (from project metrics) ──────────────────────
    metrics = db.query(ProjectMetric).filter(
        ProjectMetric.completion_date >= twelve_months_ago
    ).all()
    on_time_projects = [
        m for m in metrics
        if m.actual_days and m.scheduled_days and m.actual_days <= m.scheduled_days
    ]
    on_time_rate = (
        round(len(on_time_projects) / len(metrics) * 100, 1) if metrics else None
    )

    # ── 3. Safety TRIR (from incidents) ───────────────────────────────────────
    recordables = db.query(SafetyIncident).filter(
        SafetyIncident.osha_recordable == 1,
        SafetyIncident.incident_date >= twelve_months_ago,
    ).count()
    # Estimate hours: 200k = 100 workers × 50 wks × 40 hrs
    estimated_hours = 200_000
    trir = round((recordables * 200_000) / estimated_hours, 2)

    # ── 4. Cash Position (net of all future entries) ──────────────────────────
    future_entries = db.query(CashFlowEntry).filter(
        CashFlowEntry.expected_date >= now
    ).all()
    cash_in = sum(e.amount for e in future_entries if e.entry_type == "income")
    cash_out = sum(e.amount for e in future_entries if e.entry_type == "expense")
    projected_cash = round(cash_in - cash_out, 2)

    # ── 5. Workforce Cert Currency (workforce module) ─────────────────────────
    import json  # noqa: PLC0415
    all_members = db.query(WorkforceMember).all()
    cert_current_pct = None
    if all_members:
        total_certs = 0
        current_certs = 0
        for m in all_members:
            certs = json.loads(m.certifications) if m.certifications else []
            for cert in certs:
                total_certs += 1
                expiry_str = cert.get("expiry_date", "")
                try:
                    expiry = datetime.fromisoformat(expiry_str.replace("Z", "+00:00"))
                    if expiry.tzinfo is None:
                        expiry = expiry.replace(tzinfo=timezone.utc)
                    if expiry > now:
                        current_certs += 1
                except Exception:  # noqa: BLE001
                    current_certs += 1
        cert_current_pct = round((current_certs / total_certs) * 100, 1) if total_certs > 0 else None

    # ── 6. Client NPS (from project metrics) ─────────────────────────────────
    nps_vals = [m.client_nps for m in metrics if m.client_nps is not None]
    avg_nps = round(sum(nps_vals) / len(nps_vals), 1) if nps_vals else None

    # ── Monthly trend data (last 12 months) ──────────────────────────────────
    leads_12m = db.query(Lead).filter(Lead.created_at >= twelve_months_ago).all()
    monthly_leads: dict[str, int] = {}
    for lead in leads_12m:
        key = lead.created_at.strftime("%Y-%m")
        monthly_leads[key] = monthly_leads.get(key, 0) + 1

    return {
        "generated_at": now.isoformat(),
        "kpis": {
            "bid_win_rate": {
                "label": "Bid Win Rate",
                "value": win_rate,
                "unit": "%",
                "target": 40.0,
                "total_bids": total_bids,
                "total_won": won_bids,
                "status": _status(win_rate, 40.0, higher_is_better=True),
            },
            "on_time_delivery": {
                "label": "On-Time Delivery",
                "value": on_time_rate,
                "unit": "%",
                "target": 90.0,
                "total_projects": len(metrics),
                "on_time_projects": len(on_time_projects),
                "status": _status(on_time_rate, 90.0, higher_is_better=True),
            },
            "safety_trir": {
                "label": "Safety TRIR",
                "value": trir,
                "unit": "per 100 workers",
                "target": 3.4,
                "recordable_incidents": recordables,
                "status": _status(trir, 3.4, higher_is_better=False),
            },
            "projected_cash": {
                "label": "13-Week Cash Projection",
                "value": projected_cash,
                "unit": "$",
                "target": 10000.0,
                "status": _status(projected_cash, 10000.0, higher_is_better=True),
            },
            "cert_current_pct": {
                "label": "Cert Currency",
                "value": cert_current_pct,
                "unit": "%",
                "target": 95.0,
                "total_members": len(all_members),
                "status": _status(cert_current_pct, 95.0, higher_is_better=True),
            },
            "client_nps": {
                "label": "Avg Client NPS",
                "value": avg_nps,
                "unit": "/10",
                "target": 8.0,
                "total_projects": len(nps_vals),
                "status": _status(avg_nps, 8.0, higher_is_better=True),
            },
        },
        "monthly_lead_trend": [
            {"month": k, "count": v}
            for k, v in sorted(monthly_leads.items())
        ],
    }


@router.get("", summary="Aggregate KPI wall data")
@limiter.limit(ANALYTICS_LIMIT)
async def kpi_wall(
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """
    Pull live KPIs from all modules and return a single dashboard payload.
    Each KPI includes current value, trend direction, and rolling 12-month data.
    Results are cached for 5 minutes to avoid repeated expensive aggregations.
    """
    cached = cache_get(KEY_KPI_WALL)
    if cached is not None:
        return cached
    result = _compute_kpi_wall(db)
    cache_set(KEY_KPI_WALL, result, KPI_WALL_TTL)
    return result


def _status(value, target: float, higher_is_better: bool) -> str:
    """Return 'green', 'yellow', or 'red' based on value vs target."""
    if value is None:
        return "gray"
    if higher_is_better:
        if value >= target:
            return "green"
        if value >= target * 0.8:
            return "yellow"
        return "red"
    else:
        if value <= target:
            return "green"
        if value <= target * 1.2:
            return "yellow"
        return "red"
