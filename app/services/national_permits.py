"""
national_permits.py — National permit feed scrapers for JWordenAI.

Provides per-state permit scrapers for TX, FL, NC, GA, NY, NJ, MI.
All results are normalized to the same dict format used by the Virginia scraper.
Results are cached in Redis (when available) with a per-state TTL.

Public API
──────────
  fetch_texas_permits(keyword, max_results)     → list[dict]
  fetch_florida_permits(keyword, max_results)   → list[dict]
  fetch_nc_permits(keyword, max_results)        → list[dict]
  fetch_ga_permits(keyword, max_results)        → list[dict]
  fetch_nyc_permits(keyword, max_results)       → list[dict]
  fetch_nj_permits(keyword, max_results)        → list[dict]
  fetch_michigan_permits(keyword, max_results)  → list[dict]
  fetch_all_permits(states, keyword, max_results) → list[dict]
"""

from __future__ import annotations

import concurrent.futures
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

_REDIS_URL = os.getenv("REDIS_URL", "")
_CACHE_TTL = 60 * 60 * 6  # 6-hour cache per state
_DEFAULT_TIMEOUT = 15.0

# Module-level Redis singleton — created once, reused across all cache operations.
_redis_client: Any = None


# ── Redis cache ───────────────────────────────────────────────────────────────

def _get_redis():
    global _redis_client
    if not _REDIS_URL:
        return None
    if _redis_client is not None:
        return _redis_client
    try:
        import redis  # type: ignore
        _redis_client = redis.from_url(_REDIS_URL, decode_responses=True)
        _redis_client.ping()
        return _redis_client
    except Exception:  # noqa: BLE001
        return None


def _cache_get(key: str) -> Optional[list]:
    r = _get_redis()
    if not r:
        return None
    try:
        raw = r.get(key)
        return json.loads(raw) if raw else None
    except Exception:  # noqa: BLE001
        return None


def _cache_set(key: str, data: list) -> None:
    r = _get_redis()
    if not r:
        return
    try:
        r.setex(key, _CACHE_TTL, json.dumps(data, default=str))
    except Exception:  # noqa: BLE001
        pass


# ── Normalization ─────────────────────────────────────────────────────────────

def _normalise_permit_lead(
    source: str,
    state: str,
    permit_number: str,
    address: str,
    permit_type: str,
    description: str,
    issued_date: str,
    applicant: str,
    extra: Optional[dict] = None,
) -> dict:
    """Normalize a raw permit record to the standard JWordenAI permit lead format."""
    return {
        "source": source,
        "state": state,
        "permit_number": permit_number or "N/A",
        "address": address or "N/A",
        "permit_type": permit_type or "N/A",
        "description": description or "",
        "issued_date": issued_date or "",
        "applicant": applicant or "N/A",
        "contact_name": (extra or {}).get("contact_name", ""),
        "contact_phone": (extra or {}).get("contact_phone", ""),
        "contact_email": (extra or {}).get("contact_email", ""),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        **(extra or {}),
    }


# ── CKAN API helper ───────────────────────────────────────────────────────────

def _ckan_search(
    base_url: str,
    resource_id: str,
    keyword: str,
    max_results: int,
    field_map: dict,
    state: str,
    source_name: str,
) -> list[dict]:
    """Generic CKAN Datastore API search."""
    try:
        url = f"{base_url}/api/3/action/datastore_search"
        params = {
            "resource_id": resource_id,
            "q": keyword,
            "limit": max_results,
        }
        resp = httpx.get(url, params=params, timeout=_DEFAULT_TIMEOUT)
        resp.raise_for_status()
        records = resp.json().get("result", {}).get("records", [])
        leads = []
        for r in records:
            leads.append(_normalise_permit_lead(
                source=source_name,
                state=state,
                permit_number=r.get(field_map.get("permit_number", "permit_number"), ""),
                address=r.get(field_map.get("address", "address"), ""),
                permit_type=r.get(field_map.get("permit_type", "permit_type"), ""),
                description=r.get(field_map.get("description", "description"), keyword),
                issued_date=r.get(field_map.get("issued_date", "issued_date"), ""),
                applicant=r.get(field_map.get("applicant", "applicant"), ""),
            ))
        return leads
    except Exception as exc:  # noqa: BLE001
        logger.warning("%s permit fetch error: %s", source_name, exc)
        return []


# ── Per-state scrapers ────────────────────────────────────────────────────────

