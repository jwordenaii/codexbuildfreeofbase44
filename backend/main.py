"""
The Worden Standard — FastAPI backend
  POST /api/auth/login           PIN verification → session cookie
  GET  /api/auth/session         Verify existing session cookie
  POST /api/auth/logout          Clear session cookie
  POST /api/jarvis               Anthropic Claude proxy (requires valid session)
  GET  /api/intelligence         IronGridMap — construction demand signal (stub)
  POST /api/precon               PreCon Omni — site analysis (stub)
  GET  /api/investor             Investor ROI — market data (stub)
  GET  /.netlify/functions/forecast    ForecastStation endpoint
  POST /.netlify/functions/narrate     ForecastStation narrative endpoint
  POST /api/reality              Reality Engine arbitration (stub)

In production: FastAPI also serves the Vite dist/ build as static files.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import time
from pathlib import Path
from typing import Optional

import httpx
from dotenv import load_dotenv
from fastapi import Cookie, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

load_dotenv()

# ─── Config ──────────────────────────────────────────────────────────────────

WS_PIN: str = os.environ.get("WS_PIN", "")
SESSION_SECRET: str = os.environ.get("SESSION_SECRET", secrets.token_hex(32))
ANTHROPIC_API_KEY: str = os.environ.get("ANTHROPIC_API_KEY", "")
SESSION_COOKIE = "ws_session"
SESSION_TTL = 86400 * 7  # 7 days


# ─── Session helpers ─────────────────────────────────────────────────────────

def _sign(payload: str) -> str:
    """HMAC-SHA256 sign a payload string → token."""
    sig = hmac.new(SESSION_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}.{sig}"


def _verify(token: str) -> bool:
    """Return True if the token has a valid HMAC and hasn't expired."""
    try:
        parts = token.rsplit(".", 1)
        if len(parts) != 2:
            return False
        payload, sig = parts
        expected = hmac.new(SESSION_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return False
        ts = int(payload.split(".", 1)[0])
        return (time.time() - ts) < SESSION_TTL
    except Exception:
        return False


def _new_session() -> str:
    ts = int(time.time())
    nonce = secrets.token_hex(16)
    return _sign(f"{ts}.{nonce}")


# ─── App ─────────────────────────────────────────────────────────────────────

app = FastAPI(title="The Worden Standard", docs_url=None, redoc_url=None)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5174", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Auth routes ─────────────────────────────────────────────────────────────

class PinPayload(BaseModel):
    pin: str


@app.post("/api/auth/login")
async def login(payload: PinPayload, response: Response):
    if not WS_PIN:
        raise HTTPException(503, "Auth not configured — set WS_PIN env var")
    if not hmac.compare_digest(payload.pin.strip(), WS_PIN.strip()):
        raise HTTPException(401, "Incorrect PIN")
    token = _new_session()
    response.set_cookie(
        SESSION_COOKIE,
        token,
        httponly=True,
        samesite="lax",
        secure=False,  # set True behind HTTPS in production
        max_age=SESSION_TTL,
        path="/",
    )
    return {"ok": True}


@app.get("/api/auth/session")
async def session(ws_session: Optional[str] = Cookie(default=None)):
    if ws_session and _verify(ws_session):
        return {"ok": True}
    raise HTTPException(401, "No valid session")


@app.post("/api/auth/logout")
async def logout(response: Response):
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}


# ─── Session guard dependency ─────────────────────────────────────────────────

def _require_session(request: Request) -> None:
    token = request.cookies.get(SESSION_COOKIE)
    if not token or not _verify(token):
        raise HTTPException(401, "Not authenticated")


# ─── Jarvis (Anthropic proxy) ─────────────────────────────────────────────────

@app.post("/api/jarvis")
async def jarvis(request: Request):
    _require_session(request)
    if not ANTHROPIC_API_KEY:
        raise HTTPException(503, "ANTHROPIC_API_KEY not set")
    body = await request.json()
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json=body,
        )
    return r.json()


# ─── Intelligence stubs (components fall back gracefully on 503) ──────────────

@app.get("/api/intelligence")
async def intelligence(request: Request, state: str = "VA", layer: str = "construction", cluster: str = "paving"):
    _require_session(request)
    # Returns a minimal stub. Replace with real data sources (SerpAPI, Google Trends, etc.)
    return {"states": [], "meta": {"layer": layer, "cluster": cluster, "ts": int(time.time())}}


@app.post("/api/precon")
async def precon(request: Request):
    _require_session(request)
    body = await request.json()
    return {
        "address": body.get("address", ""),
        "geocoded": None,
        "soils": None,
        "weather": None,
        "elevation": None,
        "roads": None,
        "summary": "PreCon analysis requires MAPBOX_TOKEN, ANTHROPIC_API_KEY, and NOAA credentials.",
    }


@app.get("/api/investor")
async def investor(request: Request, market: str = "Tier 2 — Major Metro (Dallas, Atlanta)"):
    _require_session(request)
    return {
        "market": market,
        "capRate": None,
        "costIndex": None,
        "interestRate": None,
        "note": "Live market data requires CoStar / Freddie Mac credentials.",
    }


@app.get("/.netlify/functions/forecast")
async def forecast(request: Request, model: str = "wbp", geo: str = "51041", horizon: str = "30"):
    _require_session(request)
    return {
        "model": model,
        "geo": geo,
        "horizon": int(horizon),
        "predictions": [],
        "signals": [],
        "note": "Forecast requires DATABASE_URL (Neon) and signal history.",
    }


@app.post("/.netlify/functions/narrate")
async def narrate(request: Request):
    _require_session(request)
    if not ANTHROPIC_API_KEY:
        return {"narrative": "ANTHROPIC_API_KEY not set — narrative generation unavailable."}
    body = await request.json()
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": body.get("model", "claude-3-5-haiku-latest"),
                "max_tokens": body.get("max_tokens", 400),
                "messages": body.get("messages", []),
                "system": body.get("system", ""),
            },
        )
    data = r.json()
    text = "".join(b.get("text", "") for b in data.get("content", []))
    return {"narrative": text}


@app.post("/api/reality")
async def reality(request: Request):
    _require_session(request)
    body = await request.json()
    return {
        "scenario": body.get("scenario"),
        "verdict": None,
        "note": "Reality Engine live verdict requires NOAA weather feed and ANTHROPIC_API_KEY.",
    }


# ─── Serve Vite build in production ──────────────────────────────────────────

DIST = Path(__file__).parent.parent / "dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        file = DIST / full_path
        if file.is_file():
            return FileResponse(file)
        return FileResponse(DIST / "index.html")
