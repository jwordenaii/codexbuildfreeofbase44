"""
admin_integrations.py — Owner-only Command Center API for managing runtime
secrets/keys (Anthropic, Tavily, Vapi, Twilio, SendGrid, Google, etc.).

Endpoints (all admin-auth gated, hidden from public OpenAPI):

    GET  /api/v1/admin/integrations/status   → masked status of every managed key
    PUT  /api/v1/admin/integrations/keys     → upsert/delete one key
    POST /api/v1/admin/integrations/bulk     → upsert many at once
    POST /api/v1/admin/integrations/reload   → force re-read from disk
    POST /api/v1/admin/integrations/test     → live-probe a provider's connectivity

Storage is delegated to app.services.runtime_config.
"""

from __future__ import annotations

import logging
import os
import secrets
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel, Field

from ..services import runtime_config

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/admin/integrations",
    tags=["admin-integrations"],
    include_in_schema=False,
)

security = HTTPBasic()


# ── Auth (owner-only) ─────────────────────────────────────────────────────────

def _auth_disabled() -> bool:
    mode = os.getenv("AUTH_MODE", "required").strip().lower()
    return mode in {"none", "off", "disabled", "0", "false"}


def _require_owner(credentials: HTTPBasicCredentials = Depends(security)) -> str:
    """HTTP Basic admin gate. Mirrors admin_2fa._require_admin."""
    if _auth_disabled():
        return "auth_bypass"

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


# ── Schemas ───────────────────────────────────────────────────────────────────

class KeyUpdate(BaseModel):
    name:  str = Field(..., min_length=1, max_length=128)
    value: str = Field("", description="Empty string deletes the key.")


class BulkUpdate(BaseModel):
    updates: dict[str, str]


class TestRequest(BaseModel):
    provider: str  # "anthropic" | "tavily" | "vapi" | "twilio" | "sendgrid"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/status", summary="List every managed key with masked preview")
def get_status(_: str = Depends(_require_owner)):
    return {
        "keys":    runtime_config.status_for(),
        "managed": list(runtime_config.MANAGED_KEYS),
    }


@router.put("/keys", summary="Upsert or delete a single managed key")
def put_key(body: KeyUpdate, username: str = Depends(_require_owner)):
    ok = runtime_config.set_value(body.name, body.value)
    if not ok:
        raise HTTPException(status_code=400, detail=f"Key '{body.name}' is not managed")
    logger.info("integrations: %s updated %s", username, body.name)
    snap = runtime_config.status_for([body.name])
    return {"ok": True, "key": body.name, "status": snap.get(body.name)}


@router.post("/bulk", summary="Upsert many managed keys at once")
def post_bulk(body: BulkUpdate, username: str = Depends(_require_owner)):
    results = runtime_config.set_many(body.updates or {})
    accepted = [k for k, v in results.items() if v]
    rejected = [k for k, v in results.items() if not v]
    logger.info("integrations: %s bulk-updated %d keys (%d rejected)",
                username, len(accepted), len(rejected))
    return {
        "ok":       True,
        "accepted": accepted,
        "rejected": rejected,
        "status":   runtime_config.status_for(accepted) if accepted else {},
    }


@router.post("/reload", summary="Force re-read of runtime store from disk")
def post_reload(_: str = Depends(_require_owner)):
    n = runtime_config.reload()
    return {"ok": True, "loaded": n}


@router.post("/test", summary="Live-probe a provider with current keys")
async def post_test(body: TestRequest, _: str = Depends(_require_owner)):
    provider = (body.provider or "").strip().lower()
    if provider == "anthropic":
        return await _test_anthropic()
    if provider == "tavily":
        return await _test_tavily()
    if provider == "twilio":
        return _test_twilio()
    if provider == "sendgrid":
        return _test_sendgrid()
    if provider == "vapi":
        return _test_vapi()
    if provider == "google":
        from app.services import google_suite
        return {"ok": True, "results": await google_suite.health_all()}
    raise HTTPException(status_code=400, detail=f"Unknown provider '{body.provider}'")


@router.get("/google/health", summary="Live status for every Google sub-service")
async def get_google_health(_: str = Depends(_require_owner)):
    from app.services import google_suite
    return await google_suite.health_all()


# ── Provider connectivity probes (cheap, no side effects where possible) ──────

async def _test_anthropic() -> dict:
    import httpx
    key = runtime_config.get("ANTHROPIC_API_KEY")
    if not key:
        return {"ok": False, "error": "ANTHROPIC_API_KEY not set"}
    model = runtime_config.anthropic_model()
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            # 1-token ping
            r = await c.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key":         key,
                    "anthropic-version": "2023-06-01",
                    "content-type":      "application/json",
                },
                json={
                    "model":      model,
                    "max_tokens": 1,
                    "messages":   [{"role": "user", "content": "hi"}],
                },
            )
        return {"ok": r.status_code < 400, "status_code": r.status_code,
                "detail": r.text[:200] if r.status_code >= 400 else "ping ok"}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)[:200]}


async def _test_tavily() -> dict:
    import httpx
    key = runtime_config.get("TAVILY_API_KEY")
    if not key:
        return {"ok": False, "error": "TAVILY_API_KEY not set"}
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.post("https://api.tavily.com/search",
                             json={"api_key": key, "query": "ping", "max_results": 1})
        return {"ok": r.status_code < 400, "status_code": r.status_code,
                "detail": "ping ok" if r.status_code < 400 else r.text[:200]}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)[:200]}


def _test_twilio() -> dict:
    sid = runtime_config.get("TWILIO_ACCOUNT_SID")
    tok = runtime_config.get("TWILIO_AUTH_TOKEN")
    svc = runtime_config.get("TWILIO_VERIFY_SERVICE_SID")
    missing = [n for n, v in [("TWILIO_ACCOUNT_SID", sid),
                              ("TWILIO_AUTH_TOKEN", tok),
                              ("TWILIO_VERIFY_SERVICE_SID", svc)] if not v]
    if missing:
        return {"ok": False, "error": f"Missing: {', '.join(missing)}"}
    return {"ok": True, "detail": "credentials present (no live call to avoid OTP cost)"}


def _test_sendgrid() -> dict:
    key = runtime_config.get("SENDGRID_API_KEY")
    return {"ok": bool(key), "detail": "key present" if key else "SENDGRID_API_KEY not set"}


def _test_vapi() -> dict:
    key = runtime_config.get("VAPI_API_KEY")
    return {"ok": bool(key), "detail": "key present" if key else "VAPI_API_KEY not set"}
