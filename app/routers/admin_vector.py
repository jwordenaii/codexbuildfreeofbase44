"""
admin_vector.py — Admin endpoints for managing the Pinecone vector index.

Endpoints:
  POST /api/v1/admin/search/vector-reindex  — Trigger a full index rebuild
  GET  /api/v1/admin/search/vector-status   — Check index health and stats

Both endpoints require a valid bearer token (verify_premium_security).
The reindex operation is dispatched as a Celery background task so the
HTTP response returns immediately without blocking on the full rebuild.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Request

from ..core.limiter import limiter
from ..core.security import verify_premium_security
from ..services.vector_search_service import vector_search_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/admin/search", tags=["admin", "search"])


@router.post("/vector-reindex", summary="Rebuild the entire Pinecone vector index")
@limiter.limit("5/minute")
async def vector_reindex(
    request: Request,
    security: dict = Depends(verify_premium_security),
):
    """
    Dispatch a background task to reindex all blog posts in Pinecone.

    This is a long-running operation — for large blogs it may take several
    minutes.  The task is dispatched asynchronously via Celery so this
    endpoint returns immediately with a job acknowledgement.

    Falls back to a synchronous reindex if Celery is unavailable.

    **When to use**
    - First deployment after adding Pinecone credentials
    - After bulk-importing blog posts
    - After changing the embedding model or index configuration
    """
    try:
        from ..tasks.vector_tasks import reindex_all_blog_posts_vector  # noqa: PLC0415

        task = reindex_all_blog_posts_vector.delay()
        logger.info(
            "vector_reindex: task dispatched by user=%s task_id=%s",
            security.get("user"),
            task.id,
        )
        return {
            "status":  "queued",
            "task_id": task.id,
            "message": "Reindex task dispatched. Check /api/v1/admin/search/vector-status for progress.",
        }

    except Exception as exc:  # noqa: BLE001
        # Celery unavailable — run synchronously (blocks until complete)
        logger.warning(
            "vector_reindex: Celery unavailable (%s), running synchronously", exc
        )
        result = vector_search_service.reindex_all_blog_posts()
        return {
            "status":  "completed",
            "task_id": None,
            "message": "Reindex completed synchronously (Celery not available).",
            "result":  result,
        }


@router.get("/vector-status", summary="Check Pinecone vector index status")
@limiter.limit("30/minute")
def vector_status(
    request: Request,
    security: dict = Depends(verify_premium_security),
):
    """
    Return the current state of the Pinecone vector index.

    Reports whether Pinecone is configured, the total number of indexed
    vectors, and the index dimension.  Use this to verify the index is
    populated after a reindex operation.
    """
    status = vector_search_service.get_index_status()
    return {"vector_index": status}
