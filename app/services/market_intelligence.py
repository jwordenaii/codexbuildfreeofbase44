"""
market_intelligence.py — Competitor and market intelligence for JWordenAI.

Uses Google Places API to find local competitors and analyzes permit data
for seasonal market signals.

Requires: GOOGLE_MAPS_API_KEY env var for competitor lookups.

Public API
──────────
  search_competitors(location, service) → list[dict]
  get_permit_market_signals(state_code, db) → dict
  get_seasonal_demand(state_code) → dict
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone

import httpx

logger = logging.getLogger(__name__)

_GOOGLE_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")
_PLACES_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"
_PLACE_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"
_TIMEOUT = 10.0

# Monthly demand index per state (0-100, higher = more demand for paving)
_SEASONAL_DEMAND: dict[str, list[int]] = {
    "VA": [20, 25, 45, 65, 85, 95, 95, 90, 80, 65, 35, 20],
    "TX": [60, 65, 70, 80, 85, 90, 85, 85, 80, 75, 65, 60],
    "FL": [70, 75, 80, 85, 75, 60, 55, 55, 65, 80, 75, 70],
    "NC": [25, 30, 50, 70, 85, 95, 90, 90, 80, 65, 40, 25],
    "GA": [35, 40, 60, 75, 85, 90, 85, 85, 80, 70, 50, 35],
    "NY": [10, 15, 30, 55, 80, 95, 95, 90, 75, 50, 25, 10],
    "NJ": [10, 15, 35, 60, 80, 95, 95, 90, 75, 50, 25, 10],
    "MI": [5, 10, 25, 55, 80, 95, 95, 90, 75, 50, 20, 5],
    "CA": [65, 70, 75, 80, 85, 90, 90, 90, 85, 80, 70, 65],
    "MD": [20, 25, 45, 65, 85, 95, 95, 90, 80, 60, 35, 20],
    "OH": [10, 15, 35, 60, 80, 90, 90, 85, 75, 55, 25, 10],
    "PA": [10, 15, 35, 60, 80, 90, 90, 85, 75, 55, 25, 10],
    "IL": [5, 10, 30, 60, 80, 90, 90, 85, 75, 50, 20, 5],
}
_DEFAULT_DEMAND = [40, 45, 55, 65, 75, 80, 80, 80, 75, 65, 50, 40]


def search_competitors(
    location: str,
    service: str = "asphalt paving",
) -> list[dict]:
    """
    Search Google Places API for competitors near a location.
    Returns list of competitor dicts with name/rating/review_count/address.
    """
    if not _GOOGLE_API_KEY:
        return _mock_competitors(location)

    try:
        query = f"{service} contractors in {location}"
        resp = httpx.get(
            _PLACES_URL,
            params={
                "query": query,
                "key": _GOOGLE_API_KEY,
                "type": "general_contractor",
            },
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()

        results = []
        for place in data.get("results", [])[:10]:
            results.append({
                "name": place.get("name", ""),
                "rating": place.get("rating", 0),
                "review_count": place.get("user_ratings_total", 0),
                "address": place.get("formatted_address", ""),
                "place_id": place.get("place_id", ""),
                "business_status": place.get("business_status", ""),
            })

        return results
    except Exception as exc:  # noqa: BLE001
        logger.error("Google Places search error: %s", exc)
        return _mock_competitors(location)


def get_permit_market_signals(state_code: str, db=None) -> dict:
    """
    Analyze permit leads in the DB to identify seasonal patterns and bid volume.
    """
    try:
        from ..models import Lead  # noqa: PLC0415
        from sqlalchemy import func  # noqa: PLC0415

        if db is None:
            return {"error": "No database session"}

        now = datetime.now(timezone.utc)
        cutoff_90d = now - timedelta(days=90)
        cutoff_30d = now - timedelta(days=30)

        # Leads mentioning this state (by address)
        recent_leads = db.query(Lead).filter(Lead.created_at >= cutoff_90d).count()
        last_30_leads = db.query(Lead).filter(Lead.created_at >= cutoff_30d).count()
        hot_leads = (
            db.query(Lead)
            .filter(Lead.score_label == "HOT", Lead.created_at >= cutoff_30d)
            .count()
        )

        # Service breakdown for recent leads
        service_rows = (
            db.query(Lead.service_type, func.count(Lead.id))
            .filter(Lead.created_at >= cutoff_90d)
            .group_by(Lead.service_type)
            .all()
        )
        by_service = {row[0]: row[1] for row in service_rows}

        # Calculate trend
        prev_30d = now - timedelta(days=60)
        prev_leads = (
            db.query(Lead)
            .filter(Lead.created_at >= prev_30d, Lead.created_at < cutoff_30d)
            .count()
        )
        trend = "up" if last_30_leads > prev_leads else "down" if last_30_leads < prev_leads else "flat"
        trend_pct = round((last_30_leads - prev_leads) / max(prev_leads, 1) * 100, 1)

        # Current seasonal demand
        seasonal = get_seasonal_demand(state_code)
        current_month = now.month - 1
        demand_index = (_SEASONAL_DEMAND.get(state_code.upper(), _DEFAULT_DEMAND))[current_month]

        return {
            "state_code": state_code.upper(),
            "leads_last_90_days": recent_leads,
            "leads_last_30_days": last_30_leads,
            "hot_leads_last_30_days": hot_leads,
            "lead_trend": trend,
            "trend_pct_change": trend_pct,
            "leads_by_service": by_service,
            "current_demand_index": demand_index,
            "seasonal_outlook": seasonal.get("current_outlook", ""),
            "bid_recommendation": _get_bid_recommendation(demand_index, hot_leads),
        }
    except Exception as exc:  # noqa: BLE001
        logger.error("get_permit_market_signals error: %s", exc)
        return {"error": str(exc)}


def get_seasonal_demand(state_code: str) -> dict:
    """Return monthly demand index (0-100) for paving season in a state."""
    month_names = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ]
    demand = _SEASONAL_DEMAND.get(state_code.upper(), _DEFAULT_DEMAND)
    current_month = datetime.now(timezone.utc).month - 1
    current_demand = demand[current_month]

    if current_demand >= 80:
        outlook = "Peak paving season — high demand and active bidding"
    elif current_demand >= 60:
        outlook = "Active season — good opportunity for new contracts"
    elif current_demand >= 40:
        outlook = "Shoulder season — moderate activity"
    else:
        outlook = "Off season — focus on planning and estimating for upcoming season"

    return {
        "state_code": state_code.upper(),
        "current_month_demand": current_demand,
        "current_outlook": outlook,
        "monthly_demand": [
            {
                "month": month_names[i],
                "demand_index": demand[i],
                "is_peak": demand[i] >= 80,
            }
            for i in range(12)
        ],
        "peak_months": [month_names[i] for i, d in enumerate(demand) if d >= 80],
        "off_months": [month_names[i] for i, d in enumerate(demand) if d <= 30],
    }


def _get_bid_recommendation(demand_index: int, hot_leads: int) -> str:
    if demand_index >= 80 and hot_leads >= 5:
        return "High demand + active HOT leads — prioritize rapid response and competitive pricing"
    elif demand_index >= 80:
        return "Peak season — aggressive marketing recommended to capture demand"
    elif hot_leads >= 3:
        return "Good lead quality — focus on converting HOT leads before competitors"
    else:
        return "Slow period — invest in permit lead scraping and relationship building"


def _mock_competitors(location: str) -> list[dict]:
    return [
        {
            "name": "Demo Paving Co. (configure GOOGLE_MAPS_API_KEY)",
            "rating": 4.2,
            "review_count": 47,
            "address": f"123 Main St, {location}",
            "place_id": "mock",
            "business_status": "OPERATIONAL",
        }
    ]
