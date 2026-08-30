"""
drone_scan.py — Drone-based site capture ingest for JWordenAI.

Routes:
  POST /api/v1/sites/{site_id}/drone-scan   — store a new drone scan record
  GET  /api/v1/sites/{site_id}/drone-scans  — list all scans for a site
  GET  /api/v1/drone-scans/{scan_id}        — retrieve a single scan

Accepts photogrammetry, LiDAR, thermal, and RGB flight data.  When
OPENAI_API_KEY is set and ``findings_json`` is provided, an AI summary
of detected deviations is generated automatically.

Requires premium security on all endpoints.
"""

import json
import logging
import os
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..core.security import verify_premium_security
from ..database import get_db
from ..models import DroneScan, ProjectSite

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["drone-scan"])

_OPENAI_KEY = os.getenv("OPENAI_API_KEY", "")


# ── Schemas ───────────────────────────────────────────────────────────────────

class DroneScanRequest(BaseModel):
    scan_type:          str            = Field("photogrammetry", pattern=r"^(photogrammetry|lidar|thermal|rgb)$")
    operator_name:      Optional[str]  = Field(None, max_length=120)
    drone_model:        Optional[str]  = Field(None, max_length=120)
    flight_altitude_ft: Optional[float] = Field(None, ge=0, le=1500)
    coverage_sqft:      Optional[float] = Field(None, ge=0)
    resolution_cm:      Optional[float] = Field(None, ge=0)
    geojson_url:        Optional[str]  = Field(None, max_length=500)
    geojson_summary:    Optional[str]  = None   # GeoJSON FeatureCollection as string
    findings_json:      Optional[str]  = None   # JSON array of {issue, severity, lat, lng}
    deviation_count:    Optional[int]  = Field(None, ge=0)
    risk_level:         str            = Field("UNKNOWN", pattern=r"^(LOW|MEDIUM|HIGH|CRITICAL|UNKNOWN)$")
    notes:              Optional[str]  = None
    tenant_id:          Optional[str]  = Field(None, max_length=60)


class DroneScanResponse(BaseModel):
    id:                 int
    project_site_id:    int
    scan_type:          str
    operator_name:      Optional[str]
    drone_model:        Optional[str]
    flight_altitude_ft: Optional[float]
    coverage_sqft:      Optional[float]
    resolution_cm:      Optional[float]
    geojson_url:        Optional[str]
    deviation_count:    Optional[int]
    risk_level:         str
    ai_summary:         Optional[str]
    scanned_at:         datetime
    created_at:         datetime

    class Config:
        from_attributes = True


# ── AI summary helper ─────────────────────────────────────────────────────────

def _generate_ai_summary(scan_type: str, findings_json: Optional[str], risk_level: str) -> Optional[str]:
    """Generate a plain-English deviation summary via GPT-4o if key is set."""
    if not findings_json:
        return None
    try:
        findings = json.loads(findings_json) if isinstance(findings_json, str) else findings_json
        count = len(findings) if isinstance(findings, list) else "unknown"
    except (json.JSONDecodeError, TypeError):
        count = "unknown"
        findings = []

    try:
        from ..services.llm_client import chat as llm_chat  # noqa: PLC0415

        prompt = (
            f"A drone {scan_type} scan of a paving site detected {count} deviation(s) "
            f"with an overall risk level of {risk_level}.\n"
            f"Findings: {json.dumps(findings[:10])}\n\n"
            "Write a concise (2-3 sentence) field summary a foreman can act on immediately. "
            "Focus on the highest-severity items and the recommended corrective action."
        )
        result = llm_chat(task="fast", user=prompt, max_tokens=200, temperature=0.3)
        if result.error or not (result.text or "").strip():
            return None
        return result.text.strip()
    except Exception as exc:
        logger.warning("Drone scan AI summary failed: %s", exc)
        return None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "/sites/{site_id}/drone-scan",
    response_model=DroneScanResponse,
    status_code=201,
    dependencies=[Depends(verify_premium_security)],
)
def ingest_drone_scan(
    site_id: int,
    req: DroneScanRequest,
    db: Session = Depends(get_db),
):
    """
    Store a drone scan record for a project site.

    If ``findings_json`` is supplied and OPENAI_API_KEY is set, an AI
    field summary is generated automatically and stored in ``ai_summary``.
    """
    site = db.query(ProjectSite).filter(ProjectSite.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail=f"Project site {site_id} not found.")

    ai_summary = _generate_ai_summary(req.scan_type, req.findings_json, req.risk_level)

    scan = DroneScan(
        project_site_id    = site_id,
        scan_type          = req.scan_type,
        operator_name      = req.operator_name,
        drone_model        = req.drone_model,
        flight_altitude_ft = req.flight_altitude_ft,
        coverage_sqft      = req.coverage_sqft,
        resolution_cm      = req.resolution_cm,
        geojson_url        = req.geojson_url,
        geojson_summary    = req.geojson_summary,
        findings_json      = req.findings_json,
        ai_summary         = ai_summary,
        deviation_count    = req.deviation_count or 0,
        risk_level         = req.risk_level,
        notes              = req.notes,
        tenant_id          = req.tenant_id or "default",
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)
    logger.info(
        "Drone scan stored: id=%s site=%s type=%s risk=%s deviations=%s",
        scan.id, site_id, scan.scan_type, scan.risk_level, scan.deviation_count,
    )
    return scan


@router.get(
    "/sites/{site_id}/drone-scans",
    response_model=List[DroneScanResponse],
    dependencies=[Depends(verify_premium_security)],
)
def list_drone_scans(site_id: int, db: Session = Depends(get_db)):
    """Return all drone scans for a site, newest first."""
    return (
        db.query(DroneScan)
        .filter(DroneScan.project_site_id == site_id)
        .order_by(DroneScan.scanned_at.desc())
        .all()
    )


@router.get(
    "/drone-scans/{scan_id}",
    response_model=DroneScanResponse,
    dependencies=[Depends(verify_premium_security)],
)
def get_drone_scan(scan_id: int, db: Session = Depends(get_db)):
    """Return a single drone scan record."""
    scan = db.query(DroneScan).filter(DroneScan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail=f"Drone scan {scan_id} not found.")
    return scan
