"""
celery_health.py — Health check helpers for Celery, Redis, and task queues.

Used by /health/ready to determine whether background infrastructure is
operational before Railway routes traffic to this instance.
"""

from __future__ import annotations

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

_REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")


def check_redis_connection() -> dict[str, Any]:
    """
    Ping Redis and return a status dict.

    Returns:
        {"ok": True, "latency_ms": float} on success
        {"ok": False, "error": str} on failure
    """
    import time

    try:
        import redis as redis_lib  # type: ignore

        client = redis_lib.from_url(_REDIS_URL, socket_connect_timeout=3, socket_timeout=3)
        start = time.monotonic()
        client.ping()
        latency_ms = round((time.monotonic() - start) * 1000, 2)
        client.close()
        return {"ok": True, "latency_ms": latency_ms}
    except Exception as exc:  # noqa: BLE001
        logger.warning("Redis health check failed: %s", exc)
        return {"ok": False, "error": str(exc)}


def check_celery_workers() -> dict[str, Any]:
    """
    Inspect active Celery workers via the broker.

    Returns:
        {"ok": True, "active_workers": int, "worker_names": list[str]} on success
        {"ok": False, "error": str} on failure
    """
    try:
        from ..celery_app import celery_app  # noqa: PLC0415

        inspector = celery_app.control.inspect(timeout=3.0)
        ping_result = inspector.ping() or {}
        worker_names = list(ping_result.keys())
        return {
            "ok": True,
            "active_workers": len(worker_names),
            "worker_names": worker_names,
        }
    except Exception as exc:  # noqa: BLE001
        logger.warning("Celery worker health check failed: %s", exc)
        return {"ok": False, "error": str(exc)}


def check_queue_depth() -> dict[str, Any]:
    """
    Return the number of pending tasks in the default Celery queue.

    Returns:
        {"ok": True, "queue_depth": int} on success
        {"ok": False, "error": str} on failure
    """
    try:
        import redis as redis_lib  # type: ignore

        client = redis_lib.from_url(_REDIS_URL, socket_connect_timeout=3, socket_timeout=3)
        # Celery's default queue is named "celery"
        depth = client.llen("celery")
        client.close()
        return {"ok": True, "queue_depth": int(depth)}
    except Exception as exc:  # noqa: BLE001
        logger.warning("Queue depth check failed: %s", exc)
        return {"ok": False, "error": str(exc)}
