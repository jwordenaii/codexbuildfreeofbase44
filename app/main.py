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
#   POST /api/v1/global/*                    — universal service platform triage
#   POST /api/v1/public/chat                  — Mr. Worden premium concierge chat (rate-limited)
#   GET  /api/v1/authority/local-proof        — Gemini-powered Verified Proof content per city
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

import logging
import logging.config
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import cast

from dotenv import (  # noqa: E402 — must run before other imports
    dotenv_values,
    load_dotenv,
)

# Load local env files from repo root in deterministic order.
# In production (Fly.io), environment variables are injected directly as secrets
# and none of these files exist, so this block is a no-op there.
#
# The `.env.local` loop below is a HARD override — it wins over whatever is
# already in os.environ. That is deliberate for local development (a developer's
# .env.local should beat a stale exported shell variable), but it is wrong under
# test: tests/backend/conftest.py monkeypatches JWORDEN_MASTER_KEY, DATABASE_URL
# and friends and then reloads this module, at which point the loop would
# silently replace every one of them with the placeholder values from a
# developer's .env.local. That failure mode is very hard to read from the far
# end — it surfaces as a bare 403 on authenticated tests, with the real cause
# (expected key len=33, "change-me-to-a-long-random-secret") never mentioned.
# So conftest sets JWORDEN_SKIP_LOCAL_ENV=1 and this block stands down.
_REPO_ROOT = Path(__file__).resolve().parents[1]
_SKIP_LOCAL_ENV = os.getenv("JWORDEN_SKIP_LOCAL_ENV", "").strip().lower() in {
    "1",
    "true",
    "yes",
}

if not _SKIP_LOCAL_ENV:
    _base_env = _REPO_ROOT / ".env"
    if _base_env.exists():
        load_dotenv(dotenv_path=_base_env, override=False)

    for _name in (".env.local", ".env.ops.local"):
        _path = _REPO_ROOT / _name
        if not _path.exists():
            continue
        for _key, _raw in dotenv_values(_path).items():
            if _raw is None:
                continue
            _value = str(_raw).strip()
            if not _value:
                continue
            os.environ[_key] = _value

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
# Reject placeholder DSNs (e.g. "your-dsn-here") so we don't spam logs with
# "Sentry init failed" warnings on dev/staging environments.
import re as _re_dsn  # noqa: PLC0415

_SENTRY_DSN = os.getenv("SENTRY_DSN", "").strip()
_SENTRY_DSN_VALID = bool(
    _SENTRY_DSN
    and _re_dsn.match(r"^https://[^@]+@[^/]+\.ingest\.[^/]+/\d+", _SENTRY_DSN)
)
if _SENTRY_DSN_VALID:
    try:
        import logging as _logging  # noqa: PLC0415

        import sentry_sdk  # noqa: PLC0415
        from sentry_sdk.integrations.celery import CeleryIntegration  # noqa: PLC0415
        from sentry_sdk.integrations.fastapi import FastApiIntegration  # noqa: PLC0415
        from sentry_sdk.integrations.logging import LoggingIntegration  # noqa: PLC0415
        from sentry_sdk.integrations.sqlalchemy import (
            SqlalchemyIntegration,  # noqa: PLC0415
        )
        from sentry_sdk.integrations.starlette import (
            StarletteIntegration,  # noqa: PLC0415
        )

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
                    level=_logging.WARNING,  # breadcrumb threshold
                    event_level=_logging.ERROR,  # event threshold
                ),
            ],
            # Attach the current git revision so errors link to the exact commit.
            release=os.getenv("RAILWAY_GIT_COMMIT_SHA", "unknown"),
            environment=os.getenv("RAILWAY_ENVIRONMENT_NAME", "production"),
            # Send 100 % of error events (only traces are sampled).
            send_default_pii=False,
        )
        logging.getLogger(__name__).info(
            "Sentry initialised (env=%s)",
            os.getenv("RAILWAY_ENVIRONMENT_NAME", "production"),
        )
    except Exception as _se:  # noqa: BLE001
        logging.getLogger(__name__).warning("Sentry init failed: %s", _se)

