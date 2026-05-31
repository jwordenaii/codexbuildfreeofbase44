"""
compliance.py — 50-State contractor license verification & compliance tracking.

Routes:
  GET  /api/v1/compliance/verify          — verify a single license (live or static)
  POST /api/v1/compliance/verify-batch    — verify multiple licenses at once
  GET  /api/v1/compliance/matrix          — full 50-state reference matrix
  GET  /api/v1/compliance/state/{code}    — single-state reference data
  GET  /api/v1/compliance/history         — verification log history
  POST /api/v1/compliance/inspect         — vision-based PPE / site deviation check
  GET  /api/v1/compliance/status          — integration health check

Risk flagging logic:
  RED   — status != Active, OR expiration within 7 days, OR name mismatch
  AMBER — expiration within 30 days
  GREEN — Active and expiration > 30 days out

Requires premium security.
"""

import json
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..core.security import verify_premium_security
from ..database import get_db
from ..models import LicenseVerificationLog
from ..services.license_service import verifier
from ..services.vision_inspector import detect_deviations

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/compliance", tags=["compliance"])

_EXPIRY_RED_DAYS   = 7
_EXPIRY_AMBER_DAYS = 30


# ── Schemas ───────────────────────────────────────────────────────────────────

class LicenseVerifyRequest(BaseModel):
    state_code:      str = Field(..., min_length=2, max_length=2)
    license_number:  str = Field(..., min_length=1, max_length=100)
    expected_name:   Optional[str] = Field(None, max_length=200)
    subcontractor_id: Optional[int] = None
    tenant_id:       Optional[str]  = Field(None, max_length=60)


class LicenseBatchVerifyRequest(BaseModel):
    licenses: List[LicenseVerifyRequest] = Field(..., min_length=1, max_length=50)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _risk_color(result: dict, expected_name: Optional[str] = None) -> str:
    """Derive RED / AMBER / GREEN traffic-light status from a verification result."""
    if result.get("status", "Unknown") != "Active":
        return "RED"
    days = result.get("days_until_exp")
    if days is not None and days <= _EXPIRY_RED_DAYS:
        return "RED"
    if expected_name and result.get("entity_name"):
        if expected_name.lower().strip() not in result["entity_name"].lower():
            return "RED"
    if days is not None and days <= _EXPIRY_AMBER_DAYS:
        return "AMBER"
    return "GREEN"


def _persist_log(db: Session, result: dict, req: LicenseVerifyRequest) -> None:
    """Write an immutable audit record for this verification check."""
    from datetime import datetime, timezone
    try:
        exp_dt = None
        if result.get("expiration"):
            for fmt in ("%Y-%m-%d", "%m/%d/%Y"):
                try:
                    exp_dt = datetime.strptime(result["expiration"], fmt).replace(tzinfo=timezone.utc)
                    break
                except ValueError:
                    continue

        log = LicenseVerificationLog(
            entity_name      = result.get("entity_name"),
            state_code       = result["state_code"],
            license_number   = result["license_number"],
            license_type     = result.get("license_type"),
            status           = result.get("status", "Unknown"),
            expiration_date  = exp_dt,
            days_until_exp   = result.get("days_until_exp"),
            is_compliant     = result.get("is_compliant", False),
            api_source       = result.get("api_source"),
            raw_json         = result.get("raw_json"),
            subcontractor_id = req.subcontractor_id,
            tenant_id        = req.tenant_id or "default",
        )
        db.add(log)
        db.commit()
    except Exception as exc:
        logger.warning("Failed to persist license verification log: %s", exc)
        db.rollback()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/status", dependencies=[Depends(verify_premium_security)])
def compliance_status():
    """Health check — reports which verification provider is active."""
    import os
    return {
        "status": "ok",
        "provider": os.getenv("LICENSE_VERIFY_PROVIDER", "auto"),
        "apify_key_set":   bool(os.getenv("LICENSE_VERIFY_API_KEY")),
        "shovels_key_set": bool(os.getenv("SHOVELS_API_KEY")),
        "states_in_matrix": 51,   # 50 states + DC
        "nascla_reciprocity_states": 8,
    }


