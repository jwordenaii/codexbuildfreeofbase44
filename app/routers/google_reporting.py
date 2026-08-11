"""
google_reporting.py — Unified Google Reporting endpoint for JWordenAI.

Merges data from:
  - Google Analytics 4 (session / user / conversion metrics)
  - Google Search Console (impressions, clicks, CTR, average position)
  - Google Ads (cost, clicks, conversions, CPA, ROAS)

into a single JSON payload for the Command Center dashboard.

Routes:
  GET /api/v1/google-reporting/summary   — unified KPI summary
  GET /api/v1/google-reporting/status    — credentials health check

When credentials are missing the endpoints return stub data so the frontend
dashboard still renders during development.

Environment variables (set in Railway):
  GOOGLE_ADS_DEVELOPER_TOKEN         — Google Ads API developer token
  GOOGLE_ADS_CLIENT_ID               — OAuth2 client ID
  GOOGLE_ADS_CLIENT_SECRET           — OAuth2 client secret
  GOOGLE_ADS_REFRESH_TOKEN           — OAuth2 refresh token
  GOOGLE_ADS_CUSTOMER_ID             — Ads customer/account ID (no dashes)
  GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON  — JSON key for SA auth
  GOOGLE_SEARCH_CONSOLE_SITE_URL     — e.g. sc-domain:jworden.com
  GOOGLE_ANALYTICS_PROPERTY_ID       — GA4 numeric property ID
"""

import json
import logging
import os

from ..services import runtime_config as _cfg
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..core.security import verify_premium_security

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/google-reporting", tags=["google-reporting"])

# ── Environment ────────────────────────────────────────────────────────────────

_ADS_DEV_TOKEN = os.getenv("GOOGLE_ADS_DEVELOPER_TOKEN", "")
_ADS_CLIENT_ID = os.getenv("GOOGLE_ADS_CLIENT_ID", "")
_ADS_CLIENT_SECRET = os.getenv("GOOGLE_ADS_CLIENT_SECRET", "")
_ADS_REFRESH_TOKEN = os.getenv("GOOGLE_ADS_REFRESH_TOKEN", "")
_ADS_CUSTOMER_ID = os.getenv("GOOGLE_ADS_CUSTOMER_ID", "")

# WHY THESE ARE FUNCTIONS, NOT CONSTANTS
#
# These were module-level os.getenv() calls, which failed two ways at once:
#
#  1. Wrong names. This file read GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON,
#     GOOGLE_SEARCH_CONSOLE_SITE_URL and GOOGLE_ANALYTICS_PROPERTY_ID, while
#     the rest of the codebase (18 and 15 call sites respectively) and
#     MANAGED_KEYS use GSC_SERVICE_ACCOUNT_JSON, GSC_SITE_URL and
#     GA4_PROPERTY_ID. Setting the credential the documented way left this
#     router seeing nothing, and it reported "not configured" rather than
#     erroring — so the failure was silent.
#
#  2. Read once at import. Even under the right name, a key pasted into the
#     Command Center integrations panel could not take effect without a
#     redeploy, because _GSC_READY was computed at module load.
#
# Reading through runtime_config at request time fixes both: the Postgres-
# backed store is consulted first, then os.environ. Legacy names are still
# accepted so an existing deployment that set them keeps working.

def _gsc_sa_json() -> str:
    return (_cfg.get("GSC_SERVICE_ACCOUNT_JSON")
            or _cfg.get("GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON")
            or _cfg.get("GSC_SA_JSON") or "").strip()


def _gsc_site_url() -> str:
    return (_cfg.get("GSC_SITE_URL")
            or _cfg.get("GOOGLE_SEARCH_CONSOLE_SITE_URL") or "").strip()


def _ga4_property_id() -> str:
    return (_cfg.get("GA4_PROPERTY_ID")
            or _cfg.get("GOOGLE_ANALYTICS_PROPERTY_ID") or "").strip()


def _gsc_ready() -> bool:
    return bool(_gsc_sa_json() and _gsc_site_url())


def _ga4_ready() -> bool:
    return bool(_ga4_property_id())


_ADS_READY = bool(_ADS_DEV_TOKEN and _ADS_CLIENT_ID and _ADS_REFRESH_TOKEN and _ADS_CUSTOMER_ID)


# ── Schemas ────────────────────────────────────────────────────────────────────

class AdsMetrics(BaseModel):
    cost_usd: float
    clicks: int
    impressions: int
    conversions: float
    cpa_usd: Optional[float]
    roas: Optional[float]
    source: str = "live"


