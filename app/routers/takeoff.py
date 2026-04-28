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
_MIN_SCAN_CONFIDENCE = 0.35
_MAX_SCAN_CONFIDENCE = 0.98
_BASE_SCAN_CONFIDENCE = 0.95
_SCAN_RISK_NORMALIZER = 180
_GROUND_RISK_SCORE = {"LOW": 92, "MEDIUM": 68, "HIGH": 38}
_TRAFFIC_LOAD_SCORE = {"low": 94, "medium": 84, "high": 70, "heavy_truck": 56}
_DRAINAGE_SCORE_PENALTY = {"good": 0, "fair": 18, "poor": 38}
_PAVEMENT_TRAFFIC_DECAY = {"low": 0.0, "medium": 1.0, "high": 2.2, "heavy_truck": 4.0}
_PAVEMENT_DRAINAGE_DECAY = {"good": 0.0, "fair": 1.0, "poor": 3.0}
_PAVEMENT_CRACK_DECAY = {"none": 0.0, "low": 0.8, "medium": 2.0, "high": 4.0}
_PREMIUM_MODULE_WEIGHTS = {
    "utility": 0.24,
    "gpr": 0.16,
    "pavement": 0.18,
    "thermal": 0.12,
    "drainage": 0.14,
    "traffic": 0.10,
    "potholing": 0.06,
}


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


class PremiumCivilStackRequest(BaseModel):
    address: Optional[str] = Field(default=None, max_length=300)
    scan_area_sqft: Optional[float] = Field(default=None, ge=0, le=20_000_000)
    ticket_status: Optional[str] = Field(default="requested", max_length=40)
    technologies: list[str] = Field(default_factory=list)
    utilities: list[UtilityFinding] = Field(default_factory=list)
    soil_moisture: Optional[str] = Field(default="normal", max_length=40)
    anomalies_detected: bool = False
    pavement_type: str = Field(default="commercial_parking_lot", max_length=40)
    age_years: float = Field(default=8, ge=0, le=80)
    current_condition_score: Optional[float] = Field(default=None, ge=0, le=100)
    traffic_level: str = Field(default="high", max_length=30)
    drainage_quality: str = Field(default="fair", max_length=30)
    crack_severity: str = Field(default="medium", max_length=30)
    potholes: int = Field(default=2, ge=0, le=10000)
    rutting_inches: Optional[float] = Field(default=0.25, ge=0, le=12)
    last_sealcoat_years: Optional[float] = Field(default=4, ge=0, le=30)
    freeze_thaw: bool = True
    asphalt_temp_f: Optional[float] = Field(default=None, ge=0, le=600)
    target_delivery_temp_f: float = Field(default=275, ge=0, le=600)
    estimated_arrival_minutes: Optional[float] = Field(default=None, ge=0, le=24 * 60)


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

    # Confidence starts near 95% for complete locate packages and degrades as
    # unresolved utility, 811, GPR, EM, potholing, and anomaly risks accumulate.
    confidence = max(
        _MIN_SCAN_CONFIDENCE,
        min(_MAX_SCAN_CONFIDENCE, _BASE_SCAN_CONFIDENCE - (score / _SCAN_RISK_NORMALIZER)),
    )
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
    decay += _PAVEMENT_TRAFFIC_DECAY.get(req.traffic_level, 1.0)
    decay += _PAVEMENT_DRAINAGE_DECAY.get(req.drainage_quality, 1.0)
    decay += _PAVEMENT_CRACK_DECAY.get(req.crack_severity, 0.0)
    decay += min(5.0, req.potholes * 0.25)
    decay += min(4.0, (req.rutting_inches or 0) * 1.5)
    if req.freeze_thaw:
        decay += 1.2
    if req.last_sealcoat_years is None or req.last_sealcoat_years > 4:
        decay += 1.0
    return decay


def _condition_band(score: float) -> str:
    if score >= 80:
        return "excellent"
    if score >= 65:
        return "good"
    if score >= 45:
        return "fair"
    if score >= 25:
        return "poor"
    return "failed"


def _risk_from_score(score: float) -> str:
    if score >= 80:
        return "LOW"
    if score >= 55:
        return "MEDIUM"
    return "HIGH"


