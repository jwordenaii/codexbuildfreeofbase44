"""
Virginia permit scraper service for the JWordenAI Command Center.

Wraps HTTP polling of:
  - Virginia Permit Transparency (VPT) portal
  - Virginia DEQ PEEP (Stormwater Construction General Permits)
  - Virginia DPOR license data via the Apify scraper API

Results are normalised into lead-shaped dicts compatible with score_lead()
so inbound permit signals can flow directly into the existing lead pipeline.

Caching: a simple in-process TTL cache is used so that rapid dashboard
refreshes don't hammer external APIs.  Set TTL_SECONDS to 0 to disable.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# ── TTL cache (Redis-backed with in-process fallback) ─────────────────────────

TTL_SECONDS = int(os.getenv("PERMIT_CACHE_TTL_SECONDS", "300"))  # 5 min default

_cache: dict[str, tuple[float, Any]] = {}

# Module-level Redis singleton — created once, reused across all cache operations.
_redis_client: Any = None


def _get_redis():
    """Return a shared Redis client or None if Redis is not configured."""
    global _redis_client
    redis_url = os.getenv("REDIS_URL", "")
    if not redis_url:
        return None
    if _redis_client is not None:
        return _redis_client
    try:
        import redis  # noqa: PLC0415
        _redis_client = redis.from_url(redis_url, decode_responses=True)
        return _redis_client
    except Exception:  # noqa: BLE001
        return None


def _cache_get(key: str) -> Any | None:
    if TTL_SECONDS <= 0:
        return None
    # Try Redis first
    try:
        r = _get_redis()
        if r:
            import json  # noqa: PLC0415
            val = r.get(f"jworden:permits:{key}")
            if val:
                return json.loads(val)
    except Exception:  # noqa: BLE001
        pass
    # Fallback to in-process cache
    entry = _cache.get(key)
    if entry and (time.monotonic() - entry[0]) < TTL_SECONDS:
        return entry[1]
    return None


def _cache_set(key: str, value: Any) -> None:
    # Try Redis first
    try:
        r = _get_redis()
        if r:
            import json  # noqa: PLC0415
            r.setex(f"jworden:permits:{key}", TTL_SECONDS, json.dumps(value))
            return
    except Exception:  # noqa: BLE001
        pass
    # Fallback to in-process cache
    _cache[key] = (time.monotonic(), value)


# ── Helpers ───────────────────────────────────────────────────────────────────

_HTTP_TIMEOUT = 15.0
_MAX_RETRIES = 2


def _get(url: str, params: dict | None = None, headers: dict | None = None) -> Any:
    """Synchronous GET with retry logic."""
    for attempt in range(_MAX_RETRIES + 1):
        try:
            resp = httpx.get(
                url,
                params=params,
                headers=headers,
                timeout=_HTTP_TIMEOUT,
                follow_redirects=True,
            )
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as exc:
            logger.warning("HTTP %s from %s (attempt %d)", exc.response.status_code, url, attempt + 1)
            if attempt == _MAX_RETRIES:
                raise
        except httpx.RequestError as exc:
            logger.warning("Request error to %s: %s (attempt %d)", url, exc, attempt + 1)
            if attempt == _MAX_RETRIES:
                raise


def _post(url: str, json: dict, headers: dict | None = None) -> Any:
    """Synchronous POST with retry logic."""
    for attempt in range(_MAX_RETRIES + 1):
        try:
            resp = httpx.post(
                url,
                json=json,
                headers=headers,
                timeout=_HTTP_TIMEOUT,
                follow_redirects=True,
            )
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as exc:
            logger.warning("HTTP %s from %s (attempt %d)", exc.response.status_code, url, attempt + 1)
            if attempt == _MAX_RETRIES:
                raise
        except httpx.RequestError as exc:
            logger.warning("Request error to %s: %s (attempt %d)", url, exc, attempt + 1)
            if attempt == _MAX_RETRIES:
                raise


# ── Lead normaliser ───────────────────────────────────────────────────────────

def _normalise_permit_lead(raw: dict, source: str) -> dict:
    """
    Map a raw permit record into a dict compatible with score_lead().

    score_lead() needs:
      service_type, property_type, urgency, project_size_sqft (optional)
    Additional fields are passed through for display.
    """
    return {
        "source": source,
        "permit_id": raw.get("permitId") or raw.get("permit_number") or raw.get("id", ""),
        "address": raw.get("address") or raw.get("siteAddress") or raw.get("location", ""),
        "permit_type": raw.get("permitType") or raw.get("type", ""),
        "issued_date": raw.get("issuedDate") or raw.get("issued_date") or raw.get("dateIssued", ""),
        "applicant": raw.get("applicantName") or raw.get("applicant", ""),
        "description": raw.get("description") or raw.get("workDescription", ""),
        # Fields required by score_lead
        "service_type": "paving",        # permit leads default to paving
        "property_type": "commercial",   # most construction permits are commercial
        "urgency": "within_1_month",
        "project_size_sqft": float(raw.get("projectSizeSqft") or raw.get("area_sqft") or 0) or None,
    }


# ── VPT ───────────────────────────────────────────────────────────────────────

def fetch_vpt_permits(
    keyword: str = "paving",
    max_results: int = 50,
) -> list[dict]:
    """
    Poll Virginia Permit Transparency for permits matching *keyword*.

    The VPT portal (permits.virginia.gov) exposes a REST search endpoint.
    Returns a list of normalised lead dicts.
    """
    cache_key = f"vpt:{keyword}:{max_results}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    base_url = os.getenv("VPT_ENDPOINT", "https://permits.virginia.gov/api")
    url = f"{base_url.rstrip('/')}/permits/search"

    try:
        data = _get(url, params={"q": keyword, "limit": max_results, "status": "active"})
        permits = data if isinstance(data, list) else data.get("permits") or data.get("results") or []
        leads = [_normalise_permit_lead(p, "VPT") for p in permits]
    except Exception as exc:
        logger.error("VPT fetch failed: %s", exc)
        leads = []

    _cache_set(cache_key, leads)
    return leads


# ── DEQ PEEP ──────────────────────────────────────────────────────────────────

def fetch_deq_permits(max_results: int = 50) -> list[dict]:
    """
    Query Virginia DEQ PEEP for active Stormwater Construction General Permits.

    These are reliable precursor signals for large paving / site-work projects.
    Returns a list of normalised lead dicts.
    """
    cache_key = f"deq:{max_results}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    base_url = os.getenv("DEQ_PEEP_ENDPOINT", "https://www.deq.virginia.gov/api/peep")
    url = f"{base_url.rstrip('/')}/permits"

    try:
        data = _get(
            url,
            params={
                "permitType": "VPDES-CGP",
                "status": "active",
                "limit": max_results,
            },
        )
        permits = data if isinstance(data, list) else data.get("permits") or data.get("results") or []
        leads = [_normalise_permit_lead(p, "DEQ_PEEP") for p in permits]
    except Exception as exc:
        logger.error("DEQ PEEP fetch failed: %s", exc)
        leads = []

    _cache_set(cache_key, leads)
    return leads


# ── DPOR via Apify ────────────────────────────────────────────────────────────

def lookup_dpor_license(
    license_number: str | None = None,
    address: str | None = None,
) -> dict:
    """
    Look up a DPOR license or address via the Apify Virginia DPOR scraper.

    Requires APIFY_TOKEN environment variable.
    Returns a raw dict with license details or an error payload.
    """
    apify_token = os.getenv("APIFY_TOKEN", "")
    if not apify_token:
        return {"error": "APIFY_TOKEN not configured", "data": None}

    try:
        from apify_client import ApifyClient  # imported lazily — optional dep
    except ImportError:
        return {"error": "apify-client package not installed", "data": None}

    client = ApifyClient(apify_token)
    run_input: dict[str, Any] = {}
    if license_number:
        run_input["licenseNumber"] = license_number
    if address:
        run_input["address"] = address

    try:
        run = client.actor("haketa/virginia-dpor-license-scraper").call(run_input=run_input)
        items = list(client.dataset(run["defaultDatasetId"]).iterate_items())
        return {"error": None, "data": items}
    except Exception as exc:
        logger.error("DPOR Apify lookup failed: %s", exc)
        return {"error": str(exc), "data": None}
