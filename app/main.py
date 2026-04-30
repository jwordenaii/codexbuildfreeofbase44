# ── SECURITY AUDIT ────────────────────────────────────────────────────────────
# PUBLIC ENDPOINTS (no auth required):
#   POST /api/v1/leads/quote           — customer quote submission
#   POST /api/v1/leads/contact         — customer contact form
#   POST /api/v1/leads/estimate        — ballpark pricing (self-serve)
#   POST /api/v1/ai/chat               — public chatbot (J. Worden persona)
#   POST /api/v1/ai/contact-suggest    — form field suggestions
#   GET  /health                       — health check
#   GET  /api/v1/blog/*                — public blog content
#   GET  /api/v1/advisor/*             — public advisory content
#   GET  /api/v1/reviews               — public reviews
#   GET  /api/v1/schema/*              — public SEO schema
#   GET  /api/v1/content/*             — public CMS content blocks
#   POST /api/v1/visualizer/proposal   — customer 3D build quote submission
#   POST /api/v1/voice/twilio-webhook  — Twilio TwiML (validated by Twilio)
#   POST /api/v1/voice/twilio-recording-callback — Twilio recording (validated by Twilio)
#   POST /api/v1/payments/webhook      — Stripe webhook (validated by Stripe signature)
#   POST /api/v1/math-ai/pavement-score      — PCI pavement condition scoring
#   POST /api/v1/math-ai/cost-estimate       — project cost estimation
#   POST /api/v1/math-ai/maintenance-forecast — maintenance schedule forecasting
#
# PROTECTED ENDPOINTS (require bearer token via verify_premium_security):
#   POST /api/v1/ai/photo-inspect      — GPT-4 Vision analysis
#   GET  /api/v1/crm/*                 — lead pipeline management
#   GET  /api/v1/analytics/*           — business intelligence
#   GET  /api/v1/bid-intelligence/*    — bid analysis
#   GET  /api/v1/human-review/*        — AI decision review queue
#   GET  /api/v1/kpi-wall/*            — KPI dashboard
#   GET  /api/v1/market/*              — market data
#   GET  /api/v1/workforce/*           — workforce management
#   GET  /api/v1/foreman/*             — job site management
#   GET  /api/v1/retrospectives/*      — project retrospectives
#   GET  /api/v1/innovations/*         — innovation tracking
#   GET  /api/v1/visualizer/parcel     — parcel lookup (internal)
#   GET  /api/v1/visualizer/ai-suggestions — AI design suggestions (internal)
#   GET  /api/v1/payments/*            — payment tracking
#   GET  /api/v1/project-metrics/*     — project metrics
#   GET  /api/v1/cashflow/*            — cash flow analysis
#   GET  /api/v1/safety/*              — safety tracking
#   GET  /api/v1/followups/*           — follow-up management
#   GET  /api/v1/proposals/*           — proposal management
#   GET  /api/v1/documents/*           — document management
#   GET  /api/v1/voice/transcribe      — voice/call transcription
#   GET  /api/v1/liens/*               — lien deadline tracking
#   GET  /api/v1/subcontractors/*      — subcontractor management
#   GET  /api/v1/materials/*           — material pricing (internal)
#   GET  /api/v1/tenants/*             — tenant management
#   GET  /api/v1/permits/*             — permit tracking
#   GET  /api/v1/takeoff/*             — project takeoff
#   GET  /api/v1/weather/*             — weather scheduling (internal)
#   GET  /api/v1/geo/*                 — geospatial data
#   GET  /api/v1/igrade/*              — grading/inspection
#   GET  /api/v1/customers/*           — customer management
#   GET  /api/v1/seo/*                 — SEO content generation
#   POST /api/v1/math-ai/lead-quality        — lead quality prediction (GBM model)
#   POST /api/v1/reviews/respond       — AI review response drafting
#   POST /api/v1/blog/draft            — AI blog draft generation
#   POST /api/v1/blog                  — create/publish blog post
#   PUT  /api/v1/blog/{slug}           — update blog post
#   POST /api/v1/blog/{slug}/publish   — publish blog post
#
# ADMIN ENDPOINTS (require HTTP Basic auth):
#   GET  /admin/*                      — admin dashboard (HTTP Basic)
# ─────────────────────────────────────────────────────────────────────────────

import os
import time
import logging
import logging.config
from contextlib import asynccontextmanager

