"""
gsc_client.py — Google Search Console API client for JWordenAI.

Credentials are supplied via the GSC_SERVICE_ACCOUNT_JSON environment variable
(base64-encoded service account JSON).  The site URL is read from
GSC_SITE_URL (e.g. "sc-domain:jwordenasphaltpaving.com" or
"https://www.jwordenasphaltpaving.com/").

Public API
──────────
  get_gsc_data(days=28)            → full summary dict
  get_top_keywords(limit=20)       → top keywords by impressions
  get_keywords_by_position(lo, hi) → keywords in a position range (easy wins)
  get_keywords_by_location(loc)    → keywords filtered by location dimension

All functions return dicts/lists — never raise; errors are returned as
{"error": "..."} so callers can surface them gracefully.
"""

from __future__ import annotations

import base64
import json
import logging
import os
from datetime import date, timedelta
from typing import Any

logger = logging.getLogger(__name__)

# ── Credential helpers ────────────────────────────────────────────────────────

_GSC_SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"]


def _load_credentials() -> Any | None:
    """
    Decode GSC_SERVICE_ACCOUNT_JSON (base64) and return a google-auth
    ServiceAccountCredentials object, or None if the env var is absent.
    """
    raw = os.getenv("GSC_SERVICE_ACCOUNT_JSON", "").strip()
    if not raw:
        return None
    try:
        from google.oauth2 import service_account  # type: ignore

        decoded = base64.b64decode(raw).decode("utf-8")
        info = json.loads(decoded)
        creds = service_account.Credentials.from_service_account_info(
            info, scopes=_GSC_SCOPES
        )
        return creds
    except Exception as exc:  # noqa: BLE001
        logger.error("GSC credential load failed: %s", exc)
        return None


def _build_service() -> Any | None:
    """Return an authenticated GSC service resource, or None."""
    creds = _load_credentials()
    if creds is None:
        return None
    try:
        from googleapiclient.discovery import build  # type: ignore

        return build("searchconsole", "v1", credentials=creds, cache_discovery=False)
    except Exception as exc:  # noqa: BLE001
        logger.error("GSC service build failed: %s", exc)
        return None


def _site_url() -> str:
    return os.getenv("GSC_SITE_URL", "").strip()


def _date_range(days: int = 28) -> tuple[str, str]:
    end = date.today() - timedelta(days=3)  # GSC data lags ~3 days
    start = end - timedelta(days=days - 1)
    return start.isoformat(), end.isoformat()


# ── Core query helper ─────────────────────────────────────────────────────────

def _run_query(
    service: Any,
    site: str,
    start_date: str,
    end_date: str,
    dimensions: list[str],
    row_limit: int = 100,
    dimension_filter_groups: list | None = None,
) -> list[dict]:
    """Execute a GSC searchAnalytics.query and return normalised rows."""
    body: dict = {
        "startDate": start_date,
        "endDate": end_date,
        "dimensions": dimensions,
        "rowLimit": row_limit,
        "dataState": "final",
    }
    if dimension_filter_groups:
        body["dimensionFilterGroups"] = dimension_filter_groups

    try:
        resp = (
            service.searchanalytics()
            .query(siteUrl=site, body=body)
            .execute()
        )
    except Exception as exc:  # noqa: BLE001
        logger.error("GSC query failed: %s", exc)
        return []

    rows = resp.get("rows", [])
    results = []
    for row in rows:
        keys = row.get("keys", [])
        entry: dict = {
            "clicks": row.get("clicks", 0),
            "impressions": row.get("impressions", 0),
            "ctr": round(row.get("ctr", 0) * 100, 2),       # as percentage
            "position": round(row.get("position", 0), 1),
        }
        for i, dim in enumerate(dimensions):
            entry[dim] = keys[i] if i < len(keys) else ""
        results.append(entry)
    return results


# ── Public API ────────────────────────────────────────────────────────────────

def get_gsc_data(days: int = 28) -> dict:
    """
    Return a full GSC summary for the configured site over the last `days` days.

    Returns {"not_configured": True} when GSC_SERVICE_ACCOUNT_JSON is absent.
    Returns {"error": "..."} on API failure.
    """
    site = _site_url()
    if not site:
        return {
            "not_configured": True,
            "message": "Set GSC_SITE_URL and GSC_SERVICE_ACCOUNT_JSON environment variables to enable Google Search Console data.",
        }

    service = _build_service()
    if service is None:
        return {
            "not_configured": True,
            "message": "Set GSC_SERVICE_ACCOUNT_JSON environment variable (base64-encoded service account JSON) to enable Google Search Console data.",
        }

    start, end = _date_range(days)

    # Top queries
    queries = _run_query(service, site, start, end, ["query"], row_limit=50)

    # Top pages
    pages = _run_query(service, site, start, end, ["page"], row_limit=25)

    # By device
    devices = _run_query(service, site, start, end, ["device"], row_limit=10)

    # By country
    countries = _run_query(service, site, start, end, ["country"], row_limit=10)

    # Aggregate totals
    total_clicks = sum(r["clicks"] for r in queries)
    total_impressions = sum(r["impressions"] for r in queries)
    avg_ctr = round(total_clicks / total_impressions * 100, 2) if total_impressions else 0
    avg_position = (
        round(sum(r["position"] for r in queries) / len(queries), 1) if queries else 0
    )

    return {
        "site_url": site,
        "date_range": {"start": start, "end": end, "days": days},
        "totals": {
            "clicks": total_clicks,
            "impressions": total_impressions,
            "avg_ctr_pct": avg_ctr,
            "avg_position": avg_position,
        },
        "top_queries": queries[:20],
        "top_pages": pages[:20],
        "by_device": devices,
        "by_country": countries,
    }


def get_top_keywords(limit: int = 20) -> list[dict]:
    """
    Return the top `limit` keywords sorted by impressions descending.
    Each entry includes query, clicks, impressions, CTR, and position.
    """
    site = _site_url()
    service = _build_service()
    if not site or service is None:
        return []

    start, end = _date_range(28)
    rows = _run_query(service, site, start, end, ["query"], row_limit=limit)
    return sorted(rows, key=lambda r: r["impressions"], reverse=True)[:limit]


def get_keywords_by_position(
    position_lo: float = 2.0,
    position_hi: float = 5.0,
    limit: int = 30,
) -> list[dict]:
    """
    Return keywords whose average position falls within [position_lo, position_hi].

    Default range 2–5 surfaces "easy win" keywords that are close to #1.
    """
    site = _site_url()
    service = _build_service()
    if not site or service is None:
        return []

    start, end = _date_range(28)
    rows = _run_query(service, site, start, end, ["query"], row_limit=200)
    filtered = [
        r for r in rows
        if position_lo <= r["position"] <= position_hi
    ]
    return sorted(filtered, key=lambda r: r["impressions"], reverse=True)[:limit]


def get_keywords_by_location(location: str, limit: int = 30) -> list[dict]:
    """
    Return keywords filtered by a country or region dimension.

    `location` should be a GSC country code (e.g. "usa") or a partial match
    against the country dimension.
    """
    site = _site_url()
    service = _build_service()
    if not site or service is None:
        return []

    start, end = _date_range(28)

    filter_groups = [
        {
            "filters": [
                {
                    "dimension": "country",
                    "operator": "equals",
                    "expression": location.lower(),
                }
            ]
        }
    ]

    rows = _run_query(
        service,
        site,
        start,
        end,
        ["query", "country"],
        row_limit=limit,
        dimension_filter_groups=filter_groups,
    )
    return sorted(rows, key=lambda r: r["impressions"], reverse=True)[:limit]
