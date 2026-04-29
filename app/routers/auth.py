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

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Security
from fastapi.security import OAuth2PasswordBearer
from jose import jwt
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

_ALGORITHM = "HS256"
_TOKEN_EXPIRE_SECONDS = 86_400  # 24 hours

_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token", auto_error=False)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = _TOKEN_EXPIRE_SECONDS


@router.post(
    "/token",
    summary="Exchange master key for a 24-hour JWT",
    response_model=TokenResponse,
)
def issue_token(raw_token: str = Security(_oauth2_scheme)):
    """
    Present the ``JWORDEN_MASTER_KEY`` as a Bearer token to receive a signed
    JWT valid for 24 hours.

    Example::

        curl -X POST /api/v1/auth/token \\
             -H "Authorization: Bearer <JWORDEN_MASTER_KEY>"

    The returned ``access_token`` can then be used in place of the master key
    for all protected endpoints.
    """
    if raw_token is None:
        raise HTTPException(
            status_code=401,
            detail="Authorization header with Bearer token required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    master_key = os.getenv("JWORDEN_MASTER_KEY", "")
    if not master_key:
        raise HTTPException(
            status_code=500,
            detail="Server authentication is not configured. Set JWORDEN_MASTER_KEY.",
        )

    if raw_token != master_key:
        logger.warning("Token issuance rejected — invalid master key presented")
        raise HTTPException(
            status_code=403,
            detail="Invalid master key",
            headers={"WWW-Authenticate": "Bearer"},
        )

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

    token = jwt.encode(payload, secret, algorithm=_ALGORITHM)
    logger.info("JWT issued for Admin (tenant=JWORDEN_HQ, expires_in=%ds)", _TOKEN_EXPIRE_SECONDS)

    return TokenResponse(access_token=token)
