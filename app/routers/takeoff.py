"""
Takeoff endpoints for the JWordenAI Command Center.

Routes:
  POST /api/v1/takeoff/solar    — Google Solar API (DSM + flux data)
  POST /api/v1/takeoff/measure  — OpenCV image measurement pipeline
  GET  /api/v1/takeoff/aerial   — Google Aerial View API (3D video URL)
"""

import logging

from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile
from pydantic import BaseModel, Field

from ..core.limiter import limiter
from ..services.vision_takeoff import aerial_view_lookup, measure_image_areas, solar_lookup

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/takeoff", tags=["takeoff"])

_MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB


# ── Solar ─────────────────────────────────────────────────────────────────────

class SolarRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90, description="Latitude of the target location")
    lng: float = Field(..., ge=-180, le=180, description="Longitude of the target location")


@router.post(
    "/solar",
    summary="Google Solar API — DSM, roof area, and flux map metadata",
)
@limiter.limit("20/minute")
async def solar_data(request: Request, req: SolarRequest):
    """
    Call the Google Solar API buildingInsights endpoint for the building
    closest to the supplied lat/lng.  Returns DSM metadata, max array area,
    sunshine hours, and flux map URLs — useful for site assessments and
    rooftop area takeoffs.
    """
    result = solar_lookup(lat=req.lat, lng=req.lng)
    if result.get("error") and not result.get("data"):
        raise HTTPException(status_code=503, detail=result["error"])
    return {"status": "ok", **result}


# ── Image measurement ─────────────────────────────────────────────────────────

@router.post(
    "/measure",
    summary="OpenCV image measurement — detect polygon areas in square feet",
)
@limiter.limit("10/minute")
async def measure_image(
    request: Request,
    file: UploadFile = File(..., description="Project photo (JPEG / PNG)"),
    pixels_per_foot: float = Query(
        default=10.0,
        gt=0,
        le=10_000,
        description="Calibration: pixels per linear foot in the image",
    ),
    min_area_sqft: float = Query(
        default=10.0,
        ge=0,
        description="Ignore polygons smaller than this area (sq ft)",
    ),
):
    """
    Run the OpenCV pipeline on an uploaded project photo:
      grayscale → Gaussian blur → Canny edges → contours → polygon areas

    Returns detected polygon areas in square feet, sorted largest-first.
    Use `pixels_per_foot` to calibrate based on a known reference dimension
    in the image (e.g. a 20-foot road width = 200 pixels → 10 px/ft).
    """
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="File must be an image (JPEG, PNG, etc.).")

    image_bytes = await file.read()
    if len(image_bytes) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image exceeds 20 MB limit.")
    if not image_bytes:
        raise HTTPException(status_code=422, detail="Uploaded file is empty.")

    try:
        result = measure_image_areas(
            image_bytes=image_bytes,
            pixels_per_foot=pixels_per_foot,
            min_area_sqft=min_area_sqft,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return {"status": "ok", **result}


# ── Aerial View ───────────────────────────────────────────────────────────────

@router.get(
    "/aerial",
    summary="Google Aerial View API — cinematic 3D video URL for an address",
)
@limiter.limit("20/minute")
async def aerial_view(
    request: Request,
    address: str = Query(..., min_length=5, max_length=300, description="Street address"),
):
    """
    Retrieve a signed cinematic aerial video URL from Google Aerial View API
    for the given address.  The returned MP4 URL can be embedded directly
    in the Command Center for immersive client-facing project visualization.
    """
    result = aerial_view_lookup(address=address)
    if result.get("error") and not result.get("data"):
        raise HTTPException(status_code=503, detail=result["error"])
    return {"status": "ok", **result}
