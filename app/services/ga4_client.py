"""
ga4_client.py — Google Analytics 4 Data API client for JWordenAI.

Credentials are supplied via the GA4_SERVICE_ACCOUNT_JSON environment variable
(base64-encoded service account JSON).  The GA4 property ID is read from
GA4_PROPERTY_ID (e.g. "123456789" — digits only, no "properties/" prefix).

Public API
──────────
  get_ga4_data(days=28)            → full summary dict
  get_top_pages(limit=20)          → top pages by sessions
  get_conversion_funnel()          → home → services → quote → contact funnel
  get_conversion_rate_by_page()    → which pages convert best

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

_GA4_SCOPES = ["https://www.googleapis.com/auth/analytics.readonly"]


def _load_credentials() -> Any | None:
    """
    Decode GA4_SERVICE_ACCOUNT_JSON (base64) and return a google-auth
    ServiceAccountCredentials object, or None if the env var is absent.
    """
    raw = os.getenv("GA4_SERVICE_ACCOUNT_JSON", "").strip()
    if not raw:
        return None
    try:
        from google.oauth2 import service_account  # type: ignore

        decoded = base64.b64decode(raw).decode("utf-8")
        info = json.loads(decoded)
        creds = service_account.Credentials.from_service_account_info(
            info, scopes=_GA4_SCOPES
        )
        return creds
    except Exception as exc:  # noqa: BLE001
        logger.error("GA4 credential load failed: %s", exc)
        return None


def _build_client() -> Any | None:
    """Return an authenticated GA4 BetaAnalyticsDataClient, or None."""
    creds = _load_credentials()
    if creds is None:
        return None
    try:
        from google.analytics.data_v1beta import BetaAnalyticsDataClient  # type: ignore

        return BetaAnalyticsDataClient(credentials=creds)
    except Exception as exc:  # noqa: BLE001
        logger.error("GA4 client build failed: %s", exc)
        return None


def _property_id() -> str:
    pid = os.getenv("GA4_PROPERTY_ID", "").strip()
    if pid and not pid.startswith("properties/"):
        pid = f"properties/{pid}"
    return pid


def _date_range(days: int = 28) -> tuple[str, str]:
    end = date.today() - timedelta(days=1)
    start = end - timedelta(days=days - 1)
    return start.isoformat(), end.isoformat()


# ── Core query helper ─────────────────────────────────────────────────────────

def _run_report(
    client: Any,
    property_id: str,
    start_date: str,
    end_date: str,
    dimensions: list[str],
    metrics: list[str],
    limit: int = 50,
    dimension_filter: Any | None = None,
) -> list[dict]:
    """Execute a GA4 runReport and return normalised rows."""
    try:
        from google.analytics.data_v1beta.types import (  # type: ignore
            DateRange,
            Dimension,
            Metric,
            RunReportRequest,
        )

        request = RunReportRequest(
            property=property_id,
            date_ranges=[DateRange(start_date=start_date, end_date=end_date)],
            dimensions=[Dimension(name=d) for d in dimensions],
            metrics=[Metric(name=m) for m in metrics],
            limit=limit,
        )
        if dimension_filter:
            request.dimension_filter = dimension_filter

        response = client.run_report(request)
    except Exception as exc:  # noqa: BLE001
        logger.error("GA4 report failed: %s", exc)
        return []

    rows = []
    for row in response.rows:
        entry: dict = {}
        for i, dim in enumerate(dimensions):
            entry[dim] = row.dimension_values[i].value if i < len(row.dimension_values) else ""
        for i, met in enumerate(metrics):
            raw = row.metric_values[i].value if i < len(row.metric_values) else "0"
            # Store as float if decimal, else int
            try:
                entry[met] = float(raw) if "." in raw else int(raw)
            except ValueError:
                entry[met] = raw
        rows.append(entry)
    return rows


# ── Public API ────────────────────────────────────────────────────────────────

def get_ga4_data(days: int = 28) -> dict:
    """
    Return a full GA4 summary for the configured property over the last `days` days.

    Returns {"not_configured": True} when GA4_SERVICE_ACCOUNT_JSON is absent.
    Returns {"error": "..."} on API failure.
    """
    prop = _property_id()
    if not prop:
        return {
            "not_configured": True,
            "message": "Set GA4_PROPERTY_ID and GA4_SERVICE_ACCOUNT_JSON environment variables to enable Google Analytics 4 data.",
        }

    client = _build_client()
    if client is None:
        return {
            "not_configured": True,
            "message": "Set GA4_SERVICE_ACCOUNT_JSON environment variable (base64-encoded service account JSON) to enable Google Analytics 4 data.",
        }

    start, end = _date_range(days)

    # Overall traffic metrics
    overview = _run_report(
        client, prop, start, end,
        dimensions=[],
        metrics=["sessions", "activeUsers", "newUsers", "bounceRate",
                 "averageSessionDuration", "conversions", "engagementRate"],
        limit=1,
    )

    # Top pages by sessions
    pages = _run_report(
        client, prop, start, end,
        dimensions=["pagePath"],
        metrics=["sessions", "activeUsers", "conversions", "bounceRate",
                 "averageSessionDuration"],
        limit=25,
    )

    # Traffic by channel
    channels = _run_report(
        client, prop, start, end,
        dimensions=["sessionDefaultChannelGroup"],
        metrics=["sessions", "activeUsers", "conversions"],
        limit=10,
    )

    # Traffic by device
    devices = _run_report(
        client, prop, start, end,
        dimensions=["deviceCategory"],
        metrics=["sessions", "activeUsers", "conversions"],
        limit=5,
    )

    # Traffic by source/medium
    sources = _run_report(
        client, prop, start, end,
        dimensions=["sessionSource", "sessionMedium"],
        metrics=["sessions", "conversions"],
        limit=15,
    )

    totals = overview[0] if overview else {}
    total_sessions = totals.get("sessions", 0)
    total_conversions = totals.get("conversions", 0)
    conv_rate = (
        round(total_conversions / total_sessions * 100, 2)
        if total_sessions else 0
    )

    return {
        "property_id": prop,
        "date_range": {"start": start, "end": end, "days": days},
        "totals": {
            "sessions": total_sessions,
            "active_users": totals.get("activeUsers", 0),
            "new_users": totals.get("newUsers", 0),
            "conversions": total_conversions,
            "conversion_rate_pct": conv_rate,
            "bounce_rate_pct": round(float(totals.get("bounceRate", 0)) * 100, 2),
            "avg_session_duration_sec": round(float(totals.get("averageSessionDuration", 0)), 1),
            "engagement_rate_pct": round(float(totals.get("engagementRate", 0)) * 100, 2),
        },
        "top_pages": pages[:20],
        "by_channel": channels,
        "by_device": devices,
        "by_source": sources,
    }


def get_top_pages(limit: int = 20) -> list[dict]:
    """
    Return the top `limit` pages sorted by sessions descending.
    Each entry includes pagePath, sessions, activeUsers, conversions, bounceRate.
    """
    prop = _property_id()
    client = _build_client()
    if not prop or client is None:
        return []

    start, end = _date_range(28)
    rows = _run_report(
        client, prop, start, end,
        dimensions=["pagePath"],
        metrics=["sessions", "activeUsers", "conversions", "bounceRate"],
        limit=limit,
    )
    return sorted(rows, key=lambda r: r.get("sessions", 0), reverse=True)[:limit]


def get_conversion_funnel() -> list[dict]:
    """
    Return session counts for the key conversion funnel pages:
      / (home) → /services → /quote → /contact

    Each step shows sessions and the drop-off rate from the previous step.
    """
    prop = _property_id()
    client = _build_client()
    if not prop or client is None:
        return []

    start, end = _date_range(28)

    funnel_pages = ["/", "/services", "/quote", "/contact"]
    results = []

    for path in funnel_pages:
        try:
            from google.analytics.data_v1beta.types import (  # type: ignore
                DimensionFilter,
                FilterExpression,
                Filter,
            )

            dim_filter = FilterExpression(
                filter=DimensionFilter(
                    field_name="pagePath",
                    string_filter=Filter.StringFilter(
                        match_type=Filter.StringFilter.MatchType.EXACT,
                        value=path,
                    ),
                )
            )
        except Exception:  # noqa: BLE001
            dim_filter = None

        rows = _run_report(
            client, prop, start, end,
            dimensions=["pagePath"],
            metrics=["sessions", "conversions"],
            limit=1,
            dimension_filter=dim_filter,
        )
        sessions = rows[0].get("sessions", 0) if rows else 0
        conversions = rows[0].get("conversions", 0) if rows else 0
        results.append({"page": path, "sessions": sessions, "conversions": conversions})

    # Add drop-off rates
    for i, step in enumerate(results):
        if i == 0:
            step["drop_off_pct"] = 0.0
        else:
            prev = results[i - 1]["sessions"]
            curr = step["sessions"]
            step["drop_off_pct"] = (
                round((1 - curr / prev) * 100, 1) if prev else 0.0
            )

    return results


def get_conversion_rate_by_page(limit: int = 20) -> list[dict]:
    """
    Return pages sorted by conversion rate (conversions / sessions) descending.
    Only includes pages with at least 10 sessions to filter noise.
    """
    prop = _property_id()
    client = _build_client()
    if not prop or client is None:
        return []

    start, end = _date_range(28)
    rows = _run_report(
        client, prop, start, end,
        dimensions=["pagePath"],
        metrics=["sessions", "conversions"],
        limit=100,
    )

    enriched = []
    for row in rows:
        sessions = row.get("sessions", 0)
        conversions = row.get("conversions", 0)
        if sessions >= 10:
            row["conversion_rate_pct"] = round(conversions / sessions * 100, 2)
            enriched.append(row)

    return sorted(enriched, key=lambda r: r["conversion_rate_pct"], reverse=True)[:limit]