@router.post("/pavement-decay", summary="Road, parking lot, and driveway age-decay simulation")
@limiter.limit("60/minute")
async def pavement_decay(request: Request, req: PavementDecayRequest):
    pci_now = _base_condition(req)
    annual = _annual_decay(req)
    projection = []
    for year in [0, 1, 3, 5, 10]:
        score = max(0, round(pci_now - annual * year, 1))
        projection.append({"year": year, "condition_score": score, "condition_band": _condition_band(score)})

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


def _premium_module(name: str, title: str, score: float, summary: str, actions: list[str], math: dict) -> dict:
    score = round(max(0, min(100, score)), 1)
    return {
        "name": name,
        "title": title,
        "score": score,
        "risk_level": _risk_from_score(score),
        "summary": summary,
        "actions": actions,
        "math": math,
    }


@router.post("/premium-civil-stack", summary="Seven premium autonomous civil-tech scan modules")
@limiter.limit("30/minute")
async def premium_civil_stack(request: Request, req: PremiumCivilStackRequest):
    tech = {t.lower().replace("-", " ").replace("_", " ") for t in req.technologies}
    ground_req = GroundScanRequest(
        address=req.address,
        scan_area_sqft=req.scan_area_sqft,
        ticket_status=req.ticket_status,
        technologies=req.technologies,
        utilities=req.utilities,
        soil_moisture=req.soil_moisture,
        anomalies_detected=req.anomalies_detected,
    )
    ground = _ground_scan_analysis(ground_req)
    pavement_req = PavementDecayRequest(
        pavement_type=req.pavement_type,
        age_years=req.age_years,
        current_condition_score=req.current_condition_score,
        traffic_level=req.traffic_level,
        drainage_quality=req.drainage_quality,
        crack_severity=req.crack_severity,
        potholes=req.potholes,
        rutting_inches=req.rutting_inches,
        last_sealcoat_years=req.last_sealcoat_years,
        freeze_thaw=req.freeze_thaw,
    )
    pci_now = _base_condition(pavement_req)
    annual_decay = _annual_decay(pavement_req)
    years_to_rehab = max(0, round((pci_now - 45) / annual_decay, 1)) if annual_decay else 30

    gpr_ready = "gpr" in tech or "ground penetrating radar" in tech
    em_ready = "em locator" in tech or "electromagnetic locator" in tech or "utility locator" in tech
    lidar_ready = "lidar" in tech or "drone photogrammetry" in tech or "drone" in tech
    pothole_ready = "potholing" in tech or "vacuum excavation" in tech
    thermal_ready = "thermal" in tech or "infrared" in tech
    gis_ready = "gis overlay" in tech or "as built" in tech or "as-built" in tech

    projected_temp = None
    if req.asphalt_temp_f is not None:
        projected_drop = min(35, (req.estimated_arrival_minutes or 0) * 0.18)
        projected_temp = req.asphalt_temp_f - projected_drop

    utility_score = _GROUND_RISK_SCORE[ground["risk_level"]]
    gpr_score = 50 + (22 if gpr_ready else 0) + (6 if em_ready else 0) + (12 if gis_ready else 0) + (10 if lidar_ready else 0) - (18 if req.anomalies_detected else 0)
    pavement_score = max(0, 100 - ((100 - pci_now) * 0.7) - (annual_decay * 2.2))
    thermal_score = (92 if thermal_ready else 84) if projected_temp is None else 100 - max(0, req.target_delivery_temp_f - projected_temp) * 1.8
    drainage_score = 92 - _DRAINAGE_SCORE_PENALTY.get(req.drainage_quality, 18) - (18 if req.soil_moisture == "saturated" else 0)
    traffic_score = _TRAFFIC_LOAD_SCORE.get(req.traffic_level, 84)
    autonomous_score = (
        utility_score * _PREMIUM_MODULE_WEIGHTS["utility"]
        + gpr_score * _PREMIUM_MODULE_WEIGHTS["gpr"]
        + pavement_score * _PREMIUM_MODULE_WEIGHTS["pavement"]
        + thermal_score * _PREMIUM_MODULE_WEIGHTS["thermal"]
        + drainage_score * _PREMIUM_MODULE_WEIGHTS["drainage"]
        + traffic_score * _PREMIUM_MODULE_WEIGHTS["traffic"]
        + (95 if pothole_ready else 60) * _PREMIUM_MODULE_WEIGHTS["potholing"]
    )

    modules = [
        _premium_module(
            "utility_locate_shield",
            "811 + Utility Locate Shield",
            utility_score,
            f"Utility locate package is {ground['risk_level']} risk with {int(ground['confidence'] * 100)}% confidence.",
            ground["recommended_steps"],
            {"risk_level": ground["risk_level"], "confidence": ground["confidence"]},
        ),
        _premium_module(
            "gpr_subsurface_digital_twin",
            "GPR Subsurface Digital Twin",
            gpr_score,
            "Combines GPR, GIS/as-built overlays, LiDAR/drone surface capture, and unresolved anomaly flags.",
            [
                "Run orthogonal GPR grid passes at utility crossings and sawcut limits.",
                "Overlay GPR anomaly picks with as-builts and drone/LiDAR surface control.",
            ],
            {"gpr_ready": gpr_ready, "gis_ready": gis_ready, "lidar_ready": lidar_ready, "anomalies_detected": req.anomalies_detected},
        ),
        _premium_module(
            "pavement_decay_digital_twin",
            "Pavement Age-Decay Digital Twin",
            pavement_score,
            f"Current condition is {_condition_band(pci_now)} at {round(pci_now, 1)}/100 with {round(annual_decay, 1)} points/year decay.",
            [
                "Use PCI survey, drone orthomosaic, thermal moisture review, and GPR/base verification.",
                f"Plan rehabilitation trigger in approximately {years_to_rehab} years if conditions do not improve.",
            ],
            {"current_condition_score": round(pci_now, 1), "annual_decay_points": round(annual_decay, 1), "years_to_rehab": years_to_rehab},
        ),
        _premium_module(
            "asphalt_thermal_delivery_ai",
            "Asphalt Thermal Delivery AI",
            thermal_score,
            "Models haul-time cooling against target delivery temperature for HMA/WMA load acceptance.",
            [
                "Use insulated beds, thermal ticketing, plant departure stamps, and infrared arrival checks.",
                "Escalate if projected arrival temperature falls below the job mix target.",
            ],
            {"asphalt_temp_f": req.asphalt_temp_f, "projected_arrival_temp_f": None if projected_temp is None else round(projected_temp, 1), "target_delivery_temp_f": req.target_delivery_temp_f},
        ),
        _premium_module(
            "drainage_moisture_failure_radar",
            "Drainage + Moisture Failure Radar",
            drainage_score,
            "Scores standing water, saturated subgrade risk, drainage quality, and moisture-driven pavement failure.",
            [
                "Correct ponding, edge failures, and base saturation before overlay.",
                "Use infrared/moisture survey after rain events for hidden wet-base zones.",
            ],
            {"drainage_quality": req.drainage_quality, "soil_moisture": req.soil_moisture},
        ),
        _premium_module(
            "traffic_load_phasing_optimizer",
            "Traffic Load + Phasing Optimizer",
            traffic_score,
            "Evaluates residential/commercial/road traffic severity and production phasing pressure.",
            [
                "Sequence heavy-truck areas, drive lanes, ADA routes, and business access windows.",
                "Use heavier section design or staged full-depth repair where truck loads concentrate.",
            ],
            {"traffic_level": req.traffic_level, "pavement_type": req.pavement_type},
        ),
        _premium_module(
            "autonomous_go_no_go_foreman",
            "Autonomous Go / No-Go Foreman",
            autonomous_score,
            "Blends all module scores into one production decision for dig, pave, overlay, or hold.",
            [
                "Proceed only after utility conflicts, thermal risk, drainage defects, and pavement failure triggers are closed.",
                "Attach scan logs, photos, 811 responses, and production notes to the job package.",
            ],
            {"weighted_score": round(autonomous_score, 1), "module_count": 7},
        ),
    ]

    return {
        "status": "ok",
        "module_count": len(modules),
        "overall_score": round(autonomous_score, 1),
        "overall_risk": _risk_from_score(autonomous_score),
        "decision": "GO" if autonomous_score >= 80 else "CONDITIONAL" if autonomous_score >= 55 else "HOLD",
        "modules": modules,
    }
