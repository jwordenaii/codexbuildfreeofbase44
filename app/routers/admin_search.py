"""
admin_search.py — Admin endpoints for managing the blog search index.

Endpoints:
  POST /api/v1/admin/search/reindex  — Trigger a full index rebuild (admin only)
  GET  /api/v1/admin/search/status   — Check Elasticsearch index status (admin only)

Authentication: bearer token via verify_premium_security (same as other admin routes).
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, Request

from ..core.limiter import limiter
from ..core.security import verify_premium_security
from ..services.search_service import search_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/admin/search", tags=["admin-search"])


@router.post("/reindex", summary="Rebuild the blog search index")
@limiter.limit("5/minute")
async def reindex_blog(
    request: Request,
    background_tasks: BackgroundTasks,
    security: dict = Depends(verify_premium_security),
):
    """
    Trigger a full rebuild of the Elasticsearch blog index.

    Drops the existing index and re-indexes every published blog post from
    the database.  The rebuild runs as a Celery background task when Celery
    is available; otherwise it runs synchronously in a FastAPI background task.

    Returns immediately with a `queued` or `started` status.
    """
    try:
        # Prefer Celery for non-blocking execution
        from ..tasks.search_tasks import reindex_all_blog_posts_task  # noqa: PLC0415
        reindex_all_blog_posts_task.delay()
        logger.info("Reindex task queued via Celery by user=%s", security.get("user"))
        return {
            "status":  "queued",
            "message": "Reindex task queued. Check /api/v1/admin/search/status for progress.",
        }
    except Exception:  # noqa: BLE001
        # Celery unavailable — fall back to FastAPI background task
        background_tasks.add_task(_run_reindex)
        logger.info(
            "Reindex started as background task (Celery unavailable) by user=%s",
            security.get("user"),
        )
        return {
            "status":  "started",
            "message": "Reindex running in background (Celery not available).",
        }


def _run_reindex() -> None:
    """Synchronous wrapper used by FastAPI BackgroundTasks."""
    summary = search_service.reindex_all_blog_posts()
    logger.info("Background reindex complete: %s", summary)


@router.get("/status", summary="Check Elasticsearch index status")
@limiter.limit("30/minute")
def index_status(
    request: Request,
    security: dict = Depends(verify_premium_security),
):
    """
    Return the current status of the Elasticsearch blog index.

    Response includes:
    - `available`: whether Elasticsearch is reachable
    - `doc_count`: number of documents currently indexed
    - `index_name`: the index name in use
    - `es_url`: the configured Elasticsearch URL
    - `status`: cluster health status (green / yellow / red)
    """
    status = search_service.get_index_status()
    return status
