"""
materials.py — Real-time asphalt material price index endpoints for JWordenAI.

Routes:
  GET /api/v1/materials/price-index — current asphalt price index (internal)

Requires premium security — internal pricing intelligence.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from ..core.limiter import limiter
from ..core.security import verify_premium_security
from ..services.material_prices import fetch_asphalt_price_index

router = APIRouter(prefix="/api/v1/materials", tags=["materials"])


@router.get("/price-index", summary="Current asphalt/petroleum price index")
@limiter.limit("30/minute")
async def asphalt_price_index(request: Request, _: dict = Depends(verify_premium_security)):
    """
    Return the current asphalt/road oil price from the EIA Weekly Petroleum Report.
    Includes baseline price, current multiplier, and pricing recommendation.
    Requires EIA_API_KEY env var; falls back gracefully if unavailable.
    """
    data = fetch_asphalt_price_index()
    return {"status": "ok", **data}
