"""
visualizer.py — 3-D Property Visualizer endpoints for JWordenAI.

Routes:
  POST /api/v1/visualizer/parcel          — look up parcel data for an address
  POST /api/v1/visualizer/proposal        — submit a visual build configuration as a lead/proposal
  POST /api/v1/visualizer/ai-suggestions  — AI design suggestions for a build config

The parcel endpoint is publicly accessible (no auth required) — it is purely
a geocoding / estimation helper.  The proposal endpoint writes to the leads
table and optionally generates an AI narrative, so it carries a rate-limit
but no auth requirement (matches the existing quote form pattern).
"""

from __future__ import annotations

import logging
import os
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from pydantic import BaseModel

from ..core.limiter import limiter
from ..services.pricing import estimate_price

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/visualizer", tags=["visualizer"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class ParcelRequest(BaseModel):
    address: str


class VisualProposalRequest(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    address: Optional[str] = None
    build_type: str
    property_type: str
    sqft: float
    floors: Optional[int] = 1
    ground_material: Optional[str] = None
    exterior_material: Optional[str] = None
    roof_color: Optional[str] = None
    state_code: Optional[str] = None
    notes: Optional[str] = None
    snapshot_data_url: Optional[str] = None  # base64 PNG from canvas.toDataURL()


class AIDesignRequest(BaseModel):
    build_type: str
    property_type: str
    sqft: float
    state_code: Optional[str] = None
    special_requests: Optional[str] = None


# ── Parcel lookup ─────────────────────────────────────────────────────────────

_GOOGLE_GEOCODE_BASE = "https://maps.googleapis.com/maps/api/geocode/json"
_REGRID_SEARCH_BASE  = "https://app.regrid.com/api/v1/search"


def _geocode_address(address: str) -> dict | None:
    """
    Geocode an address using the Google Maps Geocoding API.
    Returns {'lat': float, 'lng': float, 'formatted_address': str} or None.
    Requires GOOGLE_MAPS_API_KEY environment variable.
    """
    api_key = os.getenv("GOOGLE_MAPS_API_KEY", "")
    if not api_key:
        return None

    try:
        import urllib.request  # noqa: PLC0415
        import urllib.parse    # noqa: PLC0415
        import json            # noqa: PLC0415

        # URL is assembled entirely from a hard-coded base + server-controlled key;
        # the address value is percent-encoded by urlencode, so it cannot change the domain.
        url = _GOOGLE_GEOCODE_BASE + "?" + urllib.parse.urlencode({"address": address, "key": api_key})
        assert url.startswith(_GOOGLE_GEOCODE_BASE), "URL domain drift detected"  # noqa: S101
        with urllib.request.urlopen(url, timeout=8) as resp:  # noqa: S310
            data = json.loads(resp.read())

        results = data.get("results", [])
        if not results:
            return None

        loc = results[0]["geometry"]["location"]
        return {
            "lat": loc["lat"],
            "lng": loc["lng"],
            "formatted_address": results[0]["formatted_address"],
        }
    except Exception as exc:  # noqa: BLE001
        logger.warning("Geocoding failed: %s", exc)
        return None


def _estimate_parcel_sqft(address: str) -> dict:
    """
    Best-effort parcel size estimation.

    Priority:
      1. Regrid Parcel API (REGRID_API_KEY) — returns real parcel polygon + sq ft
      2. Fallback: return a sensible default estimate so the UI always has data
    """
    regrid_key = os.getenv("REGRID_API_KEY", "")

    if regrid_key:
        try:
            import urllib.request  # noqa: PLC0415
            import urllib.parse    # noqa: PLC0415
            import json            # noqa: PLC0415

            url = _REGRID_SEARCH_BASE + "?" + urllib.parse.urlencode({"query": address, "token": regrid_key, "limit": 1})
            assert url.startswith(_REGRID_SEARCH_BASE), "URL domain drift detected"  # noqa: S101
            with urllib.request.urlopen(url, timeout=10) as resp:  # noqa: S310
                data = json.loads(resp.read())

            parcels = data.get("results", {}).get("parcels", {}).get("features", [])
            if parcels:
                props = parcels[0].get("properties", {}).get("fields", {})
                sqft = float(props.get("ll_gisacre", 0)) * 43560  # acres → sq ft
                if sqft > 0:
                    return {
                        "sqft_estimated": round(sqft),
                        "source": "regrid",
                        "confidence": "high",
                        "parcel_id": props.get("parcelnumb", ""),
                    }
        except Exception as exc:  # noqa: BLE001
            logger.warning("Regrid lookup failed: %s", exc)

    # Fallback: sensible residential default
    return {
        "sqft_estimated": 8500,
        "source": "default_estimate",
        "confidence": "low",
        "parcel_id": None,
    }


@router.post("/parcel", summary="Look up parcel data for an address")
@limiter.limit("30/minute")
async def scan_parcel(request: Request, req: ParcelRequest):
    """
    Given a street address, return:
      - Geocoded lat/lng
      - Estimated parcel square footage
      - Aerial tile URL (Google Maps Static API if key available, else None)
      - Confidence level of the estimate

    No authentication required — this powers the customer-facing visualizer.
    """
    address = req.address.strip()
    if not address:
        raise HTTPException(status_code=422, detail="address is required")

    geo = _geocode_address(address)
    parcel = _estimate_parcel_sqft(address)

    # Build aerial tile URL if Google Maps API key is configured
    aerial_url: str | None = None
    maps_key = os.getenv("GOOGLE_MAPS_API_KEY", "")
    if maps_key and geo:
        aerial_url = (
            f"https://maps.googleapis.com/maps/api/staticmap"
            f"?center={geo['lat']},{geo['lng']}"
            f"&zoom=19&size=600x400&maptype=satellite&key={maps_key}"
        )

    return {
        "address": geo["formatted_address"] if geo else address,
        "lat": geo["lat"] if geo else None,
        "lng": geo["lng"] if geo else None,
        "sqft_estimated": parcel["sqft_estimated"],
        "parcel_id": parcel.get("parcel_id"),
        "confidence": parcel["confidence"],
        "source": parcel["source"],
        "aerial_url": aerial_url,
    }


# ── Visual Proposal submission ────────────────────────────────────────────────

def _build_proposal_narrative(data: dict) -> str:
    """Generate a natural-language description of the visual build config."""
    build_labels = {
        "driveway":                     "driveway installation",
        "parking_lot":                  "parking lot build-out",
        "new_construction_residential": "new residential construction",
        "addition":                     "home addition / remodel",
        "adu":                          "accessory dwelling unit (ADU)",
        "commercial_build":             "commercial building project",
    }
    build_label = build_labels.get(data.get("build_type", ""), data.get("build_type", ""))
    sqft        = data.get("sqft", 0)
    prop_type   = data.get("property_type", "residential")
    ext         = data.get("exterior_material", "")
    ground      = data.get("ground_material", "")
    floors      = data.get("floors", 1)
    state       = data.get("state_code", "") or "location TBD"

    material_note = ""
    if ext:
        material_note = f" with {ext} exterior finish"
    elif ground:
        material_note = f" using {ground}"

    floors_note = f", {floors}-story" if floors and floors > 1 else ""

    return (
        f"Customer submitted a 3-D visualizer quote request for a {sqft:,.0f} sq ft "
        f"{prop_type} {build_label}{material_note}{floors_note} in {state}. "
        f"Configuration was designed using the interactive 3-D property modeler."
    )


def _ai_proposal_narrative(build_config: dict) -> str:
    """Use GPT-4o to generate an enhanced proposal narrative (falls back gracefully).

    Only server-validated, typed fields are sent to OpenAI — free-text user
    input (notes) is excluded to prevent prompt injection and to ensure the
    returned narrative never contains user-supplied stack traces or content.
    """
    try:
        from openai import OpenAI  # type: ignore  # noqa: PLC0415
        import json as _json  # noqa: PLC0415

        # Only include schema-validated typed fields — not free-text user input
        safe_config = {
            k: build_config[k]
            for k in (
                "build_type", "property_type", "sqft", "floors",
                "ground_material", "exterior_material", "roof_color", "state_code",
            )
            if k in build_config
        }

        client   = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        config_s = _json.dumps(safe_config, indent=2)
        prompt   = (
            "You are a proposal writer for J. Worden & Sons, a 4th-generation contractor. "
            "Write a 2-paragraph professional proposal summary for this customer's 3-D visualizer "
            "build request. Be specific to their configuration. Mention the build type, materials, "
            "and size. Close by noting a free on-site consultation is included.\n\n"
            f"Configuration:\n{config_s}"
        )
        resp = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=400,
        )
        return resp.choices[0].message.content or _build_proposal_narrative(build_config)
    except Exception as exc:  # noqa: BLE001
        logger.debug("AI proposal narrative failed, using stub: %s", exc)
        return _build_proposal_narrative(build_config)