@router.get("/verify", dependencies=[Depends(verify_premium_security)])
def verify_license(
    state: str,
    license_num: str,
    expected_name: Optional[str] = None,
    subcontractor_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """
    Verify a single contractor license.

    Returns live API data when a key is configured; falls back to 50-state
    static reference matrix otherwise.
    """
    result = verifier.verify_contractor(state.upper(), license_num)
    color  = _risk_color(result, expected_name)
    result["risk_color"] = color

    req = LicenseVerifyRequest(
        state_code=state.upper(),
        license_number=license_num,
        expected_name=expected_name,
        subcontractor_id=subcontractor_id,
    )
    _persist_log(db, result, req)
    return result


@router.post("/verify-batch", dependencies=[Depends(verify_premium_security)])
def verify_license_batch(req: LicenseBatchVerifyRequest, db: Session = Depends(get_db)):
    """
    Verify up to 50 licenses in one call.  Useful for daily subcontractor sweeps.

    Returns a summary with overall compliance rate and per-license results.
    """
    results = []
    for lic in req.licenses:
        r = verifier.verify_contractor(lic.state_code.upper(), lic.license_number)
        r["risk_color"] = _risk_color(r, lic.expected_name)
        _persist_log(db, r, lic)
        results.append(r)

    compliant = sum(1 for r in results if r.get("is_compliant"))
    red_flags = [r for r in results if r.get("risk_color") == "RED"]

    return {
        "total":            len(results),
        "compliant":        compliant,
        "compliance_rate":  round(compliant / len(results) * 100, 1) if results else 0.0,
        "red_flags":        len(red_flags),
        "results":          results,
    }


@router.get("/matrix", dependencies=[Depends(verify_premium_security)])
def get_compliance_matrix():
    """Return the full 50-state + DC licensing reference matrix."""
    return {"states": verifier.get_matrix()}


@router.get("/state/{code}", dependencies=[Depends(verify_premium_security)])
def get_state_info(code: str):
    """Return licensing requirements for a specific state (2-letter code)."""
    info = verifier.get_state_info(code.upper())
    if "error" in info:
        raise HTTPException(status_code=404, detail=info["error"])
    return info


@router.get("/history", dependencies=[Depends(verify_premium_security)])
def get_verification_history(
    state_code:     Optional[str] = None,
    license_number: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """Return recent verification audit log entries, newest first."""
    q = db.query(LicenseVerificationLog)
    if state_code:
        q = q.filter(LicenseVerificationLog.state_code == state_code.upper())
    if license_number:
        q = q.filter(LicenseVerificationLog.license_number == license_number)
    records = q.order_by(LicenseVerificationLog.checked_at.desc()).limit(limit).all()
    return [
        {
            "id":             r.id,
            "entity_name":    r.entity_name,
            "state_code":     r.state_code,
            "license_number": r.license_number,
            "status":         r.status,
            "is_compliant":   r.is_compliant,
            "days_until_exp": r.days_until_exp,
            "api_source":     r.api_source,
            "checked_at":     r.checked_at.isoformat() if r.checked_at else None,
        }
        for r in records
    ]


@router.post("/inspect", dependencies=[Depends(verify_premium_security)])
async def inspect_site_image(file: UploadFile = File(...)):
    """
    Run YOLO-based PPE and site deviation detection on an uploaded image.

    Accepts JPEG or PNG.  Returns structured findings with risk level.
    When ultralytics is not installed, returns a stub result.
    """
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=400, detail="Only JPEG/PNG/WEBP images accepted.")

    image_bytes = await file.read()
    if len(image_bytes) > 20 * 1024 * 1024:  # 20 MB cap
        raise HTTPException(status_code=413, detail="Image too large (20 MB max).")

    return detect_deviations(image_bytes=image_bytes)
