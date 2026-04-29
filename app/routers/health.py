"""
health.py — Health check endpoints for Railway deployment probes.

Routes:
  GET /health        — basic liveness (already registered in main.py, kept for compat)
  GET /health/live   — liveness probe: is the process up?
  GET /health/ready  — readiness probe: are all dependencies reachable?

Railway should be configured to use /health/ready as the health check path.
Returns HTTP 200 when healthy, HTTP 503 when any critical dependency is down.
"""

from __future__ import annotations

import logging
import time

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ..services.celery_health import (
    check_celery_workers,
    check_queue_depth,
    check_redis_connection,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["ops"])


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

    redis_status = check_redis_connection()
    celery_status = check_celery_workers()
    queue_status = check_queue_depth()

    elapsed_ms = round((time.monotonic() - start) * 1000, 2)

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

    all_ok = redis_status["ok"] and db_status["ok"]
    # Celery workers are optional — warn but don't fail readiness if no workers
    # are running (e.g. during initial deploy before worker pod starts).
    celery_ok = celery_status.get("ok", False)
    if not celery_ok:
        logger.warning("Celery workers unavailable during readiness check")

    payload = {
        "status": "ready" if all_ok else "degraded",
        "checks": {
            "redis": redis_status,
            "database": db_status,
            "celery": celery_status,
            "queue": queue_status,
        },
        "elapsed_ms": elapsed_ms,
    }

    status_code = 200 if all_ok else 503
    return JSONResponse(content=payload, status_code=status_code)
