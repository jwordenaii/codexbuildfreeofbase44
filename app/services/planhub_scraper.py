"""
planhub_scraper.py — PlanHub & Commercial Bid Board Scraper Engine for Jarvis OS

Features:
1. Playwright Headless Browser Automation for PlanHub (access.planhub.com)
2. Automated Extraction of Private Commercial Subcontracting RFPs
3. Keyword Filtering: Asphalt Paving, Night Milling, Sealcoating, Parking Lot Resurfacing
4. Automatic Ingestion into Jarvis Lead Pipeline & Monte Carlo Bid Calculator
"""

import os
import logging
from datetime import datetime, timezone
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)

# PlanHub login credentials. Read at call time rather than import time so a
# credential added to runtime config takes effect without a redeploy.
#
# The email previously defaulted to a hardcoded personal address. A default
# username is not a useful fallback — without the matching password the login
# cannot succeed anyway — and baking a real address into source means it ships
# in every copy of the repo. There is no default now: no credentials, no scrape.
def _planhub_credentials() -> tuple[str, str]:
    return os.getenv("PLANHUB_EMAIL", ""), os.getenv("PLANHUB_PASSWORD", "")


async def scrape_planhub_commercial_bids(
    keywords: Optional[List[str]] = None,
) -> Dict:
    """
    Log in to PlanHub with Playwright and extract commercial paving RFPs.

    Returns only what was actually scraped. When the scraper cannot run — no
    Playwright, no credentials, login failure — it says so and returns no bids.

    WHY THERE IS NO LONGER A SIMULATED FALLBACK

    This function used to fall back to `get_simulated_planhub_bids()` on three
    separate paths: Playwright missing, any exception, and — the worst one — a
    successful scrape that legitimately found zero matching projects. That helper
    returned five hardcoded projects with invented GC names ("Southeast Retail
    Builders", "Great Lakes Construction Group"), invented square footages, and
    invented budget ranges, under `"ok": True` and `"source": "PlanHub Engine"`.
    Its docstring described them as "authentic".

    Nothing in the response distinguished those five inventions from a real
    scrape, so the endpoint's most likely output was fiction that looked exactly
    like fact. A contractor could have spent a day preparing a bid for a project
    that was never posted by a GC that does not exist.

    Sample data for UI work is still available, but it must be asked for by name
    (`get_sample_planhub_bids()`), every record carries `"simulated": true`, and
    no failure path reaches for it automatically.
    """
    keywords = keywords or ["asphalt", "paving", "milling", "sealcoating"]
    logger.info("Initializing PlanHub Commercial Bid Scraper...")
    
    email, password = _planhub_credentials()
    if not email or not password:
        return {
            "ok": False,
            "source": "PlanHub",
            "reason": "not_configured",
            "error": "PLANHUB_EMAIL and PLANHUB_PASSWORD must both be set to scrape PlanHub.",
            "total_found": 0,
            "bids": [],
        }

    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return {
            "ok": False,
            "source": "PlanHub",
            "reason": "playwright_missing",
            "error": "Playwright is not installed in this environment.",
            "total_found": 0,
            "bids": [],
        }

    scraped_bids: List[Dict] = []

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            try:
                page = await browser.new_page(viewport={"width": 1440, "height": 900})

                logger.info("Navigating to access.planhub.com...")
                await page.goto(
                    "https://access.planhub.com/signin",
                    wait_until="networkidle",
                    timeout=15000,
                )

                await page.fill('input[type="email"]', email)
                await page.fill('input[type="password"]', password)
                await page.click('button[type="submit"]')
                await page.wait_for_timeout(3000)

                await page.goto(
                    "https://access.planhub.com/subcontractor/projects",
                    wait_until="networkidle",
                )

                cards = await page.query_selector_all('.project-card, .bid-opportunity')
                for card in cards:
                    text = await card.inner_text()
                    if any(k in text.lower() for k in keywords):
                        scraped_bids.append({
                            "platform": "PlanHub",
                            "raw_text": text[:300],
                            "extracted_at": datetime.now(timezone.utc).isoformat(),
                        })
            finally:
                await browser.close()

    except Exception as e:  # noqa: BLE001 — report the failure, never paper over it
        logger.error("PlanHub scraper failed: %s", e)
        return {
            "ok": False,
            "source": "PlanHub",
            "reason": "scrape_failed",
            "error": str(e),
            "total_found": 0,
            "bids": [],
        }

    # Zero results is a real, reportable answer: it means the board had nothing
    # matching these keywords today. It is not a reason to substitute samples.
    return {
        "ok": True,
        "source": "PlanHub Live Scraper",
        "keywords": keywords,
        "total_found": len(scraped_bids),
        "bids": scraped_bids,
    }

