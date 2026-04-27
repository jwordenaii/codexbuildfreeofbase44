"""
market_intelligence.py router — Competitor and market intelligence endpoints for JWordenAI.

Routes:
  GET /api/v1/market/competitors?location=Richmond,VA — competitor lookup
  GET /api/v1/market/signals/{state_code}             — market signals
  GET /api/v1/market/seasonal/{state_code}            — seasonal demand data

Requires premium security.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from ..core.limiter import limiter
from ..core.security import verify_premium_security
from ..database import get_db
from ..services.market_intelligence import (
    search_competitors,
    get_permit_market_signals,
    get_seasonal_demand,
)

router = APIRouter(prefix="/api/v1/market", tags=["market-intelligence"])


@router.get("/competitors", summary="Search for local paving competitors")
@limiter.limit("20/minute")
async def competitors(
    request: Request,
    location: str = Query(..., max_length=200, description="City/state or ZIP code"),
    service: str = Query(default="asphalt paving", max_length=100),
    _: dict = Depends(verify_premium_security),
):
    """Find competitors near a location using Google Places API."""
    results = search_competitors(location=location, service=service)
    return {"status": "ok", "location": location, "count": len(results), "competitors": results}


@router.get("/signals/{state_code}", summary="Market signals for a state")
@limiter.limit("30/minute")
async def market_signals(
    request: Request,
    state_code: str,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """Return lead trends, bid volume signals, and demand outlook for a state."""
    signals = get_permit_market_signals(state_code=state_code.upper(), db=db)
    return {"status": "ok", **signals}


@router.get("/seasonal/{state_code}", summary="Seasonal paving demand data for a state")
@limiter.limit("60/minute")
async def seasonal_demand(
    request: Request,
    state_code: str,
    _: dict = Depends(verify_premium_security),
):
    """Return monthly paving demand index (0-100) and seasonal outlook for a state."""
    data = get_seasonal_demand(state_code=state_code.upper())
    return {"status": "ok", **data}