from dotenv import load_dotenv  # noqa: E402 — must run before other imports

# Load .env / .env.local for local development.
# In production (Railway/Render) env vars are injected directly.
load_dotenv()

# ── Structured logging ────────────────────────────────────────────────────────
# Use JSON formatter in production (LOG_FORMAT=json) for log aggregation.
# Falls back to a human-readable format for local development.

_LOG_FORMAT = os.getenv("LOG_FORMAT", "text").lower()
_LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

_LOGGING_CONFIG: dict = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": "logging.Formatter",
            "fmt": (
                '{"time":"%(asctime)s","level":"%(levelname)s",'
                '"logger":"%(name)s","message":"%(message)s"}'
            ),
            "datefmt": "%Y-%m-%dT%H:%M:%S",
        },
        "text": {
            "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json" if _LOG_FORMAT == "json" else "text",
            "stream": "ext://sys.stdout",
        },
    },
    "root": {
        "level": _LOG_LEVEL,
        "handlers": ["console"],
    },
    # Silence noisy third-party loggers
    "loggers": {
        "uvicorn.access": {"level": "WARNING", "propagate": True},
        "sqlalchemy.engine": {"level": "WARNING", "propagate": True},
        "celery": {"level": "INFO", "propagate": True},
    },
}

logging.config.dictConfig(_LOGGING_CONFIG)

# ── Sentry (Feature: observability) ──────────────────────────────────────────
# Initialised BEFORE the FastAPI app is created so every integration hooks in
# at import time and no early errors are missed.
_SENTRY_DSN = os.getenv("SENTRY_DSN", "")
if _SENTRY_DSN:
    try:
        import sentry_sdk  # noqa: PLC0415
        from sentry_sdk.integrations.fastapi import FastApiIntegration  # noqa: PLC0415
        from sentry_sdk.integrations.starlette import StarletteIntegration  # noqa: PLC0415
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration  # noqa: PLC0415
        from sentry_sdk.integrations.celery import CeleryIntegration  # noqa: PLC0415
        from sentry_sdk.integrations.logging import LoggingIntegration  # noqa: PLC0415
        import logging as _logging  # noqa: PLC0415

        sentry_sdk.init(
            dsn=_SENTRY_DSN,
            # Performance monitoring — sample 10 % of requests by default.
            # Override with SENTRY_TRACES_SAMPLE_RATE env var (0.0–1.0).
            traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
            integrations=[
                # Captures every unhandled HTTP exception and request context.
                StarletteIntegration(transaction_style="endpoint"),
                FastApiIntegration(transaction_style="endpoint"),
                # Captures slow / failing DB queries with full query text.
                SqlalchemyIntegration(),
                # Captures Celery task failures and task timing.
                CeleryIntegration(monitor_beat_tasks=True),
                # Promotes WARNING+ log records to Sentry breadcrumbs;
                # ERROR+ log records are sent as Sentry events.
                LoggingIntegration(
                    level=_logging.WARNING,   # breadcrumb threshold
                    event_level=_logging.ERROR,  # event threshold
                ),
            ],
            # Attach the current git revision so errors link to the exact commit.
            release=os.getenv("RAILWAY_GIT_COMMIT_SHA", "unknown"),
            environment=os.getenv("RAILWAY_ENVIRONMENT_NAME", "production"),
            # Send 100 % of error events (only traces are sampled).
            send_default_pii=False,
        )
        logging.getLogger(__name__).info("Sentry initialised (env=%s)", os.getenv("RAILWAY_ENVIRONMENT_NAME", "production"))
    except Exception as _se:  # noqa: BLE001
        logging.getLogger(__name__).warning("Sentry init failed: %s", _se)

from fastapi import FastAPI, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
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
from .routers import vector_search as vector_search_router
from .routers import admin_vector as admin_vector_router
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
from .routers import customers as customers_router
from .routers import auth as auth_router
from .routers import health as health_router
from .routers import metrics as metrics_router
from .routers import gallery as gallery_router
from .routers import chat as chat_router
from .routers import email as email_router
from .routers import math_ai as math_ai_router
from .routers.websocket_events import sio
from .services.monitoring_service import monitoring

logger = logging.getLogger(__name__)

# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("JWordenAI backend starting up (FastAPI %s)", __import__("fastapi").__version__)
    if should_auto_create_tables():
        create_all_tables()
    else:
        logger.info("AUTO_CREATE_TABLES disabled; expecting Alembic migrations to manage schema")

    # ── SendGrid initialisation check ─────────────────────────────────────────
    _sg_key = os.getenv("SENDGRID_API_KEY", "").strip()
    _sg_from = os.getenv("SENDGRID_FROM_EMAIL", "").strip()
    if _sg_key and _sg_from:
        logger.info("SendGrid configured: from=%s", _sg_from)
    else:
        logger.warning(
            "SendGrid not fully configured — transactional emails will be skipped. "
            "Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL to enable email delivery."
        )

    # ── Elasticsearch initialisation check ────────────────────────────────────
    from .services import search_service as _search_service  # noqa: PLC0415
    _es_status = _search_service.health()
    if _es_status.get("ok"):
        logger.info(
            "Elasticsearch connected: host=%s status=%s nodes=%d",
            _es_status.get("host"),
            _es_status.get("status"),
            _es_status.get("number_of_nodes", 0),
        )
    else:
        logger.warning(
            "Elasticsearch unavailable at startup — search features will be disabled. "
            "Set ELASTICSEARCH_HOST to enable full-text search. error=%s",
            _es_status.get("error", "unknown"),
        )

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
    "https://www.jwordenasphaltpaving.com",
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

# ── GZip compression ──────────────────────────────────────────────────────────
# Compress responses larger than 500 bytes.  Covers JSON, HTML, CSS, and JS.
# Binary formats (images, PDFs) are already compressed and are excluded
# automatically by the middleware when the Content-Type is not compressible.
app.add_middleware(GZipMiddleware, minimum_size=500)


# ── Request logging middleware ────────────────────────────────────────────────

@app.middleware("http")
async def log_requests(request, call_next):
    """
    Log every HTTP request with method, path, status code, and latency.
    Errors (5xx) are logged at ERROR level, sent to Datadog, and trigger
    a Slack alert so J is notified immediately when the API breaks.
    """
    start = time.monotonic()
    response = None
    unhandled_exc: Exception | None = None
    try:
        response = await call_next(request)
        return response
    except Exception as exc:  # noqa: BLE001
        unhandled_exc = exc
        logger.error(
            "Unhandled exception: method=%s path=%s error=%s",
            request.method,
            request.url.path,
            exc,
            exc_info=True,
        )
        raise
    finally:
        latency_ms = round((time.monotonic() - start) * 1000, 2)
        status = response.status_code if response is not None else 500
        log_fn = logger.error if status >= 500 else logger.info
        log_fn(
            "request: method=%s path=%s status=%d latency_ms=%.2f",
            request.method,
            request.url.path,
            status,
            latency_ms,
        )

        # ── Datadog: record request latency for every call ────────────────────
        monitoring.log_metric(
            "api.request.latency_ms",
            latency_ms,
            tags=[
                f"method:{request.method}",
                f"status:{status}",
                f"path:{request.url.path}",
            ],
        )

        # ── Slack + Datadog: alert on 5xx errors ──────────────────────────────
        if status >= 500:
            error_detail = str(unhandled_exc) if unhandled_exc else f"HTTP {status}"
            monitoring.alert_5xx(
                method=request.method,
                path=request.url.path,
                status_code=status,
                error=error_detail,
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
app.include_router(vector_search_router.router)
app.include_router(admin_vector_router.router)
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
app.include_router(customers_router.router)

# Ops / infrastructure routers
app.include_router(auth_router.router)
app.include_router(health_router.router)
app.include_router(metrics_router.router)
app.include_router(monitoring_router.router)

# Gallery
app.include_router(gallery_router.router)

# Real-time chat (WebSocket + HTTP history/session endpoints)
app.include_router(chat_router.router)

# Email management (SendGrid transactional + follow-up)
app.include_router(email_router.router)

# Mathematical AI (pavement scoring, cost estimation, lead quality, maintenance)
app.include_router(math_ai_router.router)


# ── Socket.IO ASGI mount ──────────────────────────────────────────────────────
# Mount the Socket.IO server at /sio so it doesn't conflict with FastAPI routes.
# Clients connect via:  io("https://host", {path: "/sio/socket.io"})
import socketio as _socketio  # noqa: E402 — imported after app is configured

_sio_app = _socketio.ASGIApp(sio, socketio_path="/sio/socket.io")
app.mount("/sio", _sio_app)


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