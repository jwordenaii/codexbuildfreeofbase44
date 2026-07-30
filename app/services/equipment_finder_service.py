"""
equipment_finder_service.py — sourcing used iron off the open market.

"Find me a used tri-axle dump truck" is a real, recurring purchasing question,
and a plain web search answers it badly: the top results are dealer SEO pages
and rental ads rather than actual listings for sale.

So this targets the marketplaces where construction equipment is genuinely
listed, runs the search against them, and scores results by how much they look
like a real listing (a price, a year, a marketplace domain) rather than an
article about buying one.

It reuses the existing Tavily-backed web_search service — no new credential.
Results are links to live listings; nothing about price or condition is
asserted by us, because we cannot verify a third-party listing.
"""

from __future__ import annotations

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

# Where used construction equipment is actually listed for sale. Ordered by how
# reliably they carry commercial truck/heavy-equipment inventory.
_MARKETPLACES = [
    "machinerytrader.com",
    "truckpaper.com",
    "ironplanet.com",
    "rbauction.com",
    "equipmenttrader.com",
    "commercialtrucktrader.com",
    "govdeals.com",  # municipal surplus — often where the real bargains are
    "purplewave.com",
    "ebay.com",
]

# Signals that a result is a listing rather than a guide/blog/dealer landing page.
_PRICE = re.compile(r"\$\s?\d{1,3}(?:,\d{3})+|\$\s?\d{4,}")
_YEAR = re.compile(r"\b(19[89]\d|20[0-4]\d)\b")
_JUNK = re.compile(r"(how to|guide|blog|news|rental|rent |financing|insurance)", re.I)


def _score(item: dict[str, Any]) -> int:
    """Rank real listings above articles about buying equipment."""
    url = (item.get("url") or "").lower()
    text = f"{item.get('title', '')} {item.get('content', '')}"
    score = 0
    for i, dom in enumerate(_MARKETPLACES):
        if dom in url:
            score += 40 - i  # earlier marketplaces weighted slightly higher
            break
    if _PRICE.search(text):
        score += 25
    if _YEAR.search(item.get("title", "")):
        score += 12
    if _JUNK.search(item.get("title", "")):
        score -= 20
    if "for-sale" in url or "listing" in url or "/equipment/" in url:
        score += 8
    return score


async def find_equipment(
    item: str,
    location: str | None = None,
    max_price: int | None = None,
    year_min: int | None = None,
) -> dict[str, Any]:
    """
    Search the used-equipment marketplaces for a machine.

    ``item`` is the machine ("tri-axle dump truck", "skid steer", "asphalt
    roller"). ``location`` narrows to a region. ``max_price``/``year_min`` are
    passed into the query as buyer intent — they filter the search, they are not
    a guarantee about any individual listing.
    """
    from . import web_search  # noqa: PLC0415

    machine = (item or "").strip()
    if not machine:
        return {"status": "error", "detail": "No equipment type given.", "listings": []}

    parts = ["used", machine, "for sale"]
    if year_min:
        parts.append(f"{year_min} or newer")
    if max_price:
        parts.append(f"under ${max_price:,}")
    if location:
        parts.append(f"near {location}")
    # Bias the engine toward the marketplaces rather than dealer marketing pages.
    parts.append("site:" + " OR site:".join(_MARKETPLACES[:5]))
    query = " ".join(parts)

    try:
        raw = await web_search.search(query, deep=True, max_results=12)
    except Exception as exc:  # noqa: BLE001
        logger.warning("equipment search failed: %s", exc)
        return {"status": "unavailable", "detail": f"{type(exc).__name__}", "listings": []}

    if raw.get("error"):
        return {"status": "unavailable", "detail": raw["error"], "listings": []}

    results = raw.get("results") or []
    ranked = sorted(results, key=_score, reverse=True)

    listings = []
    for r in ranked[:8]:
        text = f"{r.get('title','')} {r.get('content','')}"
        price = _PRICE.search(text)
        listings.append(
            {
                "title": r.get("title"),
                "url": r.get("url"),
                "source": next((d for d in _MARKETPLACES if d in (r.get("url") or "").lower()), None),
                "price_seen": price.group(0) if price else None,
                "snippet": (r.get("content") or "")[:220] or None,
            }
        )

    return {
        "status": "ok",
        "query": query,
        "searched": [m for m in _MARKETPLACES[:5]],
        "count": len(listings),
        "listings": listings,
        "caveat": (
            "These are live third-party listings. Prices and availability are as posted by the "
            "seller and are not verified — confirm condition, hours and title before committing."
        ),
    }
