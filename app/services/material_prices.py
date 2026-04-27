"""
material_prices.py — Real-time asphalt / petroleum price feed for JWordenAI.

Data source: EIA Weekly Petroleum Report API (https://api.eia.gov/v2/)
Requires EIA_API_KEY environment variable.

Results are cached in Redis for 24 hours (or in-process if Redis unavailable).
Falls back gracefully with multiplier=1.0 when API is unavailable.

Public API
──────────
  fetch_asphalt_price_index() → dict
  get_price_multiplier_with_materials(state_code, service_type) → dict
"""

from __future__ import annotations

import json
import logging
import os
import time
from datetime import datetime, timezone
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_EIA_API_KEY = os.getenv("EIA_API_KEY", "")
_REDIS_URL = os.getenv("REDIS_URL", "")
_CACHE_KEY = "jworden:material_price_index"
_CACHE_TTL = 60 * 60 * 24  # 24 hours

# EIA API endpoint for weekly petroleum product prices (asphalt/road oil)
_EIA_URL = "https://api.eia.gov/v2/petroleum/pri/wfr/data/"

# In-process fallback cache (when Redis unavailable)
_in_process_cache: dict = {}
_BASELINE_PRICE_PER_GALLON = 2.85  # national baseline $/gallon for road oil — EIA EPD2F series, Q4 2024 average


# ── Cache helpers ─────────────────────────────────────────────────────────────

def _get_redis():
    if not _REDIS_URL:
        return None
    try:
        import redis  # type: ignore
        client = redis.from_url(_REDIS_URL, decode_responses=True)
        client.ping()
        return client
    except Exception:  # noqa: BLE001
        return None


def _get_cached() -> Optional[dict]:
    r = _get_redis()
    if r:
        try:
            raw = r.get(_CACHE_KEY)
            return json.loads(raw) if raw else None
        except Exception:  # noqa: BLE001
            pass

    # In-process fallback
    cached = _in_process_cache.get(_CACHE_KEY)
    if cached and (time.time() - cached["ts"]) < _CACHE_TTL:
        return cached["data"]
    return None


def _set_cached(data: dict) -> None:
    r = _get_redis()
    if r:
        try:
            r.setex(_CACHE_KEY, _CACHE_TTL, json.dumps(data, default=str))
            return
        except Exception:  # noqa: BLE001
            pass

    _in_process_cache[_CACHE_KEY] = {"data": data, "ts": time.time()}


# ── EIA fetch ─────────────────────────────────────────────────────────────────

def _fallback_result(reason: str) -> dict:
    return {
        "price_per_gallon": _BASELINE_PRICE_PER_GALLON,
        "baseline_price": _BASELINE_PRICE_PER_GALLON,
        "multiplier": 1.0,
        "pct_change": 0.0,
        "as_of_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "status_message": f"Using baseline price (fallback: {reason})",
        "source": "fallback",
    }


def fetch_asphalt_price_index() -> dict:
    """
    Fetch the current asphalt/road oil price index from EIA.

    Returns dict with:
      price_per_gallon, baseline_price, multiplier, pct_change,
      as_of_date, status_message, source
    """
    cached = _get_cached()
    if cached:
        return cached

    if not _EIA_API_KEY:
        result = _fallback_result("EIA_API_KEY not configured")
        _set_cached(result)
        return result

    try:
        params = {
            "api_key": _EIA_API_KEY,
            "frequency": "weekly",
            "data[0]": "value",
            "facets[product][]": "EPD2F",  # Road oil / asphalt
            "sort[0][column]": "period",
            "sort[0][direction]": "desc",
            "length": 4,
            "offset": 0,
        }
        resp = httpx.get(_EIA_URL, params=params, timeout=10.0)
        resp.raise_for_status()
        payload = resp.json()

        records = payload.get("response", {}).get("data", [])
        if not records:
            # Try petroleum products price as proxy
            params["facets[product][]"] = "EPM0"  # Regular gasoline (proxy)
            resp2 = httpx.get(_EIA_URL, params=params, timeout=10.0)
            resp2.raise_for_status()
            records = resp2.json().get("response", {}).get("data", [])

        if not records:
            result = _fallback_result("No EIA data returned")
            _set_cached(result)
            return result

        latest = records[0]
        price = float(latest.get("value", _BASELINE_PRICE_PER_GALLON))
        as_of = latest.get("period", datetime.now(timezone.utc).strftime("%Y-%m-%d"))

        multiplier = price / _BASELINE_PRICE_PER_GALLON
        pct_change = round((multiplier - 1.0) * 100, 1)

        if pct_change > 0:
            note = f"Price is currently +{pct_change}% above baseline due to petroleum costs"
        elif pct_change < 0:
            note = f"Price is currently {pct_change}% below baseline — favorable material costs"
        else:
            note = "Material prices at baseline — standard pricing applies"

        result = {
            "price_per_gallon": round(price, 2),
            "baseline_price": _BASELINE_PRICE_PER_GALLON,
            "multiplier": round(multiplier, 4),
            "pct_change": pct_change,
            "as_of_date": as_of,
            "status_message": note,
            "source": "EIA Weekly Petroleum Report",
        }
        _set_cached(result)
        return result

    except Exception as exc:  # noqa: BLE001
        logger.error("EIA price fetch error: %s", exc)
        result = _fallback_result(str(exc))
        _set_cached(result)
        return result


def get_price_multiplier_with_materials(
    state_code: Optional[str] = None,
    service_type: Optional[str] = None,
) -> dict:
    """
    Combine state labor/market multiplier with material price adjustment.

    Returns:
      {
        state_multiplier, material_multiplier, combined_multiplier,
        material_note, state_note
      }
    """
    from .state_data import get_price_multiplier  # noqa: PLC0415

    state_mult = get_price_multiplier(state_code) if state_code else 1.0
    price_index = fetch_asphalt_price_index()
    mat_mult = price_index["multiplier"]

    # Material adjustment is more relevant for paving than sealcoating
    paving_services = {"paving", "parking_lot", "driveway", "overlay"}
    if service_type and service_type.lower() in paving_services:
        combined = state_mult * mat_mult
    else:
        # Sealcoating / crack fill: partial material sensitivity
        combined = state_mult * (1.0 + (mat_mult - 1.0) * 0.5)

    return {
        "state_multiplier": round(state_mult, 3),
        "material_multiplier": round(mat_mult, 3),
        "combined_multiplier": round(combined, 3),
        "material_note": price_index["status_message"],
        "state_note": f"State code: {state_code or 'national average'}",
        "as_of_date": price_index["as_of_date"],
    }
