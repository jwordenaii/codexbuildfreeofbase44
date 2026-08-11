"""
health.py — Health check endpoints for Railway deployment probes.

Routes:
  GET /health        — basic liveness (already registered in main.py, kept for compat)
  GET /health/live   — liveness probe: is the process up?
  GET /health/ready  — readiness probe: are all dependencies reachable?

Railway should be configured to use /health/ready as the health check path.
Returns HTTP 200 when healthy, HTTP 503 when any critical dependency is down.
"""

import logging
import time

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from ..core.security import verify_premium_security
from ..services.celery_health import (
    check_celery_workers,
    check_queue_depth,
    check_redis_connection,
)
from ..services import autonomy_state
from ..services import web_search as _web_search
from ..services import vapi_caller as _vapi
from ..services import tts_service as _tts
from ..services import runtime_config as _cfg
from ..services.state_data import (
    STATE_MAP,
    TOTAL_US_JURISDICTIONS,
    WORDEN_ACTIVE_STATES,
)

logger = logging.getLogger(__name__)

# Backlog size above which /health/ready reports the background stack degraded.
# A healthy worker at concurrency 2 keeps the ready queue near zero, so a few
# hundred pending means consumption has stopped rather than merely lagged.
_QUEUE_DEPTH_WARN = 500

router = APIRouter(tags=["ops"])


def _background_stack_configured() -> bool:
    """
    Returns True when Redis/Celery broker settings are explicitly configured.

    In local dev, these env vars are often intentionally unset. In that case
    readiness should not hard-fail on localhost Redis probes.
    """
    return any(
        (
            _cfg.get("REDIS_URL").strip(),
            _cfg.get("CELERY_BROKER_URL").strip(),
            _cfg.get("CELERY_RESULT_BACKEND").strip(),
        )
    )


def _background_stack_health() -> tuple[dict, dict, dict, bool]:
    """
    Returns redis/celery/queue health plus whether the stack is configured.
    """
    configured = _background_stack_configured()
    if not configured:
        skipped = {
            "ok": True,
            "status": "skipped",
            "reason": "REDIS_URL / CELERY_BROKER_URL not configured",
        }
        return skipped, skipped.copy(), skipped.copy(), configured

    redis_status = check_redis_connection()
    celery_status = check_celery_workers()
    queue_status = check_queue_depth()
    return redis_status, celery_status, queue_status, configured


def _elasticsearch_configured() -> bool:
    """
    Returns True when Elasticsearch is explicitly configured.

    Avoid localhost timeouts in local dev where search infra is intentionally
    absent and no ELASTICSEARCH_* variables are provided.
    """
    return any(
        (
            _cfg.get("ELASTICSEARCH_HOST").strip(),
            _cfg.get("ELASTICSEARCH_URL").strip(),
            _cfg.get("ELASTICSEARCH_CLOUD_ID").strip(),
        )
    )


def _elasticsearch_health() -> dict:
    """
    Returns Elasticsearch health status, or skipped when not configured.
    """
    if not _elasticsearch_configured():
        return {
            "ok": True,
            "status": "skipped",
            "reason": "ELASTICSEARCH_HOST not configured",
        }

    try:
        from ..services import search_service  # noqa: PLC0415

        return search_service.health()
    except Exception as exc:  # noqa: BLE001
        logger.warning("ES readiness check failed: %s", exc)
        return {"ok": False, "error": str(exc)}


@router.get("/health/live", summary="Liveness probe — is the process running?")
def health_live():
    """
    Lightweight liveness check.  Returns 200 as long as the Python process is
    alive and the event loop is responsive.  Railway uses this to decide whether
    to restart the container.
    """
    return {"status": "ok", "service": "JWordenAI"}