class SearchConsoleMetrics(BaseModel):
    total_impressions: int
    total_clicks: int
    avg_ctr: float
    avg_position: float
    top_query: Optional[str]
    source: str = "live"


class GA4Metrics(BaseModel):
    sessions: int
    users: int
    new_users: int
    bounce_rate: float
    avg_session_duration_sec: int
    conversions: int
    source: str = "live"


class UnifiedReportSummary(BaseModel):
    date_range: str
    ads: AdsMetrics
    search_console: SearchConsoleMetrics
    analytics: GA4Metrics
    overall_roi_score: float  # 0–100 composite score


# ── Stubs (returned when credentials are not configured) ───────────────────────

def _stub_ads() -> AdsMetrics:
    return AdsMetrics(
        cost_usd=1240.50, clicks=843, impressions=14200,
        conversions=31.0, cpa_usd=40.02, roas=3.1,
        source="stub",
    )


def _stub_gsc() -> SearchConsoleMetrics:
    return SearchConsoleMetrics(
        total_impressions=52000, total_clicks=1640,
        avg_ctr=3.15, avg_position=8.4,
        top_query="asphalt paving richmond va",
        source="stub",
    )


def _stub_ga4() -> GA4Metrics:
    return GA4Metrics(
        sessions=2840, users=2100, new_users=1650,
        bounce_rate=42.1, avg_session_duration_sec=184,
        conversions=58, source="stub",
    )


# ── Live data fetchers ─────────────────────────────────────────────────────────

def _fetch_ads_metrics(days: int = 30) -> AdsMetrics:
    """Pull Ads performance for the last N days via google-ads Python client."""
    if not _ADS_READY:
        return _stub_ads()
    try:
        from google.ads.googleads.client import GoogleAdsClient  # type: ignore[import]
        config = {
            "developer_token": _ADS_DEV_TOKEN,
            "client_id": _ADS_CLIENT_ID,
            "client_secret": _ADS_CLIENT_SECRET,
            "refresh_token": _ADS_REFRESH_TOKEN,
            "login_customer_id": _ADS_CUSTOMER_ID,
            "use_proto_plus": True,
        }
        client = GoogleAdsClient.load_from_dict(config)
        ga_service = client.get_service("GoogleAdsService")
        query = f"""
            SELECT
                metrics.cost_micros,
                metrics.clicks,
                metrics.impressions,
                metrics.conversions
            FROM campaign
            WHERE segments.date DURING LAST_{days}_DAYS
        """
        response = ga_service.search(customer_id=_ADS_CUSTOMER_ID, query=query)
        cost = 0.0
        clicks = 0
        impressions = 0
        conversions = 0.0
        for row in response:
            cost += row.metrics.cost_micros / 1_000_000
            clicks += row.metrics.clicks
            impressions += row.metrics.impressions
            conversions += row.metrics.conversions
        cpa = round(cost / conversions, 2) if conversions > 0 else None
        roas = round((conversions * 250) / cost, 2) if cost > 0 else None  # assume $250 avg job value
        return AdsMetrics(cost_usd=round(cost, 2), clicks=clicks, impressions=impressions,
                          conversions=conversions, cpa_usd=cpa, roas=roas)
    except Exception as exc:
        logger.warning("Google Ads fetch failed, returning stub: %s", exc)
        return _stub_ads()


def _fetch_gsc_metrics(days: int = 30) -> SearchConsoleMetrics:
    """Pull Search Console data via Google API client."""
    if not _gsc_ready():
        return _stub_gsc()
    try:
        from google.oauth2 import service_account  # type: ignore[import]
        from googleapiclient.discovery import build  # type: ignore[import]
        sa_info = json.loads(_gsc_sa_json())
        creds = service_account.Credentials.from_service_account_info(
            sa_info, scopes=["https://www.googleapis.com/auth/webmasters.readonly"]
        )
        service = build("searchconsole", "v1", credentials=creds, cache_discovery=False)
        end = date.today()
        start = end - timedelta(days=days)
        payload = {
            "startDate": start.isoformat(),
            "endDate": end.isoformat(),
            "dimensions": ["query"],
            "rowLimit": 1,
            "orderBy": [{"fieldName": "clicks", "sortOrder": "DESCENDING"}],
        }
        response = service.searchanalytics().query(siteUrl=_gsc_site_url(), body=payload).execute()
        rows = response.get("rows", [])
        # Aggregate totals with a second call (no dimensions)
        agg_body = {
            "startDate": start.isoformat(),
            "endDate": end.isoformat(),
            "dimensions": [],
        }
        agg = service.searchanalytics().query(siteUrl=_gsc_site_url(), body=agg_body).execute()
        agg_rows = agg.get("rows", [{}])
        totals = agg_rows[0] if agg_rows else {}
        return SearchConsoleMetrics(
            total_impressions=int(totals.get("impressions", 0)),
            total_clicks=int(totals.get("clicks", 0)),
            avg_ctr=round(totals.get("ctr", 0) * 100, 2),
            avg_position=round(totals.get("position", 0), 1),
            top_query=rows[0]["keys"][0] if rows else None,
        )
    except Exception as exc:
        logger.warning("Search Console fetch failed, returning stub: %s", exc)
        return _stub_gsc()


