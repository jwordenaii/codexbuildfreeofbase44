"""
Takeoff endpoints for the JWordenAI Command Center.

Routes:
  POST /api/v1/takeoff/solar    — Google Solar API (DSM + flux data)
  POST /api/v1/takeoff/measure  — OpenCV image measurement pipeline
  GET  /api/v1/takeoff/aerial   — Google Aerial View API (3D video URL)
"""

import logging
import json
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..core.limiter import limiter
from ..database import get_db
from ..models import GroundScanReport
from ..services.vision_takeoff import aerial_view_lookup, measure_image_areas, solar_lookup

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/takeoff", tags=["takeoff"])

_MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB
_CRITICAL_UTILITY_TYPES = {"gas", "electric", "fiber", "water", "sewer"}


class UtilityFinding(BaseModel):
    utility_type: str = Field(..., max_length=60, description="gas | electric | water | sewer | fiber | storm | unknown")
    depth_inches: Optional[float] = Field(default=None, ge=0, le=240)
    confidence: Optional[float] = Field(default=None, ge=0, le=1)
    marked: bool = False
    notes: Optional[str] = Field(default=None, max_length=500)


class GroundScanRequest(BaseModel):
    address: Optional[str] = Field(default=None, max_length=300)
    project_site_id: Optional[int] = None
    scan_area_sqft: Optional[float] = Field(default=None, ge=0, le=20_000_000)
    ticket_811: Optional[str] = Field(default=None, max_length=100)
    ticket_status: Optional[str] = Field(default=None, max_length=40, description="not_started | requested | clear | conflict | expired")
    technologies: list[str] = Field(default_factory=list, description="GPR, EM locator, LiDAR, potholing, thermal, GIS overlay, drone photogrammetry")
    utilities: list[UtilityFinding] = Field(default_factory=list)
    soil_moisture: Optional[str] = Field(default=None, max_length=40, description="dry | normal | saturated")
    anomalies_detected: bool = False
    notes: Optional[str] = Field(default=None, max_length=5000)


class PavementDecayRequest(BaseModel):
    pavement_type: str = Field(..., max_length=40, description="residential_driveway | commercial_parking_lot | road")
    age_years: float = Field(..., ge=0, le=80)
    area_sqft: Optional[float] = Field(default=None, ge=0, le=20_000_000)
    current_condition_score: Optional[float] = Field(default=None, ge=0, le=100, description="PCI-style score, 100=new")
    traffic_level: str = Field(default="medium", max_length=30, description="low | medium | high | heavy_truck")
    drainage_quality: str = Field(default="fair", max_length=30, description="good | fair | poor")
    crack_severity: str = Field(default="none", max_length=30, description="none | low | medium | high")
    potholes: int = Field(default=0, ge=0, le=10000)
    rutting_inches: Optional[float] = Field(default=0, ge=0, le=12)
    last_sealcoat_years: Optional[float] = Field(default=None, ge=0, le=30)
    freeze_thaw: bool = True


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


# ── Civil-tech utility locating / ground scan ────────────────────────────────

def _ground_scan_analysis(req: GroundScanRequest) -> dict:
    tech = {t.lower().replace("-", " ").replace("_", " ") for t in req.technologies}
    score = 0
    findings: list[str] = []

    if req.ticket_status != "clear":
        score += 35
        findings.append("811 ticket is not marked clear.")
    if "gpr" not in tech and "ground penetrating radar" not in tech:
        score += 18
        findings.append("GPR sweep missing for unknown/abandoned utilities.")
    if "em locator" not in tech and "electromagnetic locator" not in tech and "utility locator" not in tech:
        score += 14
        findings.append("Electromagnetic locating pass missing for conductive utilities.")
    if "potholing" not in tech and "vacuum excavation" not in tech:
        score += 16
        findings.append("No daylighting/vacuum potholing confirmation listed.")
    if req.soil_moisture == "saturated":
        score += 8
        findings.append("Saturated soil may reduce detection confidence and increase trench instability.")
    if req.anomalies_detected:
        score += 18
        findings.append("Unresolved subsurface anomalies detected.")

    critical_unmarked = [
        u for u in req.utilities
        if u.utility_type.lower() in _CRITICAL_UTILITY_TYPES and not u.marked
    ]
    if critical_unmarked:
        score += 25
        findings.append("Critical utilities are present but not marked/confirmed.")

    low_confidence = [u for u in req.utilities if u.confidence is not None and u.confidence < 0.75]
    if low_confidence:
        score += 10
        findings.append("One or more utility detections are below 75% confidence.")

    if score >= 70:
        risk = "HIGH"
    elif score >= 35:
        risk = "MEDIUM"
    else:
        risk = "LOW"

    recommended_steps = []
    if req.ticket_status != "clear":
        recommended_steps.append("Request/refresh 811 ticket and wait for all utility owner responses before excavation.")
    if "gpr" not in tech and "ground penetrating radar" not in tech:
        recommended_steps.append("Run a GPR grid scan across the dig/patch limits and mark anomalies.")
    if "em locator" not in tech and "electromagnetic locator" not in tech and "utility locator" not in tech:
        recommended_steps.append("Run active/passive EM locating for power, tracer wire, telecom, and metallic services.")
    if critical_unmarked or req.anomalies_detected:
        recommended_steps.append("Use vacuum excavation/potholing to daylight crossings before sawcut, milling, or excavation.")
    if not recommended_steps:
        recommended_steps.append("Proceed with documented marks, photos, and tolerance-zone hand digging per local law.")

    confidence = max(0.35, min(0.98, 0.95 - (score / 180)))
    return {
        "risk_level": risk,
        "confidence": round(confidence, 2),
        "findings": findings or ["No major locate gaps identified from submitted data."],
        "recommended_steps": recommended_steps,
        "recommended_tech_stack": [
            "811 ticket + positive response audit",
            "GPR grid scan",
            "EM active/passive utility locating",
            "GIS/as-built overlay",
            "LiDAR/drone surface capture for plan overlay",
            "Vacuum potholing for conflict verification",
            "Photo log + mark-out map before sawcut/dig",
        ],
        "recommendation": (
            "Do not excavate until HIGH/MEDIUM risk items are closed. "
            "Treat unknown anomalies as live utilities until daylighted."
            if risk != "LOW"
            else "Locate package looks dig-ready; keep tolerance-zone hand-digging and photo documentation in place."
        ),
    }


