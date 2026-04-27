"""
analytics.py router — Business intelligence dashboard endpoints for JWordenAI.

Routes:
  GET /api/v1/analytics/dashboard        — full BI dashboard
  GET /api/v1/analytics/funnel           — lead conversion funnel
  GET /api/v1/analytics/revenue-forecast — revenue projection
  GET /api/v1/analytics/monthly-volume   — monthly lead trends

Requires premium security.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ..core.limiter import limiter
from ..core.security import verify_premium_security
from ..database import get_db
from ..services.analytics import (
    get_full_dashboard,
    get_lead_funnel,
    get_revenue_forecast,
    get_monthly_lead_volume,
)

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


@router.get("/dashboard", summary="Full business intelligence dashboard")
@limiter.limit("30/minute")
async def analytics_dashboard(
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """Return all BI metrics in a single payload for the Command Center dashboard."""
    return get_full_dashboard(db)


@router.get("/funnel", summary="Lead conversion funnel by stage")
@limiter.limit("60/minute")
async def lead_funnel(
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """Return lead counts by pipeline stage, score label, service, and urgency."""
    return get_lead_funnel(db)


@router.get("/revenue-forecast", summary="Revenue forecast from HOT leads")
@limiter.limit("30/minute")
async def revenue_forecast(
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """Project revenue from HOT leads × win rate × avg job value by service type."""
    return get_revenue_forecast(db)


@router.get("/monthly-volume", summary="Monthly lead volume trends (12 months)")
@limiter.limit("60/minute")
async def monthly_volume(
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """Return monthly lead counts and HOT lead breakdown for the last 12 months."""
    return {"monthly_volume": get_monthly_lead_volume(db)}
