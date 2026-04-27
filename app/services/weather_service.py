"""
weather_service.py — Weather-aware paving scheduling intelligence for JWordenAI.

Uses OpenWeatherMap Geocoding + One Call API for 7-day forecasts.
Requires OPENWEATHERMAP_API_KEY env var.

Paving suitability rules:
  ✅ No precipitation forecast (< 30% probability)
  ✅ High temperature >= 50°F
  ✅ Wind speed < 25 mph

Falls back gracefully if API key is absent or API is unreachable.

Public API
──────────
  get_paving_forecast(address: str) → dict
  get_weather_risk_score(address: str) → int
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# ── Paving suitability thresholds ─────────────────────────────────────────────
MAX_PRECIP_PROB_THRESHOLD = 0.30   # Rain probability above this → unsuitable
MIN_TEMP_F_THRESHOLD = 50.0        # High temp below this → unsuitable
MAX_WIND_MPH_THRESHOLD = 25.0      # Wind above this → unsuitable

_OWM_KEY = os.getenv("OPENWEATHERMAP_API_KEY", "")
_GEO_URL = "https://api.openweathermap.org/geo/1.0/direct"
_FORECAST_URL = "https://api.openweathermap.org/data/3.0/onecall"
_TIMEOUT = 10.0

# Seasonal risk scores by state (0=low risk, 10=high risk)
# Based on typical paving season windows
_STATE_SEASONAL_RISK: dict[str, list[int]] = {
    # month index 0=Jan .. 11=Dec
    "VA": [8, 7, 4, 2, 1, 1, 1, 1, 2, 3, 6, 8],
    "TX": [4, 3, 2, 1, 1, 2, 3, 3, 2, 2, 3, 4],
    "FL": [3, 2, 2, 1, 2, 4, 5, 5, 4, 2, 2, 3],
    "NC": [7, 6, 4, 2, 1, 1, 2, 2, 2, 3, 5, 7],
    "GA": [6, 5, 3, 1, 1, 2, 3, 3, 2, 2, 4, 6],
    "NY": [9, 9, 7, 4, 2, 1, 1, 1, 2, 4, 7, 9],
    "NJ": [9, 8, 6, 3, 1, 1, 1, 1, 2, 3, 6, 8],
    "MI": [10, 9, 8, 4, 2, 1, 1, 1, 2, 4, 7, 9],
    "CA": [3, 3, 2, 1, 1, 1, 1, 1, 1, 1, 2, 3],
    "IL": [9, 9, 7, 3, 1, 1, 1, 1, 2, 4, 7, 9],
}
_DEFAULT_SEASONAL = [5, 5, 4, 3, 2, 2, 2, 2, 2, 3, 4, 5]


def _kelvin_to_f(k: float) -> float:
    return round((k - 273.15) * 9 / 5 + 32, 1)


def _ms_to_mph(ms: float) -> float:
    return round(ms * 2.237, 1)


def _is_suitable(high_f: float, precip_prob: float, wind_mph: float) -> tuple[bool, str]:
    """Return (is_suitable, reason) for paving conditions."""
    if precip_prob >= MAX_PRECIP_PROB_THRESHOLD:
        return False, f"Rain probability {int(precip_prob*100)}% — asphalt won't cure properly"
    if high_f < MIN_TEMP_F_THRESHOLD:
        return False, f"High temp {high_f}°F is below {MIN_TEMP_F_THRESHOLD:.0f}°F minimum for proper compaction"
    if wind_mph >= MAX_WIND_MPH_THRESHOLD:
        return False, f"Wind {wind_mph} mph exceeds {MAX_WIND_MPH_THRESHOLD:.0f} mph safe threshold"
    return True, "Conditions suitable for paving work"


def _geocode(address: str) -> Optional[tuple[float, float]]:
    """Return (lat, lon) for the given address or None."""
    if not _OWM_KEY:
        return None
    try:
        resp = httpx.get(
            _GEO_URL,
            params={"q": address, "limit": 1, "appid": _OWM_KEY},
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
        if data:
            return data[0]["lat"], data[0]["lon"]
    except Exception as exc:  # noqa: BLE001
        logger.error("Geocoding error for %r: %s", address, exc)
    return None


def _fallback_forecast(address: str) -> dict:
    return {
        "address": address,
        "paving_windows": [],
        "next_optimal_window": None,
        "risk_score": 5,
        "recommendation": (
            "Weather data unavailable — configure OPENWEATHERMAP_API_KEY for "
            "real-time paving window forecasts."
        ),
        "source": "fallback",
    }


def get_paving_forecast(address: str) -> dict:
    """
    Return a 7-day paving suitability forecast for the given address.

    Response keys:
      paving_windows: list of daily forecasts with is_suitable flag
      next_optimal_window: date string of next suitable day
      risk_score: 0–10 overall weather risk
      recommendation: human-readable recommendation
    """
    if not _OWM_KEY:
        return _fallback_forecast(address)

    coords = _geocode(address)
    if not coords:
        return _fallback_forecast(address)

    lat, lon = coords
    try:
        resp = httpx.get(
            _FORECAST_URL,
            params={
                "lat": lat,
                "lon": lon,
                "exclude": "current,minutely,hourly,alerts",
                "appid": _OWM_KEY,
            },
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
        daily = data.get("daily", [])

        windows = []
        unsuitable_count = 0
        next_optimal: Optional[str] = None

        for day in daily[:7]:
            date_str = datetime.fromtimestamp(day["dt"], tz=timezone.utc).strftime("%Y-%m-%d")
            high_f = _kelvin_to_f(day["temp"]["max"])
            low_f = _kelvin_to_f(day["temp"]["min"])
            precip_prob = day.get("pop", 0.0)
            wind_mph = _ms_to_mph(day.get("wind_speed", 0.0))

            suitable, reason = _is_suitable(high_f, precip_prob, wind_mph)
            if not suitable:
                unsuitable_count += 1
            elif next_optimal is None:
                next_optimal = date_str

            windows.append({
                "date": date_str,
                "high_temp_f": high_f,
                "low_temp_f": low_f,
                "precip_prob": round(precip_prob * 100, 0),
                "wind_mph": wind_mph,
                "is_suitable": suitable,
                "reason": reason,
            })

        risk_score = min(10, int(unsuitable_count / 7 * 10))

        if risk_score <= 2:
            rec = "Excellent week for paving — clear skies and optimal temperatures."
        elif risk_score <= 5:
            rec = f"Moderate risk this week. Best window: {next_optimal or 'check forecast'}."
        else:
            rec = "High weather risk this week — consider scheduling 2+ weeks out."

        return {
            "address": address,
            "lat": lat,
            "lon": lon,
            "paving_windows": windows,
            "next_optimal_window": next_optimal,
            "risk_score": risk_score,
            "recommendation": rec,
            "source": "OpenWeatherMap One Call API",
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as exc:  # noqa: BLE001
        logger.error("Forecast fetch error for %r: %s", address, exc)
        return _fallback_forecast(address)


def get_weather_risk_score(address: str) -> int:
    """Return a 0–10 weather risk score for a permit lead address."""
    try:
        forecast = get_paving_forecast(address)
        return forecast.get("risk_score", 5)
    except Exception:  # noqa: BLE001
        return 5


def get_state_seasonal_risk(state_code: str) -> dict:
    """Return monthly seasonal demand/risk data for a state."""
    month_names = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ]
    risks = _STATE_SEASONAL_RISK.get(state_code.upper(), _DEFAULT_SEASONAL)
    current_month = datetime.now(timezone.utc).month - 1
    return {
        "state_code": state_code.upper(),
        "current_risk_score": risks[current_month],
        "monthly_risk": [
            {"month": month_names[i], "risk_score": risks[i], "paving_season": risks[i] <= 3}
            for i in range(12)
        ],
        "best_months": [month_names[i] for i, r in enumerate(risks) if r <= 2],
        "avoid_months": [month_names[i] for i, r in enumerate(risks) if r >= 8],
    }