@router.post("/proposal", summary="Submit a visual build configuration as a quote request")
@limiter.limit("10/minute")
async def submit_visual_proposal(
    request: Request,
    req: VisualProposalRequest,
    background_tasks: BackgroundTasks,
):
    """
    Accept a customer's 3-D build configuration and create a Lead record
    (mirroring the existing quote form flow), then return a proposal preview.
    """
    # Lazy-import to avoid circular imports
    try:
        from ..database import get_db     # noqa: PLC0415
        from ..models import Lead         # noqa: PLC0415
        from sqlalchemy.orm import Session  # noqa: PLC0415

        db: Session = next(get_db())
        try:
            lead = Lead(
                name            = req.name,
                email           = req.email,
                phone           = req.phone or "",
                address         = req.address or "",
                service_type    = req.build_type,
                property_type   = req.property_type,
                project_size_sqft = req.sqft,
                message         = (
                    f"[3D Visualizer] {req.notes or ''}\n"
                    f"Material: {req.ground_material or req.exterior_material or 'N/A'}, "
                    f"Floors: {req.floors}, "
                    f"Roof: {req.roof_color or 'N/A'}"
                ).strip(),
                source          = "3d_visualizer",
                pipeline_stage  = "new",
            )
            db.add(lead)
            db.commit()
            db.refresh(lead)
            lead_id = lead.id
        finally:
            db.close()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not persist visualizer lead: %s", exc)
        lead_id = None

    # Pricing estimate
    pricing = estimate_price(
        req.build_type,
        req.property_type,
        req.sqft,
        req.state_code,
    )

    # AI or stub narrative — use only typed config fields, not raw user input
    build_config = {
        "build_type":        req.build_type,
        "property_type":     req.property_type,
        "sqft":              req.sqft,
        "floors":            req.floors,
        "ground_material":   req.ground_material,
        "exterior_material": req.exterior_material,
        "roof_color":        req.roof_color,
        "state_code":        req.state_code,
    }
    openai_key = os.getenv("OPENAI_API_KEY", "")
    narrative  = _ai_proposal_narrative(build_config) if openai_key else _build_proposal_narrative(build_config)

    return {
        "status":        "received",
        "lead_id":       lead_id,
        "name":          req.name,
        "build_type":    req.build_type,
        "sqft":          req.sqft,
        "price_low":     pricing["low_fmt"]  if pricing else "Contact for pricing",
        "price_high":    pricing["high_fmt"] if pricing else "",
        "narrative":     narrative,
        "message": (
            "Your 3-D build design has been received! "
            "A member of the J. Worden & Sons team will follow up shortly "
            "with a detailed quote and to schedule a free on-site consultation."
        ),
    }


