"""
metrics.py — Operational monitoring endpoints for JWordenAI.

Routes (all require premium security):
  GET /api/v1/metrics/celery    — Celery queue depth, active tasks, failed tasks
  GET /api/v1/metrics/redis     — Redis memory usage, key count, connected clients
  GET /api/v1/metrics/database  — Postgres connection pool stats, query latency
  GET /api/v1/metrics/ai        — OpenAI call counters, latency, error rate
  GET /api/v1/metrics/cache     — Redis cache hit/miss ratio and counters

All endpoints are rate-limited to 30/minute and require the premium security
header (master key or JWT).
"""

from __future__ import annotations

import logging
import os
import time

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from ..core.cache import get_cache_stats
from ..core.limiter import HEALTH_LIMIT, limiter
from ..core.security import verify_premium_security
from ..services.celery_health import (
    check_celery_workers,
    check_queue_depth,
    check_redis_connection,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/metrics", tags=["metrics"])

_REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")


# ── Celery metrics ────────────────────────────────────────────────────────────

@router.get("/celery", summary="Celery queue depth, active tasks, and worker status")
@limiter.limit(HEALTH_LIMIT)
async def celery_metrics(
    request: Request,
    _: dict = Depends(verify_premium_security),
):
    """Return Celery broker queue depth, active task counts, and worker availability."""
    workers = check_celery_workers()
    queue = check_queue_depth()

    active_tasks: dict = {}
    reserved_tasks: dict = {}
    failed_tasks_count: int = 0

    try:
        from ..celery_app import celery_app  # noqa: PLC0415

        inspector = celery_app.control.inspect(timeout=3.0)
        active_tasks = inspector.active() or {}
        reserved_tasks = inspector.reserved() or {}

        # Count total active tasks across all workers
        total_active = sum(len(v) for v in active_tasks.values())
        total_reserved = sum(len(v) for v in reserved_tasks.values())
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not inspect Celery tasks: %s", exc)
        total_active = 0
        total_reserved = 0

    return {
        "workers": workers,
        "queue": queue,
        "active_tasks": total_active,
        "reserved_tasks": total_reserved,
    }


# ── Redis metrics ─────────────────────────────────────────────────────────────

@router.get("/redis", summary="Redis memory usage, key count, and client connections")
@limiter.limit(HEALTH_LIMIT)
async def redis_metrics(
    request: Request,
    _: dict = Depends(verify_premium_security),
):
    """Return Redis server INFO stats: memory, key count, connected clients."""
    ping = check_redis_connection()
    if not ping["ok"]:
        return JSONResponse(
            status_code=503,
            content={"status": "unavailable", "error": ping.get("error")},
        )

    try:
        import redis as redis_lib  # type: ignore

        client = redis_lib.from_url(_REDIS_URL, socket_connect_timeout=3, socket_timeout=3)
        info = client.info()
        db_info = client.info("keyspace")
        client.close()

        total_keys = sum(
            v.get("keys", 0) for v in db_info.values() if isinstance(v, dict)
        )

        return {
            "status": "ok",
            "latency_ms": ping.get("latency_ms"),
            "used_memory_human": info.get("used_memory_human"),
            "used_memory_bytes": info.get("used_memory"),
            "peak_memory_human": info.get("used_memory_peak_human"),
            "connected_clients": info.get("connected_clients"),
            "total_keys": total_keys,
            "redis_version": info.get("redis_version"),
            "uptime_seconds": info.get("uptime_in_seconds"),
            "evicted_keys": info.get("evicted_keys", 0),
            "keyspace_hits": info.get("keyspace_hits", 0),
            "keyspace_misses": info.get("keyspace_misses", 0),
        }
    except Exception as exc:  # noqa: BLE001
        logger.error("Redis metrics collection failed: %s", exc)
        return JSONResponse(
            status_code=503,
            content={"status": "error", "error": str(exc)},
        )


# ── Database metrics ──────────────────────────────────────────────────────────

@router.get("/database", summary="Postgres connection pool stats and query latency")
@limiter.limit(HEALTH_LIMIT)
async def database_metrics(
    request: Request,
    _: dict = Depends(verify_premium_security),
):
    """Return SQLAlchemy connection pool stats and a SELECT 1 latency probe."""
    try:
        from ..database import engine  # noqa: PLC0415
        from sqlalchemy import text  # noqa: PLC0415

        pool = engine.pool

        t0 = time.monotonic()
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        latency_ms = round((time.monotonic() - t0) * 1000, 2)

        pool_status: dict = {
            "pool_size": getattr(pool, "size", lambda: None)(),
            "checked_out": getattr(pool, "checkedout", lambda: None)(),
            "overflow": getattr(pool, "overflow", lambda: None)(),
            "checked_in": getattr(pool, "checkedin", lambda: None)(),
        }

        return {
            "status": "ok",
            "query_latency_ms": latency_ms,
            "pool": pool_status,
            "database_url_host": engine.url.host,
            "dialect": engine.dialect.name,
        }
    except Exception as exc:  # noqa: BLE001
        logger.error("Database metrics collection failed: %s", exc)
        return JSONResponse(
            status_code=503,
            content={"status": "error", "error": str(exc)},
        )


# ── AI / OpenAI metrics ───────────────────────────────────────────────────────

# In-process counters — reset on worker restart.  For persistent metrics,
# integrate with Prometheus or a time-series DB.
_ai_counters: dict[str, int | float] = {
    "total_calls": 0,
    "successful_calls": 0,
    "failed_calls": 0,
    "total_latency_ms": 0.0,
}


def record_ai_call(success: bool, latency_ms: float) -> None:
    """Call this from AI endpoints to update in-process counters."""
    _ai_counters["total_calls"] += 1
    _ai_counters["total_latency_ms"] += latency_ms
    if success:
        _ai_counters["successful_calls"] += 1
    else:
        _ai_counters["failed_calls"] += 1


@router.get("/ai", summary="OpenAI API call counts, latency, and error rate")
@limiter.limit(HEALTH_LIMIT)
async def ai_metrics(
    request: Request,
    _: dict = Depends(verify_premium_security),
):
    """
    Return in-process OpenAI call statistics since the last worker restart.

    Note: counters are per-worker-process and reset on restart.  For
    persistent metrics, configure Sentry performance monitoring or export
    to an external time-series store.
    """
    total = _ai_counters["total_calls"]
    avg_latency = (
        round(_ai_counters["total_latency_ms"] / total, 2) if total > 0 else 0.0
    )
    error_rate = (
        round(_ai_counters["failed_calls"] / total * 100, 2) if total > 0 else 0.0
    )

    openai_configured = bool(os.getenv("OPENAI_API_KEY", ""))

    return {
        "openai_configured": openai_configured,
        "total_calls": total,
        "successful_calls": _ai_counters["successful_calls"],
        "failed_calls": _ai_counters["failed_calls"],
        "error_rate_pct": error_rate,
        "avg_latency_ms": avg_latency,
        "note": "Counters are per-process and reset on worker restart.",
    }


# ── Cache metrics ─────────────────────────────────────────────────────────────


@router.get("/cache", summary="Redis cache hit/miss ratio and per-key counters")
@limiter.limit(HEALTH_LIMIT)
async def cache_metrics(
    request: Request,
    _: dict = Depends(verify_premium_security),
):
    """
    Return in-process cache hit/miss counters and the computed hit ratio.

    Counters are per-worker-process and reset on restart.  A hit_ratio_pct
    above 70 % indicates the cache is working effectively.  Below 30 % may
    indicate TTLs are too short or the cache warmer is not running.
    """
    stats = get_cache_stats()
    return {
        **stats,
        "note": "Counters are per-process and reset on worker restart.",
    }
