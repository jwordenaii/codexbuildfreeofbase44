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
# Free tier: 5 days / 3-hour steps. Used when One Call 3.0 is not subscribed.
_FREE_FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast"
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


def _geocode_candidates(address: str) -> list[str]:
    """
    Query forms to try against the OWM geocoder, best first.

    OWM returns HTTP 200 with an EMPTY LIST for "Richmond, VA" — the space
    after the comma is enough to break it — while "Richmond,VA,US" resolves.
    Since callers pass addresses the way a person types them, every lookup
    silently produced no coordinates, and the caller reported that as
    "configure OPENWEATHERMAP_API_KEY", pointing at the wrong cause entirely.

        q=Richmond, VA    -> []
        q=Richmond,VA,US  -> [{"name": "Richmond", ...}]
    """
    raw = " ".join((address or "").split()).strip().strip(",")
    if not raw:
        return []

    tight = ",".join(p.strip() for p in raw.split(",") if p.strip())
    out = [tight]

    # "City,ST" -> "City,ST,US": OWM wants an ISO country, and a bare 2-letter
    # state is ambiguous to it.
    parts = tight.split(",")
    if len(parts) == 2 and len(parts[1]) == 2 and parts[1].isalpha():
        out.insert(0, f"{tight},US")

    # Street addresses never geocode here; fall back to the last two components
    # ("1234 Main St,Chester,VA" -> "Chester,VA,US").
    if len(parts) >= 3:
        tail = ",".join(parts[-2:])
        if len(parts[-1]) == 2 and parts[-1].isalpha():
            out.append(f"{tail},US")
        out.append(tail)

    if raw not in out:
        out.append(raw)

    seen, ordered = set(), []
    for q in out:
        if q and q not in seen:
            seen.add(q)
            ordered.append(q)
    return ordered


