"""
auth.py — JWT token issuance endpoint for JWordenAI.

Routes:
  POST /api/v1/auth/token — exchange master key for a short-lived JWT

The frontend (or any API client) can POST the master key in the Authorization
header to receive a 24-hour JWT.  Subsequent requests use that JWT instead of
the raw master key, which limits exposure of the long-lived credential.

Flow:
  1. Client sends:  Authorization: Bearer <JWORDEN_MASTER_KEY>
  2. Server validates the master key.
  3. Server returns a signed JWT (HS256, 24 h expiry).
  4. Client uses the JWT for all subsequent authenticated requests.
"""

import base64
import hashlib
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from jose import jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.audit import write_audit_event

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

_ALGORITHM = "HS256"
_TOKEN_EXPIRE_SECONDS = 86_400  # 24 hours

# Minimum acceptable length for JWORDEN_MASTER_KEY.
# Updated from 24 → 32 to support the current 64-character key format while
# remaining flexible for any future key length ≥ 32 characters.
_MASTER_KEY_MIN_LEN = 32


def _secret_fingerprint(value: str) -> str:
    if not value:
        return "unset"
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()[:12]
    return f"len={len(value)} sha256={digest}"


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = _TOKEN_EXPIRE_SECONDS


class PinTokenRequest(BaseModel):
    pin: str


class AuthStatusResponse(BaseModel):
    auth_required: bool
    auth_mode: str
    token_endpoint: str | None = None
    admin_configured: bool


def _auth_mode() -> str:
    return os.getenv("AUTH_MODE", "required").strip().lower()


def _issue_admin_jwt() -> str:
    secret = os.getenv("JWT_SECRET_KEY", "")
    if not secret:
        raise HTTPException(
            status_code=500,
            detail="JWT signing is not configured. Set JWT_SECRET_KEY.",
        )

    now = datetime.now(timezone.utc)
    payload = {
        "sub": "Admin",
        "tenant_id": "JWORDEN_HQ",
        "iat": now,
        "exp": now + timedelta(seconds=_TOKEN_EXPIRE_SECONDS),
    }
    return jwt.encode(payload, secret, algorithm=_ALGORITHM)


@router.get(
    "/status",
    summary="Return server-auth configuration for frontend bootstrapping",
    response_model=AuthStatusResponse,
)
def auth_status():
    mode = _auth_mode()
    auth_required = mode not in {"none", "off", "disabled", "0", "false"}
    admin_configured = bool(
        os.getenv("ADMIN_PIN")
        or (os.getenv("ADMIN_USERNAME") and os.getenv("ADMIN_PASSWORD"))
    )
    token_endpoint = "/.netlify/functions/get-token" if auth_required else None
    return AuthStatusResponse(
        auth_required=auth_required,
        auth_mode=mode,
        token_endpoint=token_endpoint,
        admin_configured=admin_configured,
    )


