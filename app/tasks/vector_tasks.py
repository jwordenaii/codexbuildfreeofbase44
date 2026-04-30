"""
vector_tasks.py — Celery tasks for Pinecone vector index management.

Tasks
─────
  reindex_all_blog_posts_vector()
      Fetch every blog post from the database, generate OpenAI embeddings,
      and upsert all vectors into the Pinecone index.  Intended for:
        - First-time setup after adding Pinecone credentials
        - Bulk post imports
        - Index rebuilds after configuration changes

Usage
─────
  # Dispatch as a background task (non-blocking):
  from app.tasks.vector_tasks import reindex_all_blog_posts_vector
  reindex_all_blog_posts_vector.delay()

  # Run synchronously (blocks until complete — for scripts/CLI):
  reindex_all_blog_posts_vector()

The task is registered in app/celery_app.py under the 'include' list.
Workers must be running for async dispatch to execute:
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
        dict with keys: total, indexed, failed
    """
    from ..services.vector_search_service import vector_search_service  # noqa: PLC0415

    logger.info("vector_tasks: starting full blog post reindex")
    result = vector_search_service.reindex_all_blog_posts()
    logger.info(
        "vector_tasks: reindex complete — total=%d indexed=%d failed=%d",
        result.get("total", 0),
        result.get("indexed", 0),
        result.get("failed", 0),
    )
    return result


# ── Celery task registration ───────────────────────────────────────────────────

try:
    from ..celery_app import celery_app  # noqa: PLC0415

    @celery_app.task(
        name="app.tasks.vector_tasks.reindex_all_blog_posts_vector",
        bind=True,
        max_retries=2,
        default_retry_delay=120,  # 2 minutes between retries
        acks_late=True,
        time_limit=1800,          # 30-minute hard limit for large blogs
        soft_time_limit=1500,     # 25-minute soft limit (raises SoftTimeLimitExceeded)
    )
    def reindex_all_blog_posts_vector(self) -> dict:
        """
        Celery task: rebuild the entire Pinecone vector index from the database.

        Retries up to 2 times on failure with a 2-minute delay between attempts.
        Hard time limit of 30 minutes to prevent runaway tasks.

        Returns:
            Result dict with total, indexed, and failed counts.
        """
        try:
            return _execute_reindex()
        except Exception as exc:  # noqa: BLE001
            logger.error(
                "reindex_all_blog_posts_vector task failed (attempt %d/%d): %s",
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
        "Celery not available — reindex_all_blog_posts_vector will run synchronously."
    )

    def reindex_all_blog_posts_vector() -> dict:  # type: ignore[misc]
        """Synchronous fallback when Celery is not installed."""
        return _execute_reindex()
