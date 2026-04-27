"""
Vision takeoff service for the JWordenAI Command Center.

Provides two capabilities:

1. measure_image_areas(image_bytes, pixels_per_foot)
   OpenCV pipeline: grayscale → Gaussian blur → Canny edge detection →
   findContours → approxPolyDP → area calculation.
   Returns a list of detected polygon areas in square feet.

2. solar_lookup(lat, lng, api_key)
   Calls Google Solar API to retrieve DSM (Digital Surface Model) and
   flux map metadata for a given coordinate.

3. aerial_view_lookup(address, api_key)
   Calls Google Aerial View API to retrieve a signed cinematic video URL.
"""

from __future__ import annotations

import io
import logging
import os
from typing import Any

import httpx
import numpy as np

logger = logging.getLogger(__name__)

_HTTP_TIMEOUT = 20.0

# ── Image measurement ─────────────────────────────────────────────────────────

def measure_image_areas(
    image_bytes: bytes,
    pixels_per_foot: float = 10.0,
    min_area_sqft: float = 10.0,
    canny_low: int = 50,
    canny_high: int = 150,
    approx_epsilon_ratio: float = 0.02,
) -> dict[str, Any]:
    """
    Run the OpenCV measurement pipeline on *image_bytes*.

    Pipeline:
      1. Decode image → BGR array
      2. Convert to grayscale
      3. Gaussian blur (5×5) to reduce noise
      4. Canny edge detection
      5. findContours to locate closed shapes
      6. approxPolyDP to fit polygons
      7. Convert pixel areas to square feet

    Parameters
    ----------
    image_bytes        : raw image file bytes (JPEG / PNG / etc.)
    pixels_per_foot    : calibration — how many pixels equal one foot.
                         Default 10 px/ft → 100 px²/ft².
    min_area_sqft      : discard polygons smaller than this (noise filter)
    canny_low          : lower Canny threshold
    canny_high         : upper Canny threshold
    approx_epsilon_ratio : approxPolyDP epsilon as ratio of arc length

    Returns
    -------
    {
        "polygon_count": int,
        "areas_sqft": list[float],
        "total_area_sqft": float,
        "largest_area_sqft": float,
    }
    """
    try:
        import cv2  # noqa: PLC0415 — imported lazily to keep startup fast
    except ImportError as exc:
        raise RuntimeError(
            "opencv-python-headless is not installed. "
            "Install it with: pip install opencv-python-headless==4.10.0.84"
        ) from exc

    # Decode bytes → numpy array → BGR image
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image — unsupported format or corrupt file.")

    # Grayscale + blur
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Canny edge detection
    edges = cv2.Canny(blurred, canny_low, canny_high)

    # Find contours on the edge map
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    px_per_sqft = pixels_per_foot ** 2
    areas_sqft: list[float] = []

    for cnt in contours:
        epsilon = approx_epsilon_ratio * cv2.arcLength(cnt, closed=True)
        approx = cv2.approxPolyDP(cnt, epsilon, closed=True)
        area_px = cv2.contourArea(approx)
        area_sqft = area_px / px_per_sqft
        if area_sqft >= min_area_sqft:
            areas_sqft.append(round(area_sqft, 2))

    areas_sqft.sort(reverse=True)

    return {
        "polygon_count": len(areas_sqft),
        "areas_sqft": areas_sqft,
        "total_area_sqft": round(sum(areas_sqft), 2),
        "largest_area_sqft": areas_sqft[0] if areas_sqft else 0.0,
    }


# ── Google Solar API ──────────────────────────────────────────────────────────

_SOLAR_BASE = "https://solar.googleapis.com/v1"


def solar_lookup(lat: float, lng: float, api_key: str | None = None) -> dict[str, Any]:
    """
    Call Google Solar API buildingInsights endpoint for the building closest
    to (lat, lng) and return DSM metadata, roof area, and flux map info.

    Parameters
    ----------
    lat     : latitude
    lng     : longitude
    api_key : Google Maps API key (defaults to GOOGLE_MAPS_API_KEY env var)
    """
    key = api_key or os.getenv("GOOGLE_MAPS_API_KEY", "")
    if not key:
        return {"error": "GOOGLE_MAPS_API_KEY not configured", "data": None}

    url = f"{_SOLAR_BASE}/buildingInsights:findClosest"
    params = {
        "location.latitude": lat,
        "location.longitude": lng,
        "requiredQuality": "HIGH",
        "key": key,
    }

    try:
        resp = httpx.get(url, params=params, timeout=_HTTP_TIMEOUT)
        resp.raise_for_status()
        raw = resp.json()
    except httpx.HTTPStatusError as exc:
        logger.error("Solar API HTTP error: %s", exc.response.text)
        return {"error": f"Solar API returned HTTP {exc.response.status_code}", "data": None}
    except httpx.RequestError as exc:
        logger.error("Solar API request error: %s", exc)
        return {"error": str(exc), "data": None}

    # Extract the most useful fields for a paving takeoff
    si = raw.get("solarPotential", {})
    return {
        "error": None,
        "data": {
            "name": raw.get("name"),
            "center": raw.get("center"),
            "imagery_date": raw.get("imageryDate"),
            "imagery_quality": raw.get("imageryQuality"),
            "roof_segment_count": len(si.get("roofSegmentStats", [])),
            "whole_roof_stats": si.get("wholeRoofStats"),
            "max_array_area_m2": si.get("maxArrayAreaMeters2"),
            "max_sunshine_hours_per_year": si.get("maxSunshineHoursPerYear"),
            "carbon_offset_kg": si.get("carbonOffsetFactorKgPerMwh"),
            "dsm_url": raw.get("dsmUrl"),
            "rgb_url": raw.get("rgbUrl"),
            "mask_url": raw.get("maskUrl"),
            "annual_flux_url": raw.get("annualFluxUrl"),
            "monthly_flux_url": raw.get("monthlyFluxUrl"),
        },
    }


# ── Google Aerial View API ────────────────────────────────────────────────────

_AERIAL_BASE = "https://aerialview.googleapis.com/v1"


def aerial_view_lookup(address: str, api_key: str | None = None) -> dict[str, Any]:
    """
    Call Google Aerial View API to retrieve a cinematic 3D video URL for
    the given address.

    The API first geocodes the address, then returns a signed video URL
    valid for a limited time window.

    Parameters
    ----------
    address : street address string
    api_key : Google Maps API key (defaults to GOOGLE_MAPS_API_KEY env var)
    """
    key = api_key or os.getenv("GOOGLE_MAPS_API_KEY", "")
    if not key:
        return {"error": "GOOGLE_MAPS_API_KEY not configured", "data": None}

    url = f"{_AERIAL_BASE}/videos:lookupVideo"
    params = {"address": address, "key": key}

    try:
        resp = httpx.get(url, params=params, timeout=_HTTP_TIMEOUT)
        resp.raise_for_status()
        raw = resp.json()
    except httpx.HTTPStatusError as exc:
        logger.error("Aerial View API HTTP error: %s", exc.response.text)
        return {"error": f"Aerial View API returned HTTP {exc.response.status_code}", "data": None}
    except httpx.RequestError as exc:
        logger.error("Aerial View API request error: %s", exc)
        return {"error": str(exc), "data": None}

    uris = raw.get("uris", {})
    return {
        "error": None,
        "data": {
            "state": raw.get("state"),
            "video_id": raw.get("videoId"),
            "mp4_url": uris.get("mp4", {}).get("landscapeUri"),
            "mp4_portrait_url": uris.get("mp4", {}).get("portraitUri"),
            "image_url": uris.get("image", {}).get("landscapeUri"),
        },
    }