@router.get("/health/ready", summary="Readiness probe — are all dependencies up?")
def health_ready():
    """
    Full readiness check.  Verifies:
      - Redis connectivity (required for Celery broker)
      - Celery worker availability
      - Task queue depth

    Returns 200 if all systems are operational, 503 if any critical dependency
    is unavailable.  Railway routes traffic here only when this returns 200.
    """
    start = time.monotonic()

    redis_status, celery_status, queue_status, background_configured = _background_stack_health()

    # Database connectivity — quick SELECT 1
    db_status: dict = {"ok": False, "error": "not checked"}
    try:
        from ..database import engine  # noqa: PLC0415
        from sqlalchemy import text  # noqa: PLC0415

        t0 = time.monotonic()
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_status = {"ok": True, "latency_ms": round((time.monotonic() - t0) * 1000, 2)}
    except Exception as exc:  # noqa: BLE001
        logger.warning("DB readiness check failed: %s", exc)
        db_status = {"ok": False, "error": str(exc)}

    # Elasticsearch connectivity — optional, does not affect readiness
    es_status = _elasticsearch_health()

    # Serving readiness — can this process answer HTTP? Redis and Postgres are
    # the only hard dependencies of the web tier, so only they gate the code.
    all_ok = redis_status["ok"] and db_status["ok"]

    # Background-stack health is reported SEPARATELY from the status code, and
    # this split is deliberate in both directions.
    #
    # It must not 503: nothing routes on this path today, but the moment someone
    # points a Fly health check at it, a dead worker would start evicting healthy
    # web machines — an outage caused by the monitoring, not the fault.
    #
    # It must also not keep reporting "ready", which is what it did before. The
    # old code computed celery_ok, logged a warning nobody reads, and dropped it
    # on the floor; queue depth was returned in the payload but never consulted.
    # check_celery_workers() reports ok=True with an empty worker list, so a
    # permanently dead worker looked identical to a healthy one.
    #
    # That is not hypothetical. Measured in production 2026-08-09: zero workers,
    # 5,937 messages in the ready queue, this endpoint answering 200 "ready".
    # The worker had been gone about two weeks. Nothing alarmed, because there
    # was nothing an alarm could key on.
    celery_ok = celery_status.get("ok", False)
    active_workers = celery_status.get("active_workers")
    queue_depth = queue_status.get("queue_depth")

    degraded_reasons: list[str] = []
    if background_configured:
        if not celery_ok:
            degraded_reasons.append("celery: broker unreachable or worker probe failed")
        elif not active_workers:
            # The case the old check could not see.
            degraded_reasons.append(
                "celery: 0 active workers — queued tasks are accumulating and "
                "nothing is executing them"
            )
        # llen('celery') is the READY queue, so everything counted here is pulled
        # the instant a worker connects — including lead follow-up emails whose
        # countdown has already elapsed. A large backlog is a hazard to drain,
        # not just a number: see app/routers/leads.py where follow-ups are
        # scheduled with apply_async(countdown=...).
        if isinstance(queue_depth, int) and queue_depth > _QUEUE_DEPTH_WARN:
            degraded_reasons.append(
                f"queue: {queue_depth} tasks pending (warn above {_QUEUE_DEPTH_WARN}) — "
                "all of it dispatches at once when a worker starts"
            )

    if degraded_reasons:
        logger.warning("Background stack degraded: %s", "; ".join(degraded_reasons))

    elapsed_ms = round((time.monotonic() - start) * 1000, 2)

    if not all_ok:
        status = "degraded"
    elif degraded_reasons:
        status = "serving_background_degraded"
    else:
        status = "ready"

    payload = {
        "status": status,
        # Serving and background health are separate verdicts on purpose — a
        # caller deciding whether to send traffic wants the first; a caller
        # deciding whether to alarm wants the second.
        "serving_ok": all_ok,
        "background_ok": not degraded_reasons,
        "degraded_reasons": degraded_reasons,
        "checks": {
            "redis": redis_status,
            "database": db_status,
            "celery": celery_status,
            "queue": queue_status,
            "elasticsearch": es_status,
        },
        "elapsed_ms": elapsed_ms,
    }

    status_code = 200 if all_ok else 503
    return JSONResponse(content=payload, status_code=status_code)


