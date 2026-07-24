import os
import hashlib
import logging
from fastapi import HTTPException, Security
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

_ALGORITHM = "HS256"
logger = logging.getLogger(__name__)

# Minimum acceptable length for JWORDEN_MASTER_KEY.
# Updated from 24 → 32 to support the current 64-character key format while
# remaining flexible for any future key length ≥ 32 characters.
_MASTER_KEY_MIN_LEN = 32


def _secret_fingerprint(value: str) -> str:
    if not value:
        return "unset"
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()[:12]
    return f"len={len(value)} sha256={digest}"


def _auth_disabled() -> bool:
    mode = os.getenv("AUTH_MODE", "required").strip().lower()
    return mode in {"none", "off", "disabled", "0", "false"}


def verify_premium_security(token: str = Security(oauth2_scheme)):
    """
    Verify a bearer token using either:
      1. A long-lived master API key stored in JWORDEN_MASTER_KEY env var, or
      2. A JWT signed with JWT_SECRET_KEY env var.

    Neither key is hard-coded; both must be supplied at runtime.
    """
    if _auth_disabled():
        return {"user": "AuthBypass", "tenant_id": "JWORDEN_HQ", "auth_mode": "none"}

    if token is None:
        raise HTTPException(status_code=403, detail="Unauthorized: no token")

    # Master key path (simple API key, no expiry — suitable for internal tools)
    master_key = os.getenv("JWORDEN_MASTER_KEY", "")
    if master_key and len(master_key) >= _MASTER_KEY_MIN_LEN and token == master_key:
        return {"user": "Admin", "tenant_id": "JWORDEN_HQ"}

    # JWT path
    secret = os.getenv("JWT_SECRET_KEY", "")
    if not secret:
        raise HTTPException(
            status_code=500,
            detail="Server authentication is not configured. Set JWT_SECRET_KEY.",
        )
    try:
        payload = jwt.decode(token, secret, algorithms=[_ALGORITHM])
        return {
            "user": payload.get("sub", "unknown"),
            "tenant_id": payload.get("tenant_id", "JWORDEN_HQ"),
        }
    except JWTError:
        logger.warning(
            "Protected request rejected — invalid token (presented=%s jwt_secret=%s master_key=%s)",
            _secret_fingerprint(token),
            _secret_fingerprint(secret),
            _secret_fingerprint(master_key),
        )
        raise HTTPException(status_code=403, detail="Unauthorized: invalid token")