@router.post("/ground-scan", summary="Analyze civil-tech utility locating and subsurface scan before digging")
@limiter.limit("30/minute")
async def ground_scan(request: Request, req: GroundScanRequest, db: Session = Depends(get_db)):
    analysis = _ground_scan_analysis(req)
    report = GroundScanReport(
        project_site_id=req.project_site_id,
        address=req.address,
        scan_area_sqft=req.scan_area_sqft,
        ticket_811=req.ticket_811,
        ticket_status=req.ticket_status,
        technologies_json=json.dumps(req.technologies),
        utilities_json=json.dumps([u.model_dump() for u in req.utilities]),
        risk_level=analysis["risk_level"],
        confidence=analysis["confidence"],
        recommendation=analysis["recommendation"],
        notes=req.notes,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return {"status": "ok", "report_id": report.id, **analysis}


# ── Pavement scanning / age-decay simulation ─────────────────────────────────

def _base_condition(req: PavementDecayRequest) -> float:
    if req.current_condition_score is not None:
        return req.current_condition_score
    base = 100 - (req.age_years * 4.2)
    if req.pavement_type in {"commercial_parking_lot", "road"}:
        base -= 5
    return max(5, min(100, base))


def _annual_decay(req: PavementDecayRequest) -> float:
    decay = 3.0
    decay += {"low": 0.0, "medium": 1.0, "high": 2.2, "heavy_truck": 4.0}.get(req.traffic_level, 1.0)
    decay += {"good": 0.0, "fair": 1.0, "poor": 3.0}.get(req.drainage_quality, 1.0)
    decay += {"none": 0.0, "low": 0.8, "medium": 2.0, "high": 4.0}.get(req.crack_severity, 0.0)
    decay += min(5.0, req.potholes * 0.25)
    decay += min(4.0, (req.rutting_inches or 0) * 1.5)
    if req.freeze_thaw:
        decay += 1.2
    if req.last_sealcoat_years is None or req.last_sealcoat_years > 4:
        decay += 1.0
    return decay


@router.post("/pavement-decay", summary="Road, parking lot, and driveway age-decay simulation")
@limiter.limit("60/minute")
async def pavement_decay(request: Request, req: PavementDecayRequest):
    pci_now = _base_condition(req)
    annual = _annual_decay(req)
    projection = []
    for year in [0, 1, 3, 5, 10]:
        score = max(0, round(pci_now - annual * year, 1))
        if score >= 80:
            band = "excellent"
        elif score >= 65:
            band = "good"
        elif score >= 45:
            band = "fair"
        elif score >= 25:
            band = "poor"
        else:
            band = "failed"
        projection.append({"year": year, "condition_score": score, "condition_band": band})

    if pci_now < 35 or req.potholes > 10 or (req.rutting_inches or 0) >= 1.5:
        action = "Full-depth repair or overlay evaluation recommended now."
        risk = "HIGH"
    elif pci_now < 55 or req.crack_severity in {"medium", "high"}:
        action = "Crack fill, patching, drainage correction, and overlay planning recommended."
        risk = "MEDIUM"
    else:
        action = "Preventive maintenance: sealcoat, crack fill, and annual inspection."
        risk = "LOW"

    return {
        "status": "ok",
        "pavement_type": req.pavement_type,
        "current_condition_score": round(pci_now, 1),
        "annual_decay_points": round(annual, 1),
        "risk_level": risk,
        "projection": projection,
        "recommended_action": action,
        "scan_stack": [
            "visual PCI survey",
            "drone orthomosaic / LiDAR surface model",
            "thermal/moisture anomaly review",
            "GPR pavement thickness and base void scan",
            "core sample or FWD verification for commercial/road projects",
        ],
    }