# ── AI Design Suggestions ─────────────────────────────────────────────────────

@router.post("/ai-suggestions", summary="Get AI design suggestions for a build configuration")
@limiter.limit("20/minute")
async def ai_design_suggestions(request: Request, req: AIDesignRequest):
    """
    Return design recommendations and upgrade suggestions for a given build
    configuration.  Falls back to curated static suggestions when OpenAI is
    not configured.
    """
    openai_key = os.getenv("OPENAI_API_KEY", "")

    if openai_key:
        try:
            from openai import OpenAI  # type: ignore  # noqa: PLC0415

            client = OpenAI(api_key=openai_key)
            prompt = (
                "You are Jay Worden, an AI design consultant for J. Worden & Sons contractors. "
                f"A customer is planning a {req.sqft:,.0f} sq ft {req.property_type} {req.build_type.replace('_', ' ')} "
                f"in {req.state_code or 'their area'}. "
                "Give 3 specific, practical upgrade suggestions (each 1–2 sentences) that would increase "
                "property value and durability. Be specific to the build type and size. "
                "Format: return a JSON array of objects with keys 'title' and 'description'."
            )
            resp = client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=350,
                response_format={"type": "json_object"},
            )
            import json as _json  # noqa: PLC0415
            text = resp.choices[0].message.content or "{}"
            parsed = _json.loads(text)
            suggestions = parsed.get("suggestions", parsed) if isinstance(parsed, dict) else parsed
            if isinstance(suggestions, list):
                return {"suggestions": suggestions[:4]}
        except Exception as exc:  # noqa: BLE001
            logger.debug("AI suggestions failed: %s", exc)

    # ── Static fallback suggestions keyed by build type ───────────────────────
    static: dict[str, list[dict]] = {
        "driveway": [
            {"title": "Heated Driveway System", "description": "In-slab radiant heat elements eliminate ice and snow removal — adds $8–12/sq ft but pays back over time."},
            {"title": "Permeable Edge Strips", "description": "Cobblestone or gravel edge strips improve stormwater drainage and add a premium finished look."},
            {"title": "Sealed Expansion Joints", "description": "Hot-pour rubberized joints every 20 ft prevent heaving and water intrusion, extending pavement life 5–8 years."},
        ],
        "parking_lot": [
            {"title": "LED Lighting Upgrade", "description": "Modern dark-sky LED fixtures reduce energy cost 60% and improve security for commercial tenants."},
            {"title": "EV Charging Conduit", "description": "Run conduit now while the lot is open — adding EV chargers later costs 3× more."},
            {"title": "Green Islands", "description": "Permeable paver islands with native plantings satisfy local stormwater ordinances and improve curb appeal."},
        ],
        "new_construction_residential": [
            {"title": "Spray Foam Insulation", "description": "Closed-cell spray foam in walls and roof deck reduces HVAC load 30–40% vs. batt insulation — a proven ROI upgrade."},
            {"title": "Asphalt Driveway Package", "description": "Bundle a new asphalt driveway with your build for significant mobilization savings vs. a separate contract later."},
            {"title": "Cobblestone Entry Apron", "description": "A 200–300 sq ft cobblestone apron at the driveway entrance adds $8–15K in perceived value for under $12K."},
        ],
        "addition": [
            {"title": "Match Roofline Pitch", "description": "An addition that matches the primary structure's roofline pitch appraised 12–18% higher than box additions."},
            {"title": "Radiant Floor Heat", "description": "Hydronic radiant floors in the new space cost $10–15/sq ft and nearly eliminate cold spots."},
            {"title": "Upgraded Window Package", "description": "Triple-pane windows in the addition pay back in energy savings within 7 years in cold climates."},
        ],
        "adu": [
            {"title": "Pre-Plumbed Laundry Hookup", "description": "Adding a dedicated laundry connection increases rental value $150–250/month in most markets."},
            {"title": "Separate Utility Meters", "description": "Sub-metering the ADU allows separate billing and simplifies future sale of the unit."},
            {"title": "Accessory Driveway Spur", "description": "A dedicated asphalt or paver spur gives the ADU independent access — required by many rental ordinances."},
        ],
        "commercial_build": [
            {"title": "Class A Finish Standards", "description": "Upgrading to Class A finishes (polished concrete, curtain wall glazing) increases per-sq-ft lease rates 15–25%."},
            {"title": "HVAC Over-sizing Allowance", "description": "Size mechanical systems 20% above code minimum to accommodate future tenant load without costly retrofits."},
            {"title": "Loading Dock Rough-In", "description": "Even if not needed now, rough-in a dock-height bay — it costs $4–8K now vs. $40K+ to add later."},
        ],
    }

    suggestions = static.get(req.build_type, static.get("driveway", []))
    return {"suggestions": suggestions}
