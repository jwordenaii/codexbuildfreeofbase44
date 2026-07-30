"""
weather.py — Weather-aware paving scheduling endpoints for JWordenAI.

Routes:
  POST /api/v1/weather/paving-forecast   — 7-day paving suitability forecast
  GET  /api/v1/weather/risk/{state_code} — seasonal weather risk for a state

Requires premium security — used for internal scheduling decisions.
"""

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from ..core.limiter import limiter
from ..core.security import verify_premium_security
from ..services.storm_service import get_active_alerts, get_conditions, get_radar_frames
from ..services.weather_service import get_paving_forecast, get_state_seasonal_risk

router = APIRouter(prefix="/api/v1/weather", tags=["weather"])


class ForecastRequest(BaseModel):
    address: str


@router.post("/paving-forecast", summary="7-day paving suitability forecast")
@limiter.limit("30/minute")
async def paving_forecast(request: Request, req: ForecastRequest, _: dict = Depends(verify_premium_security)):
    """
    Return a 7-day weather forecast with paving suitability analysis.
    Requires OPENWEATHERMAP_API_KEY for real data; returns fallback otherwise.
    """
    forecast = get_paving_forecast(req.address)
    return {"status": "ok", **forecast}


@router.get("/risk/{state_code}", summary="Seasonal weather risk for a state")
@limiter.limit("60/minute")
async def state_weather_risk(request: Request, state_code: str, _: dict = Depends(verify_premium_security)):
    """Return seasonal weather risk and demand data for paving in the given state."""
    if len(state_code) != 2:
        return {"error": "state_code must be a 2-letter US state abbreviation"}
    return {"status": "ok", **get_state_seasonal_risk(state_code.upper())}


# ── Storm Tracker ─────────────────────────────────────────────────────────────
# Live radar/satellite animation, severe-weather alerts and point conditions.
# These power the Storm Tracker map. Each returns an explicit `status` so the
# UI can show a real "feed unavailable" state instead of inventing weather.


@router.get("/radar/frames", summary="Animatable radar + satellite frames")
@limiter.limit("60/minute")
async def radar_frames(request: Request, _: dict = Depends(verify_premium_security)):
    """
    Return the rolling RainViewer frame index used to animate the map.

    ``past`` are observed radar frames, ``nowcast`` is RainViewer's short-range
    projection, and ``satellite`` is infrared cloud cover. Each frame carries a
    tile ``url_template`` containing ``{z}/{x}/{y}``.
    """
    return get_radar_frames()


@router.get("/alerts", summary="Active NWS watches, warnings and advisories")
@limiter.limit("60/minute")
async def weather_alerts(
    request: Request,
    lat: float | None = None,
    lon: float | None = None,
    state_code: str | None = None,
    _: dict = Depends(verify_premium_security),
):
    """Active National Weather Service alerts for a point or a state, worst first."""
    return get_active_alerts(lat=lat, lon=lon, state_code=state_code)


@router.get("/conditions", summary="Current conditions + paving go/no-go verdict")
@limiter.limit("60/minute")
async def weather_conditions(
    request: Request,
    lat: float,
    lon: float,
    _: dict = Depends(verify_premium_security),
):
    """
    Current conditions and a 24h trend for a point, plus a crew-facing verdict
    scored against the Worden Standard (96% Marshall compaction floor, sealcoat
    cure temperature, overspray wind limit, rain washout window).
    """
    return get_conditions(lat, lon)