from fastapi import BackgroundTasks, Depends, FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from . import models  # noqa: F401 — registers ORM models with Base.metadata
from .core.limiter import limiter
from .core.security import verify_premium_security
from .database import create_all_tables, should_auto_create_tables
from .routers import admin as admin_router
from .routers import admin_2fa as admin_2fa_router
from .routers import admin_integrations as admin_integrations_router
from .routers import admin_vector as admin_vector_router
from .routers import ads_intelligence as ads_intelligence_router
from .routers import advisor as advisor_router
from .routers import ai as ai_router
from .routers import analytics as analytics_router
from .routers import (
    asphalt_thermal_router,
    dispatch_router,
    drone_capture_router,
    gbp_router,
    leads,
    lidar_ingest_router,
    reviews,
    roller_telemetry_router,
    schema_ld,
    search_pulse_router,
    staff_router,
)
from .routers import audit_admin as audit_admin_router
from .routers import auth as auth_router
from .routers import authority as authority_router
from .routers import autonomy as autonomy_router
from .routers import bid_intelligence as bid_intelligence_router
from .routers import blog as blog_router
from .routers import cashflow as cashflow_router
from .routers import chat as chat_router
from .routers import commercial_assessment as commercial_assessment_router
from .routers import compaction as compaction_router
from .routers import compliance as compliance_router
from .routers import content as content_router
from .routers import crew_wearables as crew_wearables_router
from .routers import crm as crm_router
from .routers import customers as customers_router
from .routers import documents as documents_router
from .routers import driveway_growth as driveway_growth_router
from .routers import drone_scan as drone_scan_router
from .routers import email as email_router
from .routers import email_sync as email_sync_router
from .routers import features as features_router
from .routers import follow_ups as follow_ups_router
from .routers import foreman as foreman_router
from .routers import gallery as gallery_router
from .routers import geo as geo_router
from .routers import facebook_page as facebook_page_router
from .routers import google_reporting as google_reporting_router
from .routers import health as health_router
from .routers import human_review as human_review_router
from .routers import igrade as igrade_router
from .routers import innovations as innovations_router
from .routers import jarvis_router as jarvis_router
from .routers import kickserv as kickserv_router
from .routers import kpi_wall as kpi_wall_router
from .routers import lien_calendar as lien_calendar_router
from .routers import live_site as live_site_router
from .routers import local_proof as local_proof_router
from .routers import market_intelligence as market_intelligence_router
from .routers import materials as materials_router
from .routers import math_ai as math_ai_router
from .routers import metrics as metrics_router
from .routers import monitoring as monitoring_router
from .routers import operations as operations_router
from .routers import payments as payments_router
from .routers import permits as permits_router
from .routers import plan_estimator as plan_estimator_router
from .routers import predictive_capital as predictive_capital_router
from .routers import project_metrics as project_metrics_router
from .routers import proposals as proposals_router
from .routers import public_chat as public_chat_router
from .routers import quotes as quotes_router
from .routers import retrospectives as retrospectives_router
from .routers import safety as safety_router
from .routers import scan_campaign as scan_campaign_router
from .routers import scc as scc_router
from .routers import schedule_sim as schedule_sim_router
from .routers import search as search_router
from .routers import seo as seo_router
from .routers import site_metrics as site_metrics_router
from .routers import spatial_ai as spatial_ai_router
from .routers import subcontractors as subcontractors_router
from .routers import takeoff as takeoff_router
from .routers import tech_intelligence as tech_intelligence_router
from .routers import tenants as tenants_router
from .routers import tts as tts_router
from .routers import twilio_verify_router as twilio_verify_router
from .routers import vdot_bids as vdot_bids_router
from .routers import vector_search as vector_search_router
from .routers import visualizer as visualizer_router
from .routers import voice as voice_router
from .routers import weather as weather_router
from .routers import workforce as workforce_router

