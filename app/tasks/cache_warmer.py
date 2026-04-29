"""
cache_warmer.py — Background Celery task that pre-loads hot data into Redis.

Scheduled via Celery Beat to run every 5 minutes.  Pre-populating the cache
eliminates cold-start latency on the most expensive endpoints:
  - Analytics dashboard (60 s TTL)
  - KPI wall (5 min TTL)
  - Monthly lead volume (60 s TTL)
  - Top 100 CRM leads (30 s TTL)

The task is intentionally idempotent — running it more frequently than the
TTL simply refreshes the cache early, which is safe.

Registration
────────────
This module is listed in ``celery_app.include`` so Celery discovers the task
automatically on worker startup.  The beat schedule entry is in
``app/celery_app.py``:

    "warm-cache-every-5m": {
        "task": "app.tasks.cache_warmer.warm_cache_task",
        "schedule": crontab(minute="*/5"),
    }
"""

from __future__ import annotations

import logging

from ..celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.cache_warmer.warm_cache_task", bind=False)
def warm_cache_task() -> dict:
    """
    Celery task: pre-load hot data into Redis.

    Opens a short-lived database session, delegates to
    ``app.core.cache.warm_cache``, then closes the session.

    Returns a dict of {cache_key: success_bool} for task result inspection.
    """
    from ..core.cache import warm_cache  # noqa: PLC0415
    from ..database import SessionLocal  # noqa: PLC0415

    db = SessionLocal()
    try:
        results = warm_cache(db)
        logger.info("Cache warmer completed: %s", results)
        return results
    except Exception as exc:  # noqa: BLE001
        logger.error("Cache warmer failed: %s", exc, exc_info=True)
        return {"error": str(exc)}
    finally:
        db.close()