@router.get("/api/v1/ops/dashboard-preflight", summary="Command Center preflight (always 200)")
def dashboard_preflight():
    """
    UI-safe readiness snapshot for the owner dashboards.

    Always returns HTTP 200 so frontend polling does not hard-fail when one
    subsystem is degraded. The payload contains strict flags for infra and
    Jarvis full-capacity mode.
    """
    start = time.monotonic()

    redis_status, celery_status, queue_status, _ = _background_stack_health()

    db_status: dict = {"ok": False, "error": "not checked"}
    try:
        from ..database import engine  # noqa: PLC0415
        from sqlalchemy import text  # noqa: PLC0415

        t0 = time.monotonic()
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_status = {"ok": True, "latency_ms": round((time.monotonic() - t0) * 1000, 2)}
    except Exception as exc:  # noqa: BLE001
        logger.warning("DB preflight check failed: %s", exc)
        db_status = {"ok": False, "error": str(exc)}

    state = autonomy_state.get_state()
    anthropic_ready = bool(_cfg.get("ANTHROPIC_API_KEY").strip())
    web_ready = _web_search.is_available()
    call_ready = _vapi.is_available()
    email_ready = bool(_cfg.get("SENDGRID_API_KEY").strip() and _cfg.get("SENDGRID_FROM_EMAIL").strip())
    tts_provider = _tts.active_provider()
    tts_ready = tts_provider != "none"
    frozen = bool(state.get("frozen"))

    jarvis_blockers: list[str] = []
    if frozen:
        jarvis_blockers.append("Autonomy is frozen")
    if not anthropic_ready:
        jarvis_blockers.append("ANTHROPIC_API_KEY missing")
    if not web_ready:
        jarvis_blockers.append("TAVILY_API_KEY missing")
    if not call_ready:
        jarvis_blockers.append("Vapi integration not fully configured")
    if not email_ready:
        jarvis_blockers.append("SENDGRID_API_KEY/SENDGRID_FROM_EMAIL missing")
    if not tts_ready:
        jarvis_blockers.append("No TTS provider configured")

    # Uploaded files (staff photos, signed compliance documents, drone/lidar
    # captures) are only durable when object storage is attached. Surface it
    # here so "are my uploads safe?" is answerable at a glance instead of being
    # discovered after a redeploy has already eaten them.
    try:
        from ..services import object_storage  # noqa: PLC0415

        storage_status = object_storage.storage_status()
    except Exception as exc:  # noqa: BLE001
        logger.warning("object storage preflight failed: %s", exc)
        storage_status = {"enabled": False, "error": str(exc)}

    infra_ok = bool(redis_status.get("ok") and db_status.get("ok"))
    jarvis_full_capacity = len(jarvis_blockers) == 0
    elapsed_ms = round((time.monotonic() - start) * 1000, 2)

    return {
        "ok": infra_ok,
        "status": "ready" if infra_ok else "degraded",
        "infra": {
            "redis": redis_status,
            "database": db_status,
            "celery": celery_status,
            "queue": queue_status,
            "object_storage": storage_status,
        },
        "jarvis": {
            "full_capacity": jarvis_full_capacity,
            "engine": "anthropic-claude" if anthropic_ready else "heuristic-fallback",
            "model": _cfg.anthropic_model() if anthropic_ready else None,
            "tools": {
                "web_search": web_ready,
                "make_phone_call": call_ready,
                "send_email": email_ready,
                "tts": tts_ready,
            },
            "tts_provider": tts_provider,
            "autonomy": {
                "master": state.get("master"),
                "frozen": frozen,
                "frozenAt": state.get("frozenAt"),
            },
            "blockers": jarvis_blockers,
        },
        "elapsed_ms": elapsed_ms,
    }


@router.get("/api/v1/ops/state-reach", summary="State rollout coverage snapshot")
def state_reach_snapshot():
    """
    Returns operational visibility for staged state expansion.

    This endpoint is read-only and safe for dashboard polling.
    """
    all_codes = sorted(STATE_MAP.keys())
    active_codes = [abbr for abbr in WORDEN_ACTIVE_STATES if abbr in STATE_MAP]
    active_set = set(active_codes)
    inactive_codes = [abbr for abbr in all_codes if abbr not in active_set]

    total_jurisdictions = TOTAL_US_JURISDICTIONS or len(all_codes)
    active_count = len(active_set)
    inactive_count = max(total_jurisdictions - active_count, 0)
    coverage_pct = round((active_count / total_jurisdictions) * 100, 2) if total_jurisdictions else 0.0

    density_rank = {"high": 3, "medium": 2, "low": 1}
    priority_candidates = sorted(
        [
            {
                "abbr": abbr,
                "name": STATE_MAP[abbr].get("name"),
                "region": STATE_MAP[abbr].get("region"),
                "qsrDensity": STATE_MAP[abbr].get("qsrDensity"),
                "laborIndex": STATE_MAP[abbr].get("laborIndex"),
                "materialPremium": STATE_MAP[abbr].get("materialPremium"),
            }
            for abbr in inactive_codes
        ],
        key=lambda row: (
            -(density_rank.get(str(row.get("qsrDensity", "")).lower(), 0)),
            -(row.get("laborIndex") or 0),
            row.get("abbr") or "",
        ),
    )[:12]

    return {
        "total_jurisdictions": total_jurisdictions,
        "active_count": active_count,
        "inactive_count": inactive_count,
        "coverage_pct": coverage_pct,
        "active_states": active_codes,
        "inactive_states": inactive_codes,
        "priority_candidates": priority_candidates,
        "dataset_integrity": {
            "state_map_count": len(all_codes),
            "expected_count": TOTAL_US_JURISDICTIONS,
            "ok": len(all_codes) == TOTAL_US_JURISDICTIONS,
        },
    }


@router.get(
    "/api/v1/ops/self-heal/status",
    summary="Self-heal monitor status (admin only)",
)
def self_heal_status(_: dict = Depends(verify_premium_security)):
    """Returns config + last execution state for the continuous self-heal loop."""
    from ..services.self_heal import get_self_heal_status  # noqa: PLC0415

    return get_self_heal_status()