def fetch_texas_permits(keyword: str = "paving", max_results: int = 50) -> list[dict]:
    """Texas Open Data Portal (data.texas.gov) CKAN API."""
    cache_key = f"permits:TX:{keyword}:{max_results}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    # Texas DOT construction permits resource
    results = _ckan_search(
        base_url="https://data.texas.gov",
        resource_id="naig-ts34",  # TxDOT Roadway Construction permits
        keyword=keyword,
        max_results=max_results,
        field_map={
            "permit_number": "permit_id",
            "address": "project_location",
            "permit_type": "permit_type",
            "description": "project_description",
            "issued_date": "issue_date",
            "applicant": "applicant_name",
        },
        state="TX",
        source_name="Texas Open Data Portal",
    )

    if not results:
        results = _mock_permits("TX", keyword, max_results)

    _cache_set(cache_key, results)
    return results


def fetch_florida_permits(keyword: str = "paving", max_results: int = 50) -> list[dict]:
    """Florida DBPR Open Data."""
    cache_key = f"permits:FL:{keyword}:{max_results}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    results = _ckan_search(
        base_url="https://opendata.fdot.gov",
        resource_id="construction-permits",
        keyword=keyword,
        max_results=max_results,
        field_map={
            "permit_number": "PermitNumber",
            "address": "ProjectAddress",
            "permit_type": "PermitType",
            "description": "WorkDescription",
            "issued_date": "IssueDate",
            "applicant": "ContractorName",
        },
        state="FL",
        source_name="Florida DOT Open Data",
    )

    if not results:
        results = _mock_permits("FL", keyword, max_results)

    _cache_set(cache_key, results)
    return results


def fetch_nc_permits(keyword: str = "paving", max_results: int = 50) -> list[dict]:
    """North Carolina open data."""
    cache_key = f"permits:NC:{keyword}:{max_results}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    try:
        url = "https://data-nc.opendata.arcgis.com/api/v2/query"
        params = {
            "where": f"DESCRIPTION LIKE '%{keyword}%'",
            "outFields": "*",
            "f": "json",
            "resultRecordCount": max_results,
        }
        resp = httpx.get(url, params=params, timeout=_DEFAULT_TIMEOUT)
        resp.raise_for_status()
        features = resp.json().get("features", [])
        results = []
        for f in features:
            a = f.get("attributes", {})
            results.append(_normalise_permit_lead(
                source="NC Open Data",
                state="NC",
                permit_number=a.get("PERMIT_NO", ""),
                address=a.get("ADDRESS", ""),
                permit_type=a.get("PERMIT_TYPE", ""),
                description=a.get("DESCRIPTION", keyword),
                issued_date=a.get("ISSUE_DATE", ""),
                applicant=a.get("APPLICANT", ""),
            ))
    except Exception as exc:  # noqa: BLE001
        logger.warning("NC permit fetch error: %s", exc)
        results = _mock_permits("NC", keyword, max_results)

    _cache_set(cache_key, results)
    return results


def fetch_ga_permits(keyword: str = "paving", max_results: int = 50) -> list[dict]:
    """Georgia open data."""
    cache_key = f"permits:GA:{keyword}:{max_results}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    results = _ckan_search(
        base_url="https://data.georgia.gov",
        resource_id="ga-construction-permits",
        keyword=keyword,
        max_results=max_results,
        field_map={
            "permit_number": "PermitNumber",
            "address": "Address",
            "permit_type": "PermitType",
            "description": "Description",
            "issued_date": "IssueDate",
            "applicant": "Owner",
        },
        state="GA",
        source_name="Georgia Open Data",
    )

    if not results:
        results = _mock_permits("GA", keyword, max_results)

    _cache_set(cache_key, results)
    return results


