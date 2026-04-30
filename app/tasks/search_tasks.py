"""
search_tasks.py — Celery tasks for Elasticsearch blog index management.

Tasks
─────
  reindex_all_blog_posts_task()
      Drop and rebuild the entire blog_posts Elasticsearch index from the
      database.  Safe to run at any time; existing searches continue to work
      against the old index until the rebuild completes.

Usage
─────
  # Dispatch immediately (fire-and-forget):
  reindex_all_blog_posts_task.delay()

  # Dispatch via admin endpoint:
  POST /api/v1/admin/search/reindex

The task is registered in app/celery_app.py under the 'include' list.
Workers must be running for the task to execute asynchronously:
  celery -A app.celery_app worker --loglevel=info
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def _execute_reindex() -> dict:
    """
    Core reindex logic — separated from the Celery wrapper so it can be
    called directly in environments where Celery is not available.

    Returns:
        dict with keys: indexed, skipped, errors, total
    """
    from ..services.search_service import search_service  # noqa: PLC0415

    logger.info("Starting full blog reindex...")
    summary = search_service.reindex_all_blog_posts()
    logger.info(
        "Reindex finished: indexed=%d errors=%d total=%d",
        summary.get("indexed", 0),
        summary.get("errors", 0),
        summary.get("total", 0),
    )
    return summary


# ── Celery task registration ───────────────────────────────────────────────────

try:
    from ..celery_app import celery_app  # noqa: PLC0415

    @celery_app.task(
        name="app.tasks.search_tasks.reindex_all_blog_posts_task",
        bind=True,
        max_retries=2,
        default_retry_delay=30,
        acks_late=True,
    )
    def reindex_all_blog_posts_task(self) -> dict:
        """
        Celery task: rebuild the Elasticsearch blog_posts index.

        Drops the existing index and re-indexes every published blog post
        from the database.  Retries up to 2 times on failure.

        Returns:
            Summary dict with indexed, skipped, errors, total counts.
        """
        try:
            return _execute_reindex()
        except Exception as exc:  # noqa: BLE001
            logger.error(
                "reindex_all_blog_posts_task failed (attempt %d/%d): %s",
                self.request.retries + 1,
                self.max_retries + 1,
                exc,
            )
            try:
                import sentry_sdk  # noqa: PLC0415
                sentry_sdk.capture_exception(exc)
            except Exception:  # noqa: BLE001
                pass
            raise self.retry(exc=exc) from exc

except ImportError:
    # Celery not installed — provide a synchronous fallback for local dev / tests
    logger.warning(
        "Celery not available — reindex_all_blog_posts_task will run synchronously."
    )

    def reindex_all_blog_posts_task() -> dict:  # type: ignore[misc]
        """Synchronous fallback when Celery is not installed."""
        return _execute_reindex()
