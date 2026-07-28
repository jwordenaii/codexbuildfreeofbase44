"""
bid_hunter_router.py — 51-Territory Commercial Construction Bid Hunter Router for Jarvis OS
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from typing import List, Optional
import logging

from ..services.commercial_bid_hunter import run_commercial_bid_hunt, ALL_51_STATES
from ..services.planhub_scraper import scrape_planhub_commercial_bids

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/hunter", tags=["Commercial Bid Hunter"])

@router.get("/commercial-bids", summary="Hunt commercial paving bids across all 51 US states & territories")
async def get_commercial_bids(
    states: Optional[str] = Query(None, description="Comma-separated state codes (e.g. ALL or VA,GA,TX,FL,MI). Defaults to all 51 territories.")
):
    """
    Scrapes and aggregates active commercial asphalt paving RFPs across PlanHub, Dodge, BuildingConnected, SAM.gov, and all 51 State DOTs.
    """
    state_list = None
    if states and states.upper() != "ALL":
        state_list = [s.strip().upper() for s in states.split(",") if s.strip()]
        
    results = await run_commercial_bid_hunt(states=state_list)
    return results

@router.post("/scrape-planhub", summary="Trigger automated PlanHub commercial bid scraper")
async def trigger_planhub_scraper(
    keywords: List[str] = Body(["asphalt", "paving", "milling", "sealcoating"])
):
    """
    Launches Playwright headless scraper to extract private subcontractor commercial RFPs from PlanHub.
    """
    results = await scrape_planhub_commercial_bids(keywords=keywords)
    return results
