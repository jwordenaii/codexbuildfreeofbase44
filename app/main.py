import os
import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv  # noqa: E402 — must run before other imports

# Load .env / .env.local for local development.
# In production (Railway/Render) env vars are injected directly.
load_dotenv()

from fastapi import FastAPI, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from .core.security import verify_premium_security
from .core.limiter import limiter
from .database import create_all_tables
from . import models  # noqa: F401 — registers ORM models with Base.metadata
from .services.ai_brain import SupremeCourtAI
from .services.telemetry import FleetOperations
from .routers import leads, reviews, schema_ld, ai as ai_router
from .routers import admin as admin_router, content as content_router
from .routers import advisor as advisor_router
from .routers import geo as geo_router, foreman as foreman_router

logger = logging.getLogger(__name__)

# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("JWordenAI backend starting up (FastAPI %s)", __import__("fastapi").__version__)
    create_all_tables()
    yield
    logger.info("JWordenAI backend shutting down")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="JWordenAI Master OS",
    version="3.0.0-Enterprise",
    description=(
        "Backend API for J. Worden & Sons Asphalt Paving — lead capture, "
        "reviews, AI inspection, and fleet telemetry."
    ),
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ──────────────────────────────────────────────────────────────────────
_EXTRA_ORIGINS = [
    o.strip()
    for o in os.getenv("EXTRA_CORS_ORIGINS", "").split(",")
    if o.strip()
]
_ALLOWED_ORIGINS = [
    "https://jworden.netlify.app",
    "https://jwordenasphalt.com",
    "http://localhost:5173",   # Vite dev server
    "http://localhost:3000",
] + _EXTRA_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(leads.router)
app.include_router(reviews.router)
app.include_router(schema_ld.router)
app.include_router(ai_router.router)
app.include_router(content_router.router)
app.include_router(advisor_router.router)
app.include_router(admin_router.router)
app.include_router(geo_router.router)
app.include_router(foreman_router.router)


# ── Legacy endpoints (kept for backward compatibility) ────────────────────────

class ScopeRequest(BaseModel):
    state: str
    project_scope: str


class TelemetryPing(BaseModel):
    truck_id: str
    asphalt_temp_f: float
    delay_minutes: int


@app.post("/api/v1/ai/compliance", tags=["legacy"])
def check_compliance(
    req: ScopeRequest,
    security: dict = Depends(verify_premium_security),
):
    result = SupremeCourtAI.analyze_codes(req.state, req.project_scope)
    return {"status": "success", "tenant": security["tenant_id"], "analysis": result}


@app.post("/api/v1/iot/truck-ping", tags=["legacy"])
def truck_ping(req: TelemetryPing, background_tasks: BackgroundTasks):
    action = FleetOperations.calculate_thermal_decay(
        req.asphalt_temp_f, req.delay_minutes
    )
    return {
        "status": "logged",
        "truck": req.truck_id,
        "operational_directive": action,
    }


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health", tags=["ops"])
def health():
    return {"status": "ok", "service": "JWordenAI"}