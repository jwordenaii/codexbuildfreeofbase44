import os
import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv  # noqa: E402 — must run before other imports

# Load .env / .env.local for local development.
# In production (Railway/Render) env vars are injected directly.
load_dotenv()

# ── Sentry (Feature: observability) ──────────────────────────────────────────
_SENTRY_DSN = os.getenv("SENTRY_DSN", "")
if _SENTRY_DSN:
    try:
        import sentry_sdk  # noqa: PLC0415
        sentry_sdk.init(
            dsn=_SENTRY_DSN,
            traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
        )
        logging.getLogger(__name__).info("Sentry initialised")
    except Exception as _se:  # noqa: BLE001
        logging.getLogger(__name__).warning("Sentry init failed: %s", _se)

from fastapi import FastAPI, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from .core.security import verify_premium_security
from .core.limiter import limiter
from .database import create_all_tables, should_auto_create_tables
from . import models  # noqa: F401 — registers ORM models with Base.metadata
from .services.ai_brain import SupremeCourtAI
from .services.telemetry import FleetOperations
from .routers import leads, reviews, schema_ld, ai as ai_router
from .routers import admin as admin_router, content as content_router
from .routers import advisor as advisor_router
from .routers import permits as permits_router, takeoff as takeoff_router
from .routers import crm as crm_router
from .routers import follow_ups as follow_ups_router
from .routers import proposals as proposals_router
from .routers import weather as weather_router
from .routers import documents as documents_router
from .routers import analytics as analytics_router
from .routers import voice as voice_router
from .routers import lien_calendar as lien_calendar_router
from .routers import subcontractors as subcontractors_router
from .routers import market_intelligence as market_intelligence_router
from .routers import materials as materials_router
from .routers import tenants as tenants_router
from .routers import blog as blog_router
from .routers import seo as seo_router
from .routers import retrospectives as retrospectives_router
from .routers import safety as safety_router
from .routers import cashflow as cashflow_router
from .routers import project_metrics as project_metrics_router
from .routers import workforce as workforce_router
from .routers import bid_intelligence as bid_intelligence_router
from .routers import kpi_wall as kpi_wall_router
from .routers import innovations as innovations_router
from .routers import visualizer as visualizer_router
from .routers import payments as payments_router
from .routers import foreman as foreman_router
from .routers import geo as geo_router
from .routers import igrade as igrade_router

logger = logging.getLogger(__name__)

# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("JWordenAI backend starting up (FastAPI %s)", __import__("fastapi").__version__)
    if should_auto_create_tables():
        create_all_tables()
    else:
        logger.info("AUTO_CREATE_TABLES disabled; expecting Alembic migrations to manage schema")
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
    "https://jwordenasphaltpaving.com",
    "http://localhost:5173",   # Vite dev server
    "http://localhost:3000",
] + _EXTRA_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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
app.include_router(permits_router.router)
app.include_router(takeoff_router.router)

# Enterprise feature routers
app.include_router(crm_router.router)
app.include_router(follow_ups_router.router)
app.include_router(proposals_router.router)
app.include_router(weather_router.router)
app.include_router(documents_router.router)
app.include_router(analytics_router.router)
app.include_router(voice_router.router)
app.include_router(lien_calendar_router.router)
app.include_router(subcontractors_router.router)
app.include_router(market_intelligence_router.router)
app.include_router(materials_router.router)
app.include_router(tenants_router.router)
app.include_router(blog_router.router)
app.include_router(seo_router.router)
app.include_router(retrospectives_router.router)
app.include_router(safety_router.router)
app.include_router(cashflow_router.router)
app.include_router(project_metrics_router.router)
app.include_router(workforce_router.router)
app.include_router(bid_intelligence_router.router)
app.include_router(kpi_wall_router.router)
app.include_router(innovations_router.router)
app.include_router(visualizer_router.router)
app.include_router(payments_router.router)
app.include_router(foreman_router.router)
app.include_router(geo_router.router)
app.include_router(igrade_router.router)


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