# ── Ported from jworden-production 2026-07-28 ────────────────────────────────
# Twelve routers that existed only in that repo. Imported and mounted the same
# way it did, so behaviour matches the source rather than being re-invented.
from .routers import abilities as abilities_router
from .routers import b2g_bids as b2g_bids_router
from .routers import bid_hunter_router
from .routers import billing as billing_router
from .routers import factory as factory_router
from .routers import revenue as revenue_router
from .routers import lms as lms_router
from .routers import market_orchestration as market_orchestration_router
from .routers import owner_auth as owner_auth_router
from .routers import portal as portal_router
from .routers import superadmin as superadmin_router
from .routers import supply_chain as supply_chain_router
from .routers import system as system_router
from .routers.websocket_events import sio
from .services.ai_brain import SupremeCourtAI
from .services.monitoring_service import monitoring
from .services.state_data import verify_state_logic_integrity
from .services.telemetry import FleetOperations

logger = logging.getLogger(__name__)

# ── Lifespan ──────────────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        "JWordenAI backend starting up (FastAPI %s)", __import__("fastapi").__version__
    )
    verify_state_logic_integrity(raise_on_error=True)
    logger.info("State logic integrity check passed (50 states + DC parity).")
    if should_auto_create_tables():
        create_all_tables()
    else:
        logger.info(
            "AUTO_CREATE_TABLES disabled; expecting Alembic migrations to manage schema"
        )

    # ── Seed first owner account if configured ────────────────────────────────
    _seed_user = os.getenv("SEED_OWNER_USERNAME", "").strip()
    _seed_pass = os.getenv("SEED_OWNER_PASSWORD", "").strip()
    if _seed_user and _seed_pass:
        try:
            from .database import SessionLocal
            from .models import StaffUser
            from .services import staff_auth

            db = SessionLocal()
            try:
                exists = (
                    db.query(StaffUser).filter(StaffUser.username == _seed_user).first()
                )
                if not exists:
                    user = StaffUser(
                        username=_seed_user,
                        role="owner",
                        password_hash=staff_auth.hash_password(_seed_pass),
                    )
                    db.add(user)
                    db.commit()
                    logger.info("Seeded owner account: %s", _seed_user)
                else:
                    logger.info("Seed account already exists: %s", _seed_user)
            finally:
                db.close()
        except Exception as e:
            logger.warning("Could not seed owner account: %s", e)

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


def _rate_limit_exception_handler(request: Request, exc: Exception) -> Response:
    # FastAPI expects a general Exception handler signature.
    # This endpoint is registered only for RateLimitExceeded, so this cast is safe.
    return _rate_limit_exceeded_handler(request, cast(RateLimitExceeded, exc))


app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exception_handler)

# ── CORS ──────────────────────────────────────────────────────────────────────
_EXTRA_ORIGINS = [
    o.strip() for o in os.getenv("EXTRA_CORS_ORIGINS", "").split(",") if o.strip()
]
_ALLOWED_ORIGINS = [
    # Main site (both apex and www — the bundle calls this API cross-origin
    # for checkout, portal estimate signing, and superadmin).
    "https://jwordenasphaltpaving.com",
    "https://www.jwordenasphaltpaving.com",
    "https://app.jwordenasphaltpaving.com",
    "https://thewordenstandard.com",
    "https://www.thewordenstandard.com",
    # Regional money domains. These were previously reaching the API only via
    # EXTRA_CORS_ORIGINS; listed explicitly so that removing the wildcard
    # regex below cannot silently break checkout or estimate signing on them.
    "https://richmondasphaltpaving.com",
    "https://www.richmondasphaltpaving.com",
    "https://atlantaasphaltpavingpros.com",
    "https://www.atlantaasphaltpavingpros.com",
    "https://asphaltpavingkansascity.com",
    "https://www.asphaltpavingkansascity.com",
    "https://savannahasphaltpaving.com",
    "https://www.savannahasphaltpaving.com",
    "https://carolinablacktop.com",
    "https://www.carolinablacktop.com",
    "http://localhost:5173",  # Vite dev server
    "http://localhost:3000",
] + _EXTRA_ORIGINS