def _fetch_ga4_metrics(days: int = 30) -> GA4Metrics:
    """Pull GA4 session/user/conversion data via Google Analytics Data API."""
    if not _ga4_ready():
        return _stub_ga4()
    try:
        from google.analytics.data_v1beta import BetaAnalyticsDataClient  # type: ignore[import]
        from google.analytics.data_v1beta.types import (  # type: ignore[import]
            DateRange, Dimension, Metric, RunReportRequest,
        )
        client = BetaAnalyticsDataClient()
        end = date.today()
        start = end - timedelta(days=days)
        req = RunReportRequest(
            property=f"properties/{_ga4_property_id()}",
            date_ranges=[DateRange(start_date=start.isoformat(), end_date=end.isoformat())],
            metrics=[
                Metric(name="sessions"),
                Metric(name="totalUsers"),
                Metric(name="newUsers"),
                Metric(name="bounceRate"),
                Metric(name="averageSessionDuration"),
                Metric(name="conversions"),
            ],
        )
        resp = client.run_report(req)
        row = resp.rows[0].metric_values if resp.rows else [None] * 6
        def _v(i: int, default=0):
            return row[i].value if row and row[i] else default
        return GA4Metrics(
            sessions=int(_v(0, "0")),
            users=int(_v(1, "0")),
            new_users=int(_v(2, "0")),
            bounce_rate=round(float(_v(3, "0")), 1),
            avg_session_duration_sec=int(float(_v(4, "0"))),
            conversions=int(float(_v(5, "0"))),
        )
    except Exception as exc:
        logger.warning("GA4 fetch failed, returning stub: %s", exc)
        return _stub_ga4()


def _compute_roi_score(ads: AdsMetrics, gsc: SearchConsoleMetrics, ga4: GA4Metrics) -> float:
    """
    Composite 0–100 ROI score.
    Weights: ROAS 40 pts, CTR 20 pts, conversion rate 20 pts, position 20 pts.
    """
    roas_score = min(40.0, (ads.roas or 0) / 5.0 * 40)
    ctr_score = min(20.0, (gsc.avg_ctr / 10.0) * 20)
    cv_rate = (ga4.conversions / ga4.sessions * 100) if ga4.sessions else 0
    cv_score = min(20.0, (cv_rate / 5.0) * 20)
    pos_score = max(0.0, (20.0 - gsc.avg_position) / 20.0 * 20) if gsc.avg_position > 0 else 0
    return round(roas_score + ctr_score + cv_score + pos_score, 1)


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/status", dependencies=[Depends(verify_premium_security)])
def reporting_status():
    """Return which Google credentials are configured."""
    return {
        "google_ads": _ADS_READY,
        "search_console": _gsc_ready(),
        "analytics_ga4": _ga4_ready(),
        "note": (
            "All sources active" if (_ADS_READY and _gsc_ready() and _ga4_ready())
            else "Unconfigured sources return stub data — see .env.example for required keys"
        ),
    }


@router.get("/summary", response_model=UnifiedReportSummary, dependencies=[Depends(verify_premium_security)])
def unified_report_summary(days: int = 30):
    """
    Unified Google KPI summary for the last N days (default 30).

    Returns live data when credentials are configured, stubs otherwise.
    The `source` field on each section is "live" or "stub" so the frontend
    can display a badge indicating data freshness.
    """
    if days < 1 or days > 365:
        raise HTTPException(status_code=422, detail="days must be between 1 and 365")

    ads = _fetch_ads_metrics(days)
    gsc = _fetch_gsc_metrics(days)
    ga4 = _fetch_ga4_metrics(days)

    end = date.today()
    start = end - timedelta(days=days)
    date_range = f"{start.isoformat()} to {end.isoformat()}"

    return UnifiedReportSummary(
        date_range=date_range,
        ads=ads,
        search_console=gsc,
        analytics=ga4,
        overall_roi_score=_compute_roi_score(ads, gsc, ga4),
    )
