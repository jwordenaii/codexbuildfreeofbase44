"""
local_places_service.py — real-world local lookups for crews on the road.

Answers the questions that actually come up when a crew is working away from
home: where do we sleep tonight in Vinton, where do we eat, where is the nearest
open parts supplier. Backed by Google Places, using the GOOGLE_MAPS_API_KEY /
GOOGLE_API_KEY secret already deployed on the app.

Honest degradation: when no key is configured or Google is unreachable, this
returns ``status: "not_configured"`` / ``"unavailable"`` with an empty list.
A crew booking a hotel that does not exist is worse than an assistant admitting
it cannot look it up, so nothing here is ever invented.
"""

from __future__ import annotations

import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)

TEXT_SEARCH = "https://maps.googleapis.com/maps/api/place/textsearch/json"
DETAILS = "https://maps.googleapis.com/maps/api/place/details/json"

_TIMEOUT = httpx.Timeout(10.0, connect=5.0)

# Keep responses small enough to sit comfortably in a tool result.
_MAX_RESULTS = 6

_PRICE = {0: "Free", 1: "$", 2: "$$", 3: "$$$", 4: "$$$$"}


def _key() -> str:
    return (
        os.getenv("GOOGLE_MAPS_API_KEY")
        or os.getenv("GOOGLE_API_KEY")
        or ""
    ).strip()


def find_places(
    query: str,
    location: str | None = None,
    open_now: bool = False,
    min_rating: float = 0.0,
) -> dict[str, Any]:
    """
    Search for real places — hotels, restaurants, suppliers — near a location.

    ``query`` is what you're looking for ("hotel", "steakhouse", "asphalt
    supplier"); ``location`` is the town ("Vinton, VA"). Results come back
    sorted best-first by Google's rating, with the practical fields a crew
    needs: address, phone, rating, price level and whether it's open now.
    """
    key = _key()
    if not key:
        return {
            "status": "not_configured",
            "detail": "GOOGLE_MAPS_API_KEY is not set; local place lookup unavailable.",
            "results": [],
        }

    text = f"{query} in {location}" if location else query
    params: dict[str, Any] = {"query": text, "key": key}
    if open_now:
        params["opennow"] = "true"

    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            resp = client.get(TEXT_SEARCH, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Google Places unavailable: %s", exc)
        return {
            "status": "unavailable",
            "detail": f"Place lookup failed: {type(exc).__name__}",
            "results": [],
        }

    api_status = data.get("status")
    if api_status not in {"OK", "ZERO_RESULTS"}:
        # REQUEST_DENIED / OVER_QUERY_LIMIT etc. — surface it rather than
        # returning an empty list that looks like "nothing nearby".
        return {
            "status": "unavailable",
            "detail": f"Google Places returned {api_status}: {data.get('error_message', '')}".strip(),
            "results": [],
        }

    out = []
    for r in data.get("results", []):
        rating = r.get("rating")
        if min_rating and (rating or 0) < min_rating:
            continue
        out.append(
            {
                "name": r.get("name"),
                "address": r.get("formatted_address"),
                "rating": rating,
                "reviews": r.get("user_ratings_total"),
                "price": _PRICE.get(r.get("price_level")) if r.get("price_level") is not None else None,
                "open_now": (r.get("opening_hours") or {}).get("open_now"),
                "place_id": r.get("place_id"),
                "types": (r.get("types") or [])[:4],
                "maps_url": (
                    f"https://www.google.com/maps/place/?q=place_id:{r.get('place_id')}"
                    if r.get("place_id")
                    else None
                ),
            }
        )

    # Best first: rating, then review volume so a lone 5-star doesn't beat a
    # well-reviewed 4.6.
    out.sort(key=lambda p: ((p["rating"] or 0), (p["reviews"] or 0)), reverse=True)

    return {
        "status": "ok",
        "attribution": "Google Places",
        "query": text,
        "count": len(out[:_MAX_RESULTS]),
        "results": out[:_MAX_RESULTS],
    }


def place_details(place_id: str) -> dict[str, Any]:
    """Phone, hours and website for one place — used when the crew picks one."""
    key = _key()
    if not key:
        return {"status": "not_configured", "detail": "GOOGLE_MAPS_API_KEY is not set.", "place": None}

    fields = "name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,opening_hours,price_level"
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            resp = client.get(DETAILS, params={"place_id": place_id, "fields": fields, "key": key})
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Google Place details unavailable: %s", exc)
        return {"status": "unavailable", "detail": f"{type(exc).__name__}", "place": None}

    if data.get("status") != "OK":
        return {"status": "unavailable", "detail": data.get("status"), "place": None}

    r = data.get("result", {}) or {}
    return {
        "status": "ok",
        "attribution": "Google Places",
        "place": {
            "name": r.get("name"),
            "address": r.get("formatted_address"),
            "phone": r.get("formatted_phone_number"),
            "website": r.get("website"),
            "rating": r.get("rating"),
            "reviews": r.get("user_ratings_total"),
            "price": _PRICE.get(r.get("price_level")) if r.get("price_level") is not None else None,
            "open_now": (r.get("opening_hours") or {}).get("open_now"),
            "hours": (r.get("opening_hours") or {}).get("weekday_text"),
        },
    }