# SECURITY: this used to be r"https://([\w-]+--)?[\w-]+\.netlify\.app" — i.e.
# ANY *.netlify.app subdomain, combined with allow_credentials=True below.
# netlify.app subdomains are free and self-service, so any attacker could
# register one and hold a credentialed cross-origin grant against this API.
# Verified 2026-07-26 against production: a preflight from the invented origin
# https://evil-attacker-site.netlify.app came back with
# `access-control-allow-origin: https://evil-attacker-site.netlify.app`.
#
# It was then replaced with r"https://[\w-]+\.vercel\.app" to keep preview
# deploys working after the move to Vercel. That is the SAME hole wearing a
# different apex: vercel.app subdomains are also free and self-service, so the
# credentialed grant was never actually closed, only relocated.
#
# So it now defaults to off. Note the honest cost, because an earlier version
# of this comment got it wrong: previews DO call this API cross-origin. The
# frontend defaults to `https://jworden-api.fly.dev` (see
# src/config/integration.js and the components that fall back to it), so it
# does not go through the same-origin /api/* rewrite in vercel.json. Preview
# deploys therefore lose API access until CORS_ORIGIN_REGEX is set. Production
# is unaffected — every live domain is allow-listed explicitly above.
#
# If you set it, it MUST be fully anchored to hostnames you control, including
# the Vercel team slug — never a whole shared apex:
#   CORS_ORIGIN_REGEX=^https://jworden-production-[\w-]+-<team-slug>\.vercel\.app$
_DEPLOY_PREVIEW_ORIGIN_REGEX = (os.getenv("CORS_ORIGIN_REGEX") or "").strip() or None

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_origin_regex=_DEPLOY_PREVIEW_ORIGIN_REGEX,
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
    # simple request trace id for correlating logs
    import uuid

    trace_id = uuid.uuid4().hex
    response = None
    unhandled_exc: Exception | None = None
    try:
        response = await call_next(request)
        # attach trace id for observability
        if hasattr(response, "headers"):
            response.headers["X-Trace-Id"] = trace_id
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
            "request: trace=%s method=%s path=%s status=%d latency_ms=%.2f",
            trace_id,
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
app.include_router(plan_estimator_router.router)
app.include_router(analytics_router.router)
app.include_router(voice_router.router)
app.include_router(lien_calendar_router.router)
app.include_router(subcontractors_router.router)
app.include_router(market_intelligence_router.router)
app.include_router(materials_router.router)
app.include_router(tenants_router.router)
app.include_router(jarvis_router.router)
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
app.include_router(email_sync_router.router)

# Mathematical AI (pavement scoring, cost estimation, lead quality, maintenance)
app.include_router(math_ai_router.router)

# Command Center site metrics (compliance + ad ROI for Tremor dashboard)
app.include_router(site_metrics_router.router)

# Kickserv integration + dump-truck nearest-neighbor route optimization
app.include_router(kickserv_router.router)

# Unified Google Reporting (Ads + Search Console + GA4 combined KPI summary)
app.include_router(facebook_page_router.router)
app.include_router(google_reporting_router.router)

# Intelligent compaction telemetry (IoT roller pings + density heat map)
app.include_router(commercial_assessment_router.router)
app.include_router(compaction_router.router)

# Drone scan ingest (photogrammetry / LiDAR / thermal per project site)
app.include_router(drone_scan_router.router)

# Live site SSE stream (truck positions + compaction pings every 5s)
app.include_router(live_site_router.router)

# 50-State license verification + compliance tracking + site PPE inspection
app.include_router(compliance_router.router)

# Agentic what-if schedule simulator (GPT-4o or rule-based fallback)
app.include_router(schedule_sim_router.router)

# Autonomous Agentic Ads Intelligence: URL exclusions, CRM export, lead qualifier, anomaly detection
app.include_router(ads_intelligence_router.router)

# J. Worden | Authority — Gemini-powered Verified Proof content engine for city pages
app.include_router(authority_router.router)

# Spatial AI (as-built deviation check) + GC Cost Catalog & Estimates
app.include_router(spatial_ai_router.router)
app.include_router(spatial_ai_router.catalog_router)

# Statewide intelligence: SCC entity verification + VDOT bid board
app.include_router(scc_router.router)
app.include_router(vdot_bids_router.router)

