"""
weather.py — Weather-aware paving scheduling endpoints for JWordenAI.

Routes:
  POST /api/v1/weather/paving-forecast   — 7-day paving suitability forecast
  GET  /api/v1/weather/risk/{state_code} — seasonal weather risk for a state

No authentication required (public data).
"""

from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel

from ..core.limiter import limiter
from ..services.weather_service import get_paving_forecast, get_state_seasonal_risk

router = APIRouter(prefix="/api/v1/weather", tags=["weather"])


class ForecastRequest(BaseModel):
    address: str


@router.post("/paving-forecast", summary="7-day paving suitability forecast")
@limiter.limit("30/minute")
async def paving_forecast(request: Request, req: ForecastRequest):
    """
    Return a 7-day weather forecast with paving suitability analysis.
    Requires OPENWEATHERMAP_API_KEY for real data; returns fallback otherwise.
    """
    forecast = get_paving_forecast(req.address)
    return {"status": "ok", **forecast}


@router.get("/risk/{state_code}", summary="Seasonal weather risk for a state")
@limiter.limit("60/minute")
async def state_weather_risk(request: Request, state_code: str):
    """Return seasonal weather risk and demand data for paving in the given state."""
    if len(state_code) != 2:
        return {"error": "state_code must be a 2-letter US state abbreviation"}
    return {"status": "ok", **get_state_seasonal_risk(state_code.upper())}
