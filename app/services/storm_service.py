"""
storm_service.py — Real-time radar, satellite and severe-weather feeds for the
Storm Tracker.

Data sources (deliberately chosen to need no additional paid keys):

* **RainViewer** (``api.rainviewer.com``) — public, key-less. Publishes a
  rolling index of radar frames (roughly the past two hours in ten-minute
  steps) plus short-range nowcast frames, and a parallel set of infrared
  satellite frames. Each entry is a tile-path + timestamp, which is exactly
  what an animated loop needs.
* **NWS / api.weather.gov** — public, key-less, authoritative for US watches,
  warnings and advisories. Requires a descriptive User-Agent per NWS policy.
* **OpenWeather** — used via the existing ``OPENWEATHERMAP_API_KEY`` secret for
  current conditions and the hourly trend.

Honest degradation: every function returns a payload whose ``status`` says what
actually happened. When a feed is unreachable or a key is absent the caller
gets ``status: "unavailable"`` (or ``"not_configured"``) with an empty result —
never invented weather. Fabricated conditions here would put crews on the road
in a storm, so this module never guesses.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any

import httpx

logger = logging.getLogger(__name__)

RAINVIEWER_INDEX = "https://api.rainviewer.com/public/weather-maps.json"
NWS_ALERTS = "https://api.weather.gov/alerts/active"
OWM_CURRENT = "https://api.openweathermap.org/data/2.5/weather"
OWM_FORECAST = "https://api.openweathermap.org/data/2.5/forecast"

# NWS asks API consumers to identify themselves with contact info.
NWS_UA = "JWordenAI-StormTracker (J. Worden & Sons Paving; genewgeorge@gmail.com)"

_TIMEOUT = httpx.Timeout(10.0, connect=5.0)

# Severity ranking used to sort alerts most-dangerous-first.
_SEVERITY_ORDER = {"Extreme": 0, "Severe": 1, "Moderate": 2, "Minor": 3, "Unknown": 4}


def _iso(ts: int) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


def get_radar_frames() -> dict[str, Any]:
    """
    Return animatable radar + satellite frame lists from RainViewer.

    Each frame is ``{"time": <unix>, "iso": <utc iso>, "url_template": <tile url>}``
    where the template contains ``{z}/{x}/{y}`` for the map layer to fill in.
    ``past`` frames are observed radar; ``nowcast`` frames are RainViewer's
    short-range projection and are labelled as such so the UI can visually
    distinguish forecast from observation.
    """
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            resp = client.get(RAINVIEWER_INDEX)
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:  # noqa: BLE001 — any upstream failure degrades the same way
        logger.warning("RainViewer index unavailable: %s", exc)
        return {
            "status": "unavailable",
            "detail": "Radar feed (RainViewer) could not be reached.",
            "past": [],
            "nowcast": [],
            "satellite": [],
        }

    host = data.get("host", "https://tilecache.rainviewer.com")

    def _frames(entries: list[dict] | None, colour: int, smooth: int, snow: int) -> list[dict]:
        out = []
        for f in entries or []:
            path = f.get("path")
            ts = f.get("time")
            if not path or ts is None:
                continue
            out.append(
                {
                    "time": ts,
                    "iso": _iso(ts),
                    # 256px tiles; {z}/{x}/{y} filled in by the map client.
                    "url_template": f"{host}{path}/256/{{z}}/{{x}}/{{y}}/{colour}/{smooth}_{snow}.png",
                }
            )
        return out

    radar = data.get("radar") or {}
    satellite = data.get("satellite") or {}

    return {
        "status": "ok",
        "generated": data.get("generated"),
        "attribution": "RainViewer",
        # colour scheme 2 (universal blue) reads well over dark basemaps;
        # smooth=1, snow=1 for a cleaner animated loop.
        "past": _frames(radar.get("past"), 2, 1, 1),
        "nowcast": _frames(radar.get("nowcast"), 2, 1, 1),
        # infrared satellite uses colour scheme 0 and no snow layer
        "satellite": _frames(satellite.get("infrared"), 0, 0, 0),
    }


def get_active_alerts(
    lat: float | None = None,
    lon: float | None = None,
    state_code: str | None = None,
) -> dict[str, Any]:
    """
    Return active NWS watches/warnings/advisories, most severe first.

    Query by point (``lat``/``lon``) or by two-letter ``state_code``. Geometry is
    passed through when NWS provides it so the map can draw the actual warning
    polygon rather than a marker.
    """
    params: dict[str, str] = {"status": "actual"}
    if lat is not None and lon is not None:
        params["point"] = f"{lat},{lon}"
    elif state_code:
        params["area"] = state_code.upper()
    else:
        return {
            "status": "error",
            "detail": "Provide either lat+lon or state_code.",
            "alerts": [],
        }

    try:
        with httpx.Client(timeout=_TIMEOUT, headers={"User-Agent": NWS_UA}) as client:
            resp = client.get(NWS_ALERTS, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:  # noqa: BLE001
        logger.warning("NWS alerts unavailable: %s", exc)
        return {
            "status": "unavailable",
            "detail": "Severe-weather feed (NWS) could not be reached.",
            "alerts": [],
        }

    alerts = []
    for feat in data.get("features", []):
        p = feat.get("properties", {}) or {}
        alerts.append(
            {
                "id": feat.get("id"),
                "event": p.get("event"),
                "headline": p.get("headline"),
                "description": p.get("description"),
                "instruction": p.get("instruction"),
                "severity": p.get("severity", "Unknown"),
                "urgency": p.get("urgency"),
                "certainty": p.get("certainty"),
                "areaDesc": p.get("areaDesc"),
                "onset": p.get("onset"),
                "expires": p.get("expires"),
                "senderName": p.get("senderName"),
                "geometry": feat.get("geometry"),
            }
        )

    alerts.sort(key=lambda a: _SEVERITY_ORDER.get(a.get("severity") or "Unknown", 4))
    return {
        "status": "ok",
        "attribution": "NOAA / National Weather Service",
        "count": len(alerts),
        "alerts": alerts,
    }


# ── Paving suitability ────────────────────────────────────────────────────────
# Thresholds reflect the Worden Standard rather than generic "nice weather":
# hot-mix asphalt will not reach the 96% Marshall compaction floor if the mat
# cools too fast, and sealcoat will not cure below spec temperature or in rain.
_MIN_PAVE_TEMP_F = 50.0        # surface/air floor for hot-mix placement
_MIN_SEALCOAT_TEMP_F = 55.0    # sealcoat cure floor
_MAX_SEALCOAT_WIND_MPH = 15.0  # overspray control
_RAIN_BLOCK_HOURS = 6          # wet mat / washout window after placement


def _verdict(temp_f: float | None, wind_mph: float | None, rain_soon: bool, raining: bool) -> dict[str, Any]:
    """Turn raw conditions into a crew-facing go / caution / no-go call."""
    blockers: list[str] = []
    cautions: list[str] = []

    if raining:
        blockers.append("Active precipitation — no placement on a wet surface.")
    if rain_soon:
        blockers.append(f"Rain expected within {_RAIN_BLOCK_HOURS}h — mat washout risk.")

    if temp_f is not None:
        if temp_f < _MIN_PAVE_TEMP_F:
            blockers.append(
                f"{temp_f:.0f}°F is below the {_MIN_PAVE_TEMP_F:.0f}°F floor — "
                "mat cools too fast to reach 96% Marshall compaction."
            )
        elif temp_f < _MIN_SEALCOAT_TEMP_F:
            cautions.append(
                f"{temp_f:.0f}°F — paving OK, but below the "
                f"{_MIN_SEALCOAT_TEMP_F:.0f}°F sealcoat cure floor."
            )

    if wind_mph is not None and wind_mph > _MAX_SEALCOAT_WIND_MPH:
        cautions.append(f"Wind {wind_mph:.0f} mph — overspray risk on sealcoat.")

    if blockers:
        state, label = "no_go", "NO-GO"
    elif cautions:
        state, label = "caution", "CAUTION"
    else:
        state, label = "go", "GO"

    return {"state": state, "label": label, "blockers": blockers, "cautions": cautions}


def get_conditions(lat: float, lon: float) -> dict[str, Any]:
    """
    Current conditions + 24h trend for a point, with a paving verdict.

    Returns ``status: "not_configured"`` when no OpenWeather key is present —
    the radar and NWS layers still work without it.
    """
    key = os.getenv("OPENWEATHERMAP_API_KEY") or os.getenv("OPENWEATHER_API_KEY") or ""
    if not key:
        return {
            "status": "not_configured",
            "detail": "OPENWEATHERMAP_API_KEY is not set; conditions unavailable.",
            "current": None,
            "hourly": [],
            "verdict": None,
        }

    params = {"lat": lat, "lon": lon, "appid": key, "units": "imperial"}
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            cur = client.get(OWM_CURRENT, params=params)
            cur.raise_for_status()
            cur_data = cur.json()
            fc = client.get(OWM_FORECAST, params=params)
            fc.raise_for_status()
            fc_data = fc.json()
    except Exception as exc:  # noqa: BLE001
        logger.warning("OpenWeather unavailable: %s", exc)
        return {
            "status": "unavailable",
            "detail": "Conditions feed (OpenWeather) could not be reached.",
            "current": None,
            "hourly": [],
            "verdict": None,
        }

    main = cur_data.get("main", {}) or {}
    wind = cur_data.get("wind", {}) or {}
    weather0 = (cur_data.get("weather") or [{}])[0]
    temp_f = main.get("temp")
    wind_mph = wind.get("speed")
    cur_code = str(weather0.get("id", ""))
    # OpenWeather condition ids: 2xx thunderstorm, 3xx drizzle, 5xx rain, 6xx snow
    raining = bool(cur_code[:1] in {"2", "3", "5", "6"})

    hourly = []
    rain_soon = False
    # /forecast returns 3-hour steps; the first _RAIN_BLOCK_HOURS/3 entries cover the window.
    steps_in_window = max(1, _RAIN_BLOCK_HOURS // 3)
    for idx, entry in enumerate(fc_data.get("list", [])[:16]):
        e_main = entry.get("main", {}) or {}
        e_w = (entry.get("weather") or [{}])[0]
        pop = entry.get("pop", 0) or 0
        code = str(e_w.get("id", ""))
        wet = code[:1] in {"2", "3", "5", "6"}
        if idx < steps_in_window and (wet or pop >= 0.4):
            rain_soon = True
        hourly.append(
            {
                "time": entry.get("dt"),
                "iso": _iso(entry["dt"]) if entry.get("dt") else None,
                "temp_f": e_main.get("temp"),
                "feels_like_f": e_main.get("feels_like"),
                "humidity": e_main.get("humidity"),
                "wind_mph": (entry.get("wind", {}) or {}).get("speed"),
                "pop": pop,
                "condition": e_w.get("main"),
                "description": e_w.get("description"),
                "icon": e_w.get("icon"),
            }
        )

    return {
        "status": "ok",
        "attribution": "OpenWeather",
        "location": {
            "name": cur_data.get("name"),
            "lat": lat,
            "lon": lon,
        },
        "current": {
            "temp_f": temp_f,
            "feels_like_f": main.get("feels_like"),
            "humidity": main.get("humidity"),
            "pressure": main.get("pressure"),
            "wind_mph": wind_mph,
            "wind_deg": wind.get("deg"),
            "gust_mph": wind.get("gust"),
            "visibility_m": cur_data.get("visibility"),
            "clouds": (cur_data.get("clouds", {}) or {}).get("all"),
            "condition": weather0.get("main"),
            "description": weather0.get("description"),
            "icon": weather0.get("icon"),
            "observed": _iso(cur_data["dt"]) if cur_data.get("dt") else None,
        },
        "hourly": hourly,
        "verdict": _verdict(temp_f, wind_mph, rain_soon, raining),
    }
