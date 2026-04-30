"""
monitoring.py — Datadog + Slack monitoring endpoints.

Routes:
  GET /api/v1/monitoring/health          — Public health check with dependency status
  GET /api/v1/admin/monitoring/status    — Admin-only monitoring configuration status

The health endpoint is intentionally public (no auth) so external uptime
monitors (UptimeRobot, Datadog Synthetics, etc.) can poll it without a token.

The admin status endpoint requires the premium security bearer token and
returns the full monitoring configuration, including which integrations are
active and the current Datadog/Slack settings.
"""

from __future__ import annotations

import logging
import time

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from ..core.limiter import HEALTH_LIMIT, limiter
from ..core.security import verify_premium_security
from ..services.monitoring_service import monitoring

logger = logging.getLogger(__name__)

router = APIRouter(tags=["monitoring"])


# ── Public health check ───────────────────────────────────────────────────────


@router.get(
    "/api/v1/monitoring/health",
    summary="Health check with dependency status",
    response_description="Service health and dependency availability",
)
@limiter.limit(HEALTH_LIMIT)
async def monitoring_health(request: Request):
    """
    Public health check endpoint.  Returns HTTP 200 when the API is healthy
    and HTTP 503 when any critical dependency (database, Redis) is unavailable.

    Suitable for:
    - Datadog Synthetic monitors
    - UptimeRobot / Better Uptime / Pingdom
    - External status pages
    """
    start = time.monotonic()

    # ── Database probe ────────────────────────────────────────────────────────
    db_status: dict = {"ok": False, "error": "not checked"}
    try:
        from ..database import engine  # noqa: PLC0415
        from sqlalchemy import text  # noqa: PLC0415

        t0 = time.monotonic()
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_status = {"ok": True, "latency_ms": round((time.monotonic() - t0) * 1000, 2)}
    except Exception as exc:  # noqa: BLE001
        error_msg = str(exc)
        logger.error("Health check: database unavailable: %s", error_msg)
        db_status = {"ok": False, "error": error_msg}
        # Fire Slack + Datadog alert for DB failure
        monitoring.alert_db_failure(error_msg)

    # ── Redis probe ───────────────────────────────────────────────────────────
    redis_status: dict = {"ok": False, "error": "not checked"}
    try:
        from ..services.celery_health import check_redis_connection  # noqa: PLC0415

        redis_status = check_redis_connection()
    except Exception as exc:  # noqa: BLE001
        redis_status = {"ok": False, "error": str(exc)}

    elapsed_ms = round((time.monotonic() - start) * 1000, 2)
    all_ok = db_status["ok"] and redis_status["ok"]

    # Ship latency metric to Datadog
    monitoring.log_metric(
        "api.health_check.latency_ms",
        elapsed_ms,
        tags=["endpoint:/api/v1/monitoring/health"],
    )
    monitoring.log_metric(
        "api.health_check.status",
        1 if all_ok else 0,
        tags=["endpoint:/api/v1/monitoring/health"],
    )

    payload = {
        "status": "healthy" if all_ok else "degraded",
        "service": "jworden-api",
        "checks": {
            "database": db_status,
            "redis": redis_status,
        },
        "elapsed_ms": elapsed_ms,
    }

    return JSONResponse(content=payload, status_code=200 if all_ok else 503)


# ── Admin monitoring status ───────────────────────────────────────────────────


@router.get(
    "/api/v1/admin/monitoring/status",
    summary="Monitoring configuration status (admin only)",
    response_description="Datadog and Slack integration status",
)
@limiter.limit(HEALTH_LIMIT)
async def monitoring_status(
    request: Request,
    _: dict = Depends(verify_premium_security),
):
    """
    Admin-only endpoint that returns the current monitoring configuration.

    Shows whether Datadog and Slack integrations are active, the configured
    environment/service/version tags, and a summary of what is being monitored.

    Requires a valid bearer token (master key or JWT).
    """
    mon_status = monitoring.status()

    return {
        "monitoring": {
            **mon_status,
            "alert_thresholds": {
                "error_rate_pct": 5.0,
                "latency_p95_ms": 1000,
                "consecutive_health_failures": 2,
            },
            "alert_channels": {
                "slack": mon_status["slack_enabled"],
                "datadog_events": mon_status["datadog_enabled"],
            },
            "tracked_metrics": [
                "api.errors.5xx",
                "api.request.latency_ms",
                "api.health_check.latency_ms",
                "api.health_check.status",
                "api.db.connection_failures",
                "api.elasticsearch.unavailable",
            ],
            "alert_conditions": [
                "5xx HTTP errors",
                "Error rate > 5% of requests",
                "p95 latency > 1000ms",
                "Database connection failures",
                "Elasticsearch unavailable",
            ],
        }
    }
