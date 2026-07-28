"""
commercial_bid_hunter.py — commercial paving RFP discovery.

CURRENT SCOPE — read this before quoting coverage to anyone.

This module queries exactly one source: the SAM.gov federal opportunities API.
It can be pointed at any of the 51 US states and territories, but "51 states" is
the breadth of the *filter*, not the number of data sources.

The header here used to list PlanHub, BuildingConnected & ConstructConnect,
Dodge Construction Network and "State DOT Portals (All 51 State DOTs)" as
things this engine automated. None of them were ever called from this file.
They are genuine roadmap items, and `run_commercial_bid_hunt` reports them in
`sources_not_implemented` so a caller can see the gap instead of inferring
coverage that does not exist.

Requires SAM_GOV_API_KEY. Without it every query returns
`reason: "not_configured"` and no bids — see `hunt_sam_gov_contracts`.
"""

import asyncio
import httpx
import logging
from datetime import datetime, timezone
from typing import List, Dict, Optional

from . import runtime_config as _cfg

logger = logging.getLogger(__name__)

ALL_51_STATES = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", 
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", 
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", 
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", 
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"
]

# Target commercial paving project keywords
PAVING_KEYWORDS = [
    "asphalt paving", "parking lot resurfacing", "milling", "sealcoating", 
    "crack sealing", "subgrade compaction", "line striping", "commercial pavement",
    "ada stalls", "concrete aprons", "catch basin repair"
]

# How long to wait on SAM.gov before giving up on a single state. The original
# value here was 1.5s, which SAM.gov rarely answers inside — so the timeout path
# was the normal path, not the exceptional one.
_SAM_TIMEOUT_SECONDS = float(_cfg.get("SAM_GOV_TIMEOUT_SECONDS", "10") or 10)


async def hunt_sam_gov_contracts(state: str, limit: int = 5) -> Dict:
    """
    Query the SAM.gov opportunities API for federal paving RFPs in one state.

    Returns a per-state result envelope:

        {"state": "VA", "ok": True,  "bids": [...]}
        {"state": "VA", "ok": False, "bids": [], "error": "…", "reason": "…"}

    IMPORTANT — WHY THIS RETURNS AN ENVELOPE AND NOT A BARE LIST

    This function used to return a hand-written placeholder bid whenever the API
    call failed: solicitation number "RFP-2026-PAVE-VA01", agency "VA Department
    of Transportation / Commercial GC", deadline "2026-08-30", value
    "$250,000 - $750,000". None of that corresponded to a real solicitation. It
    was returned with no marker distinguishing it from a genuine SAM.gov record,
    and the caller reported `ok: True` over the top of it.

    Two things made that the normal outcome rather than a rare one: the API key
    defaults to "DEMO_KEY", and the timeout was 1.5 seconds. So the realistic
    behaviour of this endpoint was to invent one plausible-looking federal
    contract per state, every time, forever.

    A contractor acting on that would chase a solicitation number that does not
    exist. There is no version of that which is acceptable, so the placeholder is
    gone. When a source cannot be reached the caller is told the source could not
    be reached.
    """
    sam_api_key = _cfg.get("SAM_GOV_API_KEY", "") or ""
    if not sam_api_key or sam_api_key == "DEMO_KEY":
        return {
            "state": state,
            "ok": False,
            "bids": [],
            "reason": "not_configured",
            "error": "SAM_GOV_API_KEY is not set. Register at sam.gov for a production key.",
        }

    url = (
        "https://api.sam.gov/prod/opportunities/v1/search"
        f"?limit={limit}&postedFrom=01/01/2026&ptype=o,k&state={state}"
        f"&q=asphalt+paving&api_key={sam_api_key}"
    )

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, timeout=_SAM_TIMEOUT_SECONDS)
            if resp.status_code != 200:
                return {
                    "state": state,
                    "ok": False,
                    "bids": [],
                    "reason": "http_error",
                    "error": f"SAM.gov returned HTTP {resp.status_code}",
                }

            data = resp.json()
            opps = data.get("opportunitiesData", []) or []
            results = []
            for opp in opps:
                results.append({
                    "platform": "SAM.gov",
                    "project_title": opp.get("title"),
                    "solicitation_number": opp.get("solicitationNumber"),
                    "agency": opp.get("departmentFull"),
                    "posted_date": opp.get("postedDate"),
                    "response_deadline": opp.get("responseDeadLine"),
                    "state": state,
                    "url": opp.get("uiLink"),
                    # SAM.gov does not publish an award value on the opportunity
                    # record, so there is nothing to report here. The previous
                    # code stamped a fixed "$100,000 - $1,500,000+" range onto
                    # every result, which read as an estimate derived from the
                    # solicitation and was not.
                    "estimated_value": None,
                })
            return {"state": state, "ok": True, "bids": results}

    except Exception as e:  # noqa: BLE001 — network faults must not kill the sweep
        logger.warning("SAM.gov query failed for %s: %s", state, e)
        return {
            "state": state,
            "ok": False,
            "bids": [],
            "reason": "unreachable",
            "error": str(e),
        }

async def run_commercial_bid_hunt(states: Optional[List[str]] = None) -> Dict:
    """
    Orchestrates commercial bid hunting across US states & territories in parallel.
    """
    DEFAULT_CORE_STATES = ["VA", "MD", "NC", "DC", "WV", "GA", "FL", "PA", "OH", "TX"]
    target_states = states if states else DEFAULT_CORE_STATES
    target_states = [s.upper() for s in target_states if s.upper() in ALL_51_STATES]
    if not target_states:
        target_states = ALL_51_STATES

    # Query all target states concurrently.
    tasks = [hunt_sam_gov_contracts(state=st) for st in target_states]
    state_results = await asyncio.gather(*tasks, return_exceptions=True)

    all_bids: List[Dict] = []
    failures: List[Dict] = []
    states_ok = 0

    for st, res in zip(target_states, state_results):
        if isinstance(res, BaseException):
            failures.append({"state": st, "reason": "exception", "error": str(res)})
            continue
        if not isinstance(res, dict):
            failures.append({"state": st, "reason": "bad_response", "error": "unrecognised result"})
            continue
        if res.get("ok"):
            states_ok += 1
            all_bids.extend(res.get("bids") or [])
        else:
            failures.append({
                "state": st,
                "reason": res.get("reason", "unknown"),
                "error": res.get("error", ""),
            })

    # `platforms_monitored` previously advertised PlanHub, BuildingConnected,
    # Dodge Network and "All 51 State DOTs". This function calls exactly one
    # source — SAM.gov. Listing the others made the sweep look four times wider
    # than it is, and made an empty result read as "nothing out there" rather
    # than "we only checked one place". Report the source actually queried.
    return {
        # ok reflects whether anything was actually reached, not whether the
        # function ran to completion.
        "ok": states_ok > 0,
        "degraded": len(failures) > 0,
        "sources_queried": ["SAM.gov"],
        "sources_not_implemented": [
            "PlanHub", "BuildingConnected", "Dodge Construction Network", "State DOT portals",
        ],
        "states_requested": len(target_states),
        "states_reached": states_ok,
        "states_failed": len(failures),
        "failures": failures,
        "total_discovered": len(all_bids),
        "bids": all_bids,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
