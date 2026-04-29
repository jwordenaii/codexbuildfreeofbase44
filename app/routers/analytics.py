"""
analytics.py router — Business intelligence dashboard endpoints for JWordenAI.

Routes:
  GET /api/v1/analytics/dashboard        — full BI dashboard
  GET /api/v1/analytics/funnel           — lead conversion funnel
  GET /api/v1/analytics/revenue-forecast — revenue projection
  GET /api/v1/analytics/monthly-volume   — monthly lead trends

Requires premium security.

Caching:
  All analytics endpoints are cached in Redis.  TTLs are intentionally
  short (60 s) because the underlying data changes frequently.  The
  cache_warmer Celery task pre-populates these keys every 5 minutes so
  cold-start latency is minimised.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ..core.cache import (
    ANALYTICS_TTL,
    KEY_ANALYTICS_DASHBOARD,
    KEY_ANALYTICS_FUNNEL,
    KEY_ANALYTICS_MONTHLY,
    KEY_ANALYTICS_REVENUE,
    cache_get,
    cache_set,
)
from ..core.limiter import ANALYTICS_LIMIT, CRM_LIMIT, limiter
from ..core.security import verify_premium_security
from ..database import get_db
from ..services.analytics import (
    get_full_dashboard,
    get_lead_funnel,
    get_monthly_lead_volume,
    get_revenue_forecast,
)

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


@router.get("/dashboard", summary="Full business intelligence dashboard")
@limiter.limit(ANALYTICS_LIMIT)
async def analytics_dashboard(
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """Return all BI metrics in a single payload for the Command Center dashboard."""
    cached = cache_get(KEY_ANALYTICS_DASHBOARD)
    if cached is not None:
        return cached
    result = get_full_dashboard(db)
    cache_set(KEY_ANALYTICS_DASHBOARD, result, ANALYTICS_TTL)
    return result


@router.get("/funnel", summary="Lead conversion funnel by stage")
@limiter.limit(CRM_LIMIT)
async def lead_funnel(
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """Return lead counts by pipeline stage, score label, service, and urgency."""
    cached = cache_get(KEY_ANALYTICS_FUNNEL)
    if cached is not None:
        return cached
    result = get_lead_funnel(db)
    cache_set(KEY_ANALYTICS_FUNNEL, result, ANALYTICS_TTL)
    return result


@router.get("/revenue-forecast", summary="Revenue forecast from HOT leads")
@limiter.limit(ANALYTICS_LIMIT)
async def revenue_forecast(
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """Project revenue from HOT leads × win rate × avg job value by service type."""
    cached = cache_get(KEY_ANALYTICS_REVENUE)
    if cached is not None:
        return cached
    result = get_revenue_forecast(db)
    cache_set(KEY_ANALYTICS_REVENUE, result, ANALYTICS_TTL)
    return result


@router.get("/monthly-volume", summary="Monthly lead volume trends (12 months)")
@limiter.limit(CRM_LIMIT)
async def monthly_volume(
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """Return monthly lead counts and HOT lead breakdown for the last 12 months."""
    cached = cache_get(KEY_ANALYTICS_MONTHLY)
    if cached is not None:
        return cached
    monthly = get_monthly_lead_volume(db)
    result = {"monthly_volume": monthly}
    cache_set(KEY_ANALYTICS_MONTHLY, result, ANALYTICS_TTL)
    return result
