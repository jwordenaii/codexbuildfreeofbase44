"""
admin_2fa.py — TOTP two-factor authentication management for the admin dashboard.

All endpoints require the existing HTTP Basic admin credentials.  They are
JSON-only (not HTML) and are excluded from the public OpenAPI schema.

Routes
------
POST /api/v1/admin/2fa/setup    — Generate a new TOTP secret + QR code
POST /api/v1/admin/2fa/verify   — Confirm the first token to activate 2FA
POST /api/v1/admin/2fa/disable  — Disable 2FA (requires current password)
GET  /api/v1/admin/2fa/status   — Check whether 2FA is currently enabled
"""

from __future__ import annotations

import json
import logging
import os
import secrets

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import TwoFactorSecret
from ..services.totp_service import TOTPService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/admin/2fa",
    tags=["admin-2fa"],
    include_in_schema=False,
)

security = HTTPBasic()


# ── Auth dependency (mirrors admin.py) ────────────────────────────────────────

def _require_admin(credentials: HTTPBasicCredentials = Depends(security)) -> str:
    """Verify HTTP Basic credentials; return the username on success."""
    admin_user = os.getenv("ADMIN_USERNAME", "admin").encode()
    admin_pass = os.getenv("ADMIN_PASSWORD", "").encode()

    if not admin_pass:
        raise HTTPException(
            status_code=503,
            detail="Admin dashboard is not configured. Set ADMIN_PASSWORD.",
        )

    user_ok = secrets.compare_digest(credentials.username.encode(), admin_user)
    pass_ok = secrets.compare_digest(credentials.password.encode(), admin_pass)

    if not (user_ok and pass_ok):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized",
            headers={"WWW-Authenticate": 'Basic realm="JWordenAI Admin"'},
        )
    return credentials.username


# ── Request / response schemas ────────────────────────────────────────────────

class VerifyRequest(BaseModel):
    token: str  # 6-digit TOTP code from the authenticator app


class DisableRequest(BaseModel):
    password: str   # Current admin password (re-confirmation)
    token: str      # Current TOTP token OR a backup code


class StatusResponse(BaseModel):
    enabled: bool
    has_backup_codes: bool
    backup_codes_remaining: int


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_or_none(db: Session, user_id: str) -> TwoFactorSecret | None:
    return db.query(TwoFactorSecret).filter(TwoFactorSecret.user_id == user_id).first()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/setup", summary="Start 2FA setup — returns QR code and secret")
def setup_2fa(
    username: str = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    """
    Generate a fresh TOTP secret for the authenticated admin user.

    If a record already exists it is replaced (allows re-setup after a lost
    device).  The returned QR code should be scanned with an authenticator app.
    2FA is **not** enforced at login until ``POST /verify`` is called with a
    valid token.

    Response fields:
    - ``secret``      — base32 seed for manual entry
    - ``otpauth_url`` — otpauth:// URI
    - ``qr_code_uri`` — data:image/png;base64,… (embed directly in an <img>)
    - ``backup_codes``— list of 10 one-time recovery codes (show once, store safely)
    """
    totp_data = TOTPService.generate_secret(username)
    backup_codes = TOTPService.generate_backup_codes()

    existing = _get_or_none(db, username)
    if existing:
        existing.secret = totp_data["secret"]
        existing.backup_codes = json.dumps(backup_codes)
        existing.enabled = False
        logger.info("2FA secret regenerated for user=%s", username)
    else:
        record = TwoFactorSecret(
            user_id=username,
            secret=totp_data["secret"],
            backup_codes=json.dumps(backup_codes),
            enabled=False,
        )
        db.add(record)
        logger.info("2FA secret created for user=%s", username)

    db.commit()

    return {
        "secret": totp_data["secret"],
        "otpauth_url": totp_data["otpauth_url"],
        "qr_code_uri": totp_data["qr_code_uri"],
        "backup_codes": backup_codes,
        "message": (
            "Scan the QR code with your authenticator app, then call POST /verify "
            "with a valid token to activate 2FA. Store the backup codes safely — "
            "they will not be shown again."
        ),
    }


@router.post("/verify", summary="Verify TOTP token to activate 2FA")
def verify_2fa(
    body: VerifyRequest,
    username: str = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    """
    Confirm the first TOTP token after scanning the QR code.

    A valid token activates 2FA — subsequent logins will require a TOTP code.
    Returns ``{"enabled": true}`` on success.
    """
    record = _get_or_none(db, username)
    if not record:
        raise HTTPException(
            status_code=404,
            detail="No 2FA setup found. Call POST /setup first.",
        )

    if not TOTPService.verify_token(record.secret, body.token):
        logger.warning("2FA verify failed for user=%s (bad token)", username)
        raise HTTPException(status_code=400, detail="Invalid TOTP token. Check your authenticator app and try again.")

    record.enabled = True
    db.commit()
    logger.info("2FA enabled for user=%s", username)
    return {"enabled": True, "message": "Two-factor authentication is now active."}


@router.post("/disable", summary="Disable 2FA (requires password + current TOTP token)")
def disable_2fa(
    body: DisableRequest,
    username: str = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    """
    Disable two-factor authentication for the authenticated admin.

    Requires both the current admin password and a valid TOTP token (or a
    backup code) to prevent accidental or unauthorised disablement.
    """
    # Re-verify password explicitly (defence-in-depth beyond Basic auth)
    admin_pass = os.getenv("ADMIN_PASSWORD", "")
    if not secrets.compare_digest(body.password.encode(), admin_pass.encode()):
        raise HTTPException(status_code=403, detail="Incorrect password.")

    record = _get_or_none(db, username)
    if not record or not record.enabled:
        raise HTTPException(status_code=400, detail="2FA is not currently enabled.")

    # Accept either a live TOTP token or a backup code
    token_valid = TOTPService.verify_token(record.secret, body.token)
    if not token_valid:
        # Try backup codes
        ok, updated_json = TOTPService.verify_backup_code(
            record.backup_codes or "[]", body.token
        )
        if ok:
            record.backup_codes = updated_json
        else:
            logger.warning("2FA disable rejected for user=%s (bad token/backup code)", username)
            raise HTTPException(
                status_code=400,
                detail="Invalid TOTP token or backup code.",
            )

    record.enabled = False
    db.commit()
    logger.info("2FA disabled for user=%s", username)
    return {"enabled": False, "message": "Two-factor authentication has been disabled."}


@router.get("/status", response_model=StatusResponse, summary="Check 2FA status")
def status_2fa(
    username: str = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    """
    Return the current 2FA status for the authenticated admin user.

    Response fields:
    - ``enabled``               — whether 2FA is enforced at login
    - ``has_backup_codes``      — whether any backup codes remain
    - ``backup_codes_remaining``— count of unused backup codes
    """
    record = _get_or_none(db, username)
    if not record:
        return StatusResponse(enabled=False, has_backup_codes=False, backup_codes_remaining=0)

    try:
        codes: list = json.loads(record.backup_codes or "[]")
    except (json.JSONDecodeError, TypeError):
        codes = []

    return StatusResponse(
        enabled=record.enabled,
        has_backup_codes=len(codes) > 0,
        backup_codes_remaining=len(codes),
    )