def get_sample_planhub_bids() -> Dict:
    """
    Hand-written sample records for UI and integration work. NOT REAL PROJECTS.

    Every project title, GC name, location, square footage and budget below was
    made up. None of them corresponds to a posted solicitation.

    This used to be called `get_simulated_planhub_bids`, was documented as
    returning "authentic" opportunities, and was returned automatically from
    three failure paths in `scrape_planhub_commercial_bids` under `ok: True`.
    It is now opt-in only, `ok` is False so no caller mistakes it for a live
    result, and `_stamp_simulated` marks every individual record — so a bid that
    gets separated from its envelope and merged into a list still carries the
    marker with it.
    """
    payload = {
        "ok": False,
        "simulated": True,
        "warning": "SAMPLE DATA — these projects do not exist. For UI development only.",
        "source": "sample fixture (not PlanHub)",
        "total_found": 5,
        "bids": [
            {
                "platform": "PlanHub",
                "project_title": "Commercial Retail Shopping Center Asphalt Resurfacing",
                "location": "Chesterfield, VA",
                "gc_name": "Mid-Atlantic Commercial GC",
                "bid_due_date": "2026-08-12",
                "estimated_sqft": 45000,
                "trade": "Asphalt Paving & Site Concrete",
                "estimated_budget": "$180,000 - $250,000"
            },
            {
                "platform": "BuildingConnected",
                "project_title": "QSR Fast Food Drive-Thru Night Milling & Overlay",
                "location": "Henrico, VA",
                "gc_name": "Southeast Retail Builders",
                "bid_due_date": "2026-08-08",
                "estimated_sqft": 22000,
                "trade": "Asphalt Milling & Striping",
                "estimated_budget": "$95,000 - $140,000"
            },
            {
                "platform": "Dodge Construction Network",
                "project_title": "Industrial Logistics Park Heavy Compaction Paving",
                "location": "Atlanta, GA",
                "gc_name": "Georgia Industrial Construction",
                "bid_due_date": "2026-08-20",
                "estimated_sqft": 110000,
                "trade": "Heavy Industrial Asphalt",
                "estimated_budget": "$480,000 - $650,000"
            },
            {
                "platform": "PlanHub",
                "project_title": "Automotive Dealership Display Lot Resurfacing & Sealcoating",
                "location": "Kansas City, MO",
                "gc_name": "Heartland Commercial Developers",
                "bid_due_date": "2026-08-18",
                "estimated_sqft": 58000,
                "trade": "Commercial Paving & Sealcoating",
                "estimated_budget": "$210,000 - $290,000"
            },
            {
                "platform": "PlanHub",
                "project_title": "Sub-Zero Distribution Hub Heavy Duty Pavement Patching",
                "location": "Detroit, MI",
                "gc_name": "Great Lakes Construction Group",
                "bid_due_date": "2026-08-25",
                "estimated_sqft": 75000,
                "trade": "Heavy Duty RAP Asphalt",
                "estimated_budget": "$320,000 - $440,000"
            }
        ]
    }
    return _stamp_simulated(payload)


def _stamp_simulated(payload: Dict) -> Dict:
    """Mark the envelope and every individual bid record as simulated."""
    for bid in payload.get("bids", []):
        bid["simulated"] = True
        bid["project_title"] = f"[SAMPLE] {bid.get('project_title', '')}".strip()
    payload["total_found"] = len(payload.get("bids", []))
    return payload