# Level 4 Autonomous Intelligence
app.include_router(autonomy_router.router)
app.include_router(autonomy_router.public_router)  # public kill-switch /state + /freeze

# Automated quoting engine (PavingEvaluation → priced proposal)
app.include_router(quotes_router.router)

# Admin 2FA (TOTP enrollment, verify, disable, status)
app.include_router(admin_2fa_router.router)

# Twilio Verify (SMS OTP for 2FA fallback + lead phone verification)
app.include_router(twilio_verify_router.router)
app.include_router(admin_integrations_router.router)
app.include_router(features_router.router)
app.include_router(crew_wearables_router.public_router)
app.include_router(crew_wearables_router.admin_router)
app.include_router(search_pulse_router.router)
app.include_router(gbp_router.router)
app.include_router(dispatch_router.router)
app.include_router(asphalt_thermal_router.router)
app.include_router(drone_capture_router.router)
app.include_router(lidar_ingest_router.router)
app.include_router(roller_telemetry_router.router)
app.include_router(roller_telemetry_router.admin_router)
app.include_router(staff_router.router)
app.include_router(staff_router.admin_router)

# Human-in-the-loop review queue
app.include_router(human_review_router.router)

# Full-text search (Elasticsearch-backed)
app.include_router(search_router.router)
# Public concierge chat — Mr. Worden widget (no auth, rate-limited)
app.include_router(public_chat_router.router)
app.include_router(operations_router.router)
app.include_router(audit_admin_router.router)
app.include_router(tech_intelligence_router.router)
app.include_router(predictive_capital_router.router)
app.include_router(driveway_growth_router.router)
app.include_router(scan_campaign_router.router)


# ── Resolve Pydantic forward references ──────────────────────────────────────
# Many routers use `from __future__ import annotations`, which turns every
# Pydantic model annotation into a ForwardRef. FastAPI's /openapi.json then
# fails with PydanticUserError ("X is not fully defined"). Walk every BaseModel
# in every loaded router module and call .model_rebuild() to resolve them.
def _rebuild_router_models() -> None:
    import inspect as _inspect
    import sys as _sys

    from pydantic import BaseModel as _BaseModel

    rebuilt = 0
    for _mod_name, _mod in list(_sys.modules.items()):
        if not _mod_name.startswith("app.routers"):
            continue
        if _mod is None:
            continue
        try:
            for _name, _obj in _inspect.getmembers(_mod, _inspect.isclass):
                if _obj is _BaseModel:
                    continue
                if not issubclass(_obj, _BaseModel):
                    continue
                if _obj.__module__ != _mod_name:
                    continue
                try:
                    _obj.model_rebuild()
                    rebuilt += 1
                except Exception:  # noqa: BLE001
                    # Best-effort; individual model failures shouldn't block startup.
                    pass
        except Exception:  # noqa: BLE001
            continue
    logger.info("Pydantic model_rebuild() completed for %d router models", rebuilt)


_rebuild_router_models()

# Neural TTS for Jarvis / Mr. Worden voice (OpenAI / ElevenLabs)
app.include_router(tts_router.router)
app.include_router(local_proof_router.router)

# Ported routers (see import block above).
app.include_router(abilities_router.router)
app.include_router(b2g_bids_router.router)
app.include_router(bid_hunter_router.router)
app.include_router(billing_router.router)
app.include_router(factory_router.router)
app.include_router(revenue_router.router)
app.include_router(lms_router.router)
app.include_router(market_orchestration_router.router)
app.include_router(owner_auth_router.router)
app.include_router(portal_router.router)
app.include_router(superadmin_router.router)
app.include_router(supply_chain_router.router)
app.include_router(system_router.router)


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


# ── Sentry test ───────────────────────────────────────────────────────────────
# Hit GET /sentry-test to trigger a deliberate exception and confirm that Sentry
# is capturing and reporting errors from this environment.  Remove or gate behind
# auth once the integration has been verified.


@app.get("/sentry-test", tags=["ops"])
def sentry_test():
    raise Exception("Sentry is working! 🎉")