def _geocode_google(address: str) -> Optional[tuple[float, float]]:
    """
    Geocode via Google when GOOGLE_MAPS_API_KEY is available.

    Preferred over OWM because OWM's geocoder ignores the state qualifier and
    picks the wrong city outright:

        OWM    "Chester,VA,US" -> 40.613,-80.563   (Chester, WEST VIRGINIA)
        actual  Chester, VA    -> 37.35,-77.44     (the company's home market)

    A forecast for the wrong Chester is worse than no forecast: it looks
    authoritative and would ground or dispatch a crew on another state's
    weather. Falls through to OWM on any failure, so this can only improve
    accuracy, never remove capability.
    """
    key = os.getenv("GOOGLE_MAPS_API_KEY", "")
    if not key or not (address or "").strip():
        return None
    try:
        resp = httpx.get(
            "https://maps.googleapis.com/maps/api/geocode/json",
            params={"address": address, "key": key},
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        payload = resp.json()
        results = payload.get("results") or []
        if payload.get("status") == "OK" and results:
            loc = results[0]["geometry"]["location"]
            return float(loc["lat"]), float(loc["lng"])
        logger.info("Google geocode returned %s for %r", payload.get("status"), address)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Google geocode failed for %r: %s", address, exc)
    return None


def _geocode(address: str) -> Optional[tuple[float, float]]:
    """Return (lat, lon) for the given address or None."""
    google = _geocode_google(address)
    if google:
        return google

    if not _OWM_KEY:
        return None
    for query in _geocode_candidates(address):
        try:
            resp = httpx.get(
                _GEO_URL,
                params={"q": query, "limit": 1, "appid": _OWM_KEY},
                timeout=_TIMEOUT,
            )
            resp.raise_for_status()
            data = resp.json()
            if data:
                return data[0]["lat"], data[0]["lon"]
            logger.info("Geocoder returned no match for %r — trying next form", query)
        except Exception as exc:  # noqa: BLE001
            logger.error("Geocoding error for %r: %s", query, exc)
    logger.error("Geocoding failed for %r after trying all query forms", address)
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


def _daily_from_free_forecast(lat: float, lon: float) -> list[dict]:
    """
    Build One-Call-shaped daily entries from the free /data/2.5/forecast endpoint.

    That endpoint returns 3-hour steps for ~5 days. Aggregated per calendar day
    the way a paving decision actually cares about:

      temp.max / temp.min  → the day's extremes
      pop                  → the WORST precipitation probability in the day, not
                             an average; a 70% band at 2pm rules out the day even
                             if the mean looks mild
      wind_speed           → the day's peak gust-equivalent, same reasoning

    Returned in Kelvin and m/s so the existing _kelvin_to_f / _ms_to_mph
    conversions and _is_suitable thresholds apply unchanged.
    """
    try:
        resp = httpx.get(
            _FREE_FORECAST_URL,
            params={"lat": lat, "lon": lon, "appid": _OWM_KEY},
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        rows = resp.json().get("list", []) or []
    except Exception as exc:  # noqa: BLE001
        logger.error("Free forecast fetch failed: %s", exc)
        return []

    buckets: dict[str, dict] = {}
    for row in rows:
        ts = row.get("dt")
        if ts is None:
            continue
        day_key = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")
        main = row.get("main") or {}
        temp = main.get("temp")
        if temp is None:
            continue
        b = buckets.setdefault(day_key, {
            "dt": ts, "highs": [], "lows": [], "pops": [], "winds": [], "hums": [],
        })
        b["highs"].append(main.get("temp_max", temp))
        b["lows"].append(main.get("temp_min", temp))
        b["pops"].append(float(row.get("pop", 0.0) or 0.0))
        b["winds"].append(float((row.get("wind") or {}).get("speed", 0.0) or 0.0))
        b["hums"].append(main.get("humidity", 0) or 0)

    daily = []
    for day_key in sorted(buckets):
        b = buckets[day_key]
        daily.append({
            "dt": b["dt"],
            "temp": {"max": max(b["highs"]), "min": min(b["lows"])},
            "pop": max(b["pops"]) if b["pops"] else 0.0,
            "wind_speed": max(b["winds"]) if b["winds"] else 0.0,
            "humidity": int(sum(b["hums"]) / len(b["hums"])) if b["hums"] else 0,
        })
    return daily


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
        # Request full data from OWM One Call (includes 8 days of daily, plus hourly for detailed reports)
        resp = httpx.get(
            _FORECAST_URL,
            params={
                "lat": lat,
                "lon": lon,
                "exclude": "minutely,alerts",
                "appid": _OWM_KEY,
            },
            timeout=_TIMEOUT,
        )
        # One Call 3.0 is a PAID add-on. A standard OpenWeatherMap key geocodes
        # fine (that call is free) and then 401s here:
        #
        #   {"cod":401,"message":"Please note that using One Call 3.0 requires a
        #    separate subscription to the One Call by Call plan."}
        #
        # which surfaced as "weather engine requires additional configuration"
        # even though OPENWEATHERMAP_API_KEY was present and valid. Fall back to
        # the free 5-day/3-hour endpoint and aggregate it into the same daily
        # shape, so paving decisions work on a plain key.
        if resp.status_code in (401, 403):
            logger.info(
                "One Call 3.0 unavailable on this key (%s) — using free 5-day forecast",
                resp.status_code,
            )
            daily = _daily_from_free_forecast(lat, lon)
            if not daily:
                return _fallback_forecast(address)
        else:
            resp.raise_for_status()
            data = resp.json()
            daily = data.get("daily", [])

        windows = []
        unsuitable_count = 0
        next_optimal: Optional[str] = None

        # OWM Daily provides 8 days. We process all 8.
        for day in daily:
            date_str = datetime.fromtimestamp(day["dt"], tz=timezone.utc).strftime("%Y-%m-%d")
            high_f = _kelvin_to_f(day["temp"]["max"])
            low_f = _kelvin_to_f(day["temp"]["min"])
            precip_prob = day.get("pop", 0.0)
            wind_mph = _ms_to_mph(day.get("wind_speed", 0.0))
            humidity = day.get("humidity", 0)

            # Advanced Logic: Pavingsuitability requires steady temp, not just a peak.
            suitable, reason = _is_suitable(high_f, precip_prob, wind_mph)
            
            # Additional detail for "Daily Reports" (e.g., humidity and cloud cover impact on sealcoat)
            is_sealcoat_optimal = suitable and humidity < 65

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
                "humidity": humidity,
                "is_suitable": suitable,
                "is_sealcoat_optimal": is_sealcoat_optimal,
                "reason": reason,
                "morning_suitability": high_f - 10 > MIN_TEMP_F_THRESHOLD # Estimate
            })

        # Calculate high-accuracy risk score based on the 8-day window
        risk_score = min(10, int(unsuitable_count / len(windows) * 10))

        # Generate "Daily Intelligence" summary for the next 24 hours
        current_daily_report = "Stationary high pressure system — go for full crew deployment."
        if windows[0]["precip_prob"] > 10:
             current_daily_report = "Minor moisture risk — suggest 10:00 AM start for optimal surface drying."

        return {
            "address": address,
            "lat": lat,
            "lon": lon,
            "daily_suitability_report": current_daily_report,
            "paving_windows": windows, # Now includes 8 days
            "five_day_summary": windows[:5],
            "extended_look": windows[:8],
            "next_optimal_window": next_optimal,
            "risk_score": risk_score,
            "recommendation": f"Intelligence Alert: {next_optimal or 'No window'} is your next tactical opportunity." if risk_score > 4 else "Optimal paving streak detected.",
            "source": "JWordenAI High-Resolution Telemetry",
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