def fetch_nyc_permits(keyword: str = "paving", max_results: int = 50) -> list[dict]:
    """NYC DOB API (data.cityofnewyork.us)."""
    cache_key = f"permits:NY:{keyword}:{max_results}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    try:
        # NYC Open Data - DOB Permit Issuance
        url = "https://data.cityofnewyork.us/resource/ipu4-2q9a.json"
        params = {
            "$q": keyword,
            "$limit": max_results,
            "$order": "issuance_date DESC",
        }
        resp = httpx.get(url, params=params, timeout=_DEFAULT_TIMEOUT)
        resp.raise_for_status()
        records = resp.json()
        results = []
        for r in records:
            addr = f"{r.get('house__', '')} {r.get('street_name', '')}, {r.get('borough', '')}, NY".strip()
            results.append(_normalise_permit_lead(
                source="NYC DOB Open Data",
                state="NY",
                permit_number=r.get("job__", ""),
                address=addr,
                permit_type=r.get("permit_type", ""),
                description=r.get("job_description", keyword),
                issued_date=r.get("issuance_date", ""),
                applicant=r.get("owner_s_first_name", "") + " " + r.get("owner_s_last_name", ""),
            ))
    except Exception as exc:  # noqa: BLE001
        logger.warning("NYC permit fetch error: %s", exc)
        results = _mock_permits("NY", keyword, max_results)

    _cache_set(cache_key, results)
    return results


def fetch_nj_permits(keyword: str = "paving", max_results: int = 50) -> list[dict]:
    """New Jersey open data."""
    cache_key = f"permits:NJ:{keyword}:{max_results}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    results = _ckan_search(
        base_url="https://data.nj.gov",
        resource_id="nj-construction-permits",
        keyword=keyword,
        max_results=max_results,
        field_map={
            "permit_number": "permit_number",
            "address": "project_address",
            "permit_type": "permit_type",
            "description": "description",
            "issued_date": "issue_date",
            "applicant": "applicant_name",
        },
        state="NJ",
        source_name="NJ Open Data",
    )

    if not results:
        results = _mock_permits("NJ", keyword, max_results)

    _cache_set(cache_key, results)
    return results


def fetch_michigan_permits(keyword: str = "paving", max_results: int = 50) -> list[dict]:
    """Michigan open data."""
    cache_key = f"permits:MI:{keyword}:{max_results}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    results = _ckan_search(
        base_url="https://data.michigan.gov",
        resource_id="mi-construction-permits",
        keyword=keyword,
        max_results=max_results,
        field_map={
            "permit_number": "PermitNumber",
            "address": "Address",
            "permit_type": "PermitType",
            "description": "Description",
            "issued_date": "IssuedDate",
            "applicant": "Applicant",
        },
        state="MI",
        source_name="Michigan Open Data",
    )

    if not results:
        results = _mock_permits("MI", keyword, max_results)

    _cache_set(cache_key, results)
    return results


def fetch_all_permits(
    states: list[str],
    keyword: str = "paving",
    max_results: int = 50,
) -> list[dict]:
    """Fetch permits from all requested states concurrently and merge results."""
    _FETCHERS = {
        "TX": fetch_texas_permits,
        "FL": fetch_florida_permits,
        "NC": fetch_nc_permits,
        "GA": fetch_ga_permits,
        "NY": fetch_nyc_permits,
        "NJ": fetch_nj_permits,
        "MI": fetch_michigan_permits,
    }

    per_state = max(1, max_results // max(len(states), 1))

    def _fetch_one(state: str) -> list[dict]:
        fetcher = _FETCHERS.get(state.upper())
        if not fetcher:
            logger.warning("No permit scraper for state: %s", state)
            return []
        return fetcher(keyword=keyword, max_results=per_state)

    all_results: list[dict] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(states)) as pool:
        futures = {pool.submit(_fetch_one, s): s for s in states}
        for future in concurrent.futures.as_completed(futures):
            try:
                all_results.extend(future.result())
            except Exception as exc:  # noqa: BLE001
                logger.error("Permit fetch failed for %s: %s", futures[future], exc)

    return all_results[:max_results]


# ── Mock fallback data ────────────────────────────────────────────────────────

def _mock_permits(state: str, keyword: str, max_results: int) -> list[dict]:
    """Return mock permit data when real API is unavailable (dev/staging)."""
    cities = {
        "TX": "Houston", "FL": "Orlando", "NC": "Charlotte",
        "GA": "Atlanta", "NY": "New York", "NJ": "Newark", "MI": "Detroit",
    }
    city = cities.get(state, state)
    results = []
    for i in range(min(3, max_results)):
        results.append(_normalise_permit_lead(
            source=f"{state} Open Data (mock)",
            state=state,
            permit_number=f"{state}-2024-{i+1001:04d}",
            address=f"{100 + i * 50} Main St, {city}, {state}",
            permit_type="Construction/Paving",
            description=f"{keyword.title()} project — commercial parking lot",
            issued_date=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            applicant="Demo Contractor LLC",
        ))
    return results