@router.post(
    "/token",
    summary="Exchange master key for a 24-hour JWT",
    response_model=TokenResponse,
)
def issue_token(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Present the ``JWORDEN_MASTER_KEY`` as a Bearer token to receive a signed
    JWT valid for 24 hours.

    Example::

        curl -X POST /api/v1/auth/token \\
             -H "Authorization: Bearer <JWORDEN_MASTER_KEY>"

    The returned ``access_token`` can then be used in place of the master key
    for all protected endpoints.
    """
    auth_header = request.headers.get("authorization", "")
    if not auth_header:
        raise HTTPException(
            status_code=401,
            detail="Authorization header with Bearer or Basic token required",
            headers={"WWW-Authenticate": "Bearer, Basic"},
        )

    scheme, _, credentials = auth_header.partition(" ")
    scheme = scheme.lower().strip()
    credentials = credentials.strip()

    if scheme == "bearer":
        if not credentials:
            raise HTTPException(
                status_code=401,
                detail="Bearer token required",
                headers={"WWW-Authenticate": "Bearer"},
            )

        master_key = os.getenv("JWORDEN_MASTER_KEY", "")
        if not master_key:
            raise HTTPException(
                status_code=500,
                detail="Server authentication is not configured. Set JWORDEN_MASTER_KEY.",
            )

        if len(master_key) < _MASTER_KEY_MIN_LEN:
            logger.error(
                "JWORDEN_MASTER_KEY is too short (len=%d, required>=%d). "
                "Regenerate the key and update the environment variable.",
                len(master_key),
                _MASTER_KEY_MIN_LEN,
            )
            raise HTTPException(
                status_code=500,
                detail=(
                    f"Server authentication is misconfigured: JWORDEN_MASTER_KEY must be "
                    f"at least {_MASTER_KEY_MIN_LEN} characters. Regenerate the key."
                ),
            )

        if credentials != master_key:
            logger.warning(
                "Token issuance rejected — invalid master key presented (presented=%s expected=%s)",
                _secret_fingerprint(credentials),
                _secret_fingerprint(master_key),
            )
            raise HTTPException(
                status_code=403,
                detail="Invalid master key",
                headers={"WWW-Authenticate": "Bearer"},
            )

    elif scheme == "basic":
        if not credentials:
            raise HTTPException(
                status_code=401,
                detail="Basic credentials required",
                headers={"WWW-Authenticate": 'Basic realm="Auth Token"'},
            )

        admin_username = os.getenv("ADMIN_USERNAME", "")
        admin_password = os.getenv("ADMIN_PASSWORD", "")
        if not admin_username or not admin_password:
            raise HTTPException(
                status_code=500,
                detail="Server authentication is not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD.",
            )

        try:
            decoded = base64.b64decode(credentials).decode("utf-8", errors="replace")
            provided_username, _, provided_password = decoded.partition(":")
        except Exception:  # noqa: BLE001
            provided_username = ""
            provided_password = ""

        username_ok = secrets.compare_digest(
            provided_username.encode(), admin_username.encode()
        )
        password_ok = secrets.compare_digest(
            provided_password.encode(), admin_password.encode()
        )
        if not username_ok or not password_ok:
            logger.warning(
                "Token issuance rejected — invalid basic credentials (user=%s)",
                provided_username or "<empty>",
            )
            raise HTTPException(
                status_code=403,
                detail="Invalid admin credentials",
                headers={"WWW-Authenticate": 'Basic realm="Auth Token"'},
            )

    else:
        raise HTTPException(
            status_code=401,
            detail="Unsupported auth scheme. Use Bearer or Basic.",
            headers={"WWW-Authenticate": "Bearer, Basic"},
        )

    token = _issue_admin_jwt()
    logger.info(
        "JWT issued for Admin (tenant=JWORDEN_HQ, expires_in=%ds)",
        _TOKEN_EXPIRE_SECONDS,
    )

    write_audit_event(
        db,
        event_type="auth.token_issued",
        actor_type="service",
        actor_id="auth_router",
        entity_type="auth_token",
        entity_id="Admin",
        summary="Issued backend JWT for admin client bootstrap.",
        detail={"tenant_id": "JWORDEN_HQ", "expires_in": _TOKEN_EXPIRE_SECONDS},
    )

    return TokenResponse(access_token=token)


@router.post(
    "/pin-token",
    summary="Exchange the configured admin PIN for a 24-hour JWT",
    response_model=TokenResponse,
)
def issue_pin_token(
    request: PinTokenRequest,
    db: Session = Depends(get_db),
):
    admin_pin = os.getenv("ADMIN_PIN", "")
    if not admin_pin:
        raise HTTPException(
            status_code=500,
            detail="PIN authentication is not configured. Set ADMIN_PIN.",
        )

    # 4 to 8 digits, matching the frontend gate (App.jsx: /^\d{4,8}$/) exactly.
    #
    # This used to demand len == 4. The frontend accepts up to 8, so any account
    # whose ADMIN_PIN was set to 5-8 digits was permanently locked out: the real
    # PIN failed the length check with a 400 ("A 4-digit PIN is required") while
    # every 4-digit guess failed the equality check with a 403. Two different
    # errors, no possible success, and nothing on screen explained why. Widening
    # the ceiling can only raise the entropy floor, never lower it.
    if not request.pin or not request.pin.isdigit() or not (4 <= len(request.pin) <= 8):
        raise HTTPException(status_code=400, detail="A 4 to 8-digit PIN is required.")

    if request.pin != admin_pin:
        logger.warning(
            "PIN token issuance rejected — incorrect PIN presented (presented=%s expected=%s)",
            _secret_fingerprint(request.pin),
            _secret_fingerprint(admin_pin),
        )
        raise HTTPException(status_code=403, detail="Incorrect PIN")

    token = _issue_admin_jwt()
    logger.info(
        "JWT issued for Admin via PIN auth (tenant=JWORDEN_HQ, expires_in=%ds)",
        _TOKEN_EXPIRE_SECONDS,
    )

    write_audit_event(
        db,
        event_type="auth.pin_token_issued",
        actor_type="admin",
        actor_id="pin_auth",
        entity_type="auth_token",
        entity_id="Admin",
        summary="Issued backend JWT after admin PIN verification.",
        detail={"tenant_id": "JWORDEN_HQ", "expires_in": _TOKEN_EXPIRE_SECONDS},
    )

    return TokenResponse(access_token=token)
