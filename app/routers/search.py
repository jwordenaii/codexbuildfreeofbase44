"""
search.py — Full-text search endpoints powered by Elasticsearch.

Endpoints
─────────
  GET  /api/v1/search              — Full-text search across blog posts and content blocks
  POST /api/v1/search/reindex      — Rebuild all Elasticsearch indexes (admin only)
  GET  /api/v1/search/status       — Elasticsearch cluster health check

Query parameters for GET /api/v1/search
────────────────────────────────────────
  q        (required) — search query string
  type     (optional) — "blog" | "content" | "all"  (default: "all")
  category (optional) — filter blog posts by category
  status   (optional) — filter blog posts by status (default: "published")
  size     (optional) — max results to return (default: 20, max: 100)
  page     (optional) — 1-based page number (default: 1)

Graceful degradation
────────────────────
  All endpoints return safe empty/degraded responses when Elasticsearch is
  unavailable, so the rest of the API continues to function normally.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from ..core.limiter import limiter
from ..core.security import verify_premium_security
from ..database import get_db
from ..models import BlogPost, PageContent
from ..services import search_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/search", tags=["search"])


# ── Public: full-text search ──────────────────────────────────────────────────

@router.get("", summary="Full-text search across blog posts and content blocks")
@limiter.limit("60/minute")
def search_content(
    request: Request,
    q: str = Query(..., min_length=1, max_length=500, description="Search query"),
    type: Optional[str] = Query(
        default="all",
        description="Document type filter: 'blog' | 'content' | 'all'",
    ),
    category: Optional[str] = Query(
        default=None,
        description="Filter blog posts by category",
    ),
    status: Optional[str] = Query(
        default="published",
        description="Filter blog posts by status (default: published)",
    ),
    size: int = Query(default=20, ge=1, le=100, description="Max results per page"),
    page: int = Query(default=1, ge=1, description="Page number (1-based)"),
):
    """
    Full-text search across blog posts and CMS content blocks.

    Results are ranked by relevance score.  Title matches are boosted 3×,
    excerpt matches 2×, and body/tags matches are weighted normally.
    Fuzzy matching is applied automatically for typo tolerance.

    Returns an empty result set (not an error) when Elasticsearch is
    unavailable, so the frontend can degrade gracefully.
    """
    filters: dict[str, str] = {}
    if type:
        filters["type"] = type
    if category:
        filters["category"] = category
    if status:
        filters["status"] = status

    # Adjust size for pagination (ES doesn't paginate natively here — we
    # fetch page * size and slice, keeping it simple for now)
    fetch_size = min(size * page, 100)

    result = search_service.search(query=q, filters=filters, size=fetch_size)

    # Slice to the requested page
    all_hits = result.get("hits", [])
    start = (page - 1) * size
    end = start + size
    page_hits = all_hits[start:end]

    return {
        "query":   q,
        "type":    type or "all",
        "total":   result.get("total", 0),
        "page":    page,
        "size":    size,
        "hits":    page_hits,
        "es_available": len(all_hits) > 0 or result.get("total", 0) == 0,
    }


# ── Admin: reindex all content ────────────────────────────────────────────────

@router.post("/reindex", summary="Rebuild all Elasticsearch indexes (admin only)")
@limiter.limit("5/minute")
async def reindex_all(
    request: Request,
    db: Session = Depends(get_db),
    security: dict = Depends(verify_premium_security),
):
    """
    Re-index every published blog post and all CMS content blocks.

    This is a synchronous operation — for large datasets consider running
    it as a background task.  Typically completes in under a second for
    hundreds of documents.

    Requires a valid bearer token (same as other admin endpoints).
    """
    es_status = search_service.health()
    if not es_status.get("ok"):
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Elasticsearch is unavailable — cannot reindex",
                "es_status": es_status,
            },
        )

    # Index all blog posts
    blog_posts = db.query(BlogPost).all()
    blog_ok = 0
    blog_fail = 0
    for post in blog_posts:
        if search_service.index_blog_post(post):
            blog_ok += 1
        else:
            blog_fail += 1

    # Index all content blocks
    content_blocks = db.query(PageContent).all()
    content_ok = 0
    content_fail = 0
    for block in content_blocks:
        if search_service.index_content_block(block):
            content_ok += 1
        else:
            content_fail += 1

    total_indexed = blog_ok + content_ok
    total_failed = blog_fail + content_fail

    logger.info(
        "Reindex complete: blog=%d/%d content=%d/%d",
        blog_ok, len(blog_posts),
        content_ok, len(content_blocks),
    )

    return {
        "status":        "complete" if total_failed == 0 else "partial",
        "total_indexed": total_indexed,
        "total_failed":  total_failed,
        "blog_posts": {
            "total":   len(blog_posts),
            "indexed": blog_ok,
            "failed":  blog_fail,
        },
        "content_blocks": {
            "total":   len(content_blocks),
            "indexed": content_ok,
            "failed":  content_fail,
        },
    }


# ── Public: Elasticsearch health status ──────────────────────────────────────

@router.get("/status", summary="Elasticsearch cluster health")
@limiter.limit("30/minute")
def search_status(request: Request):
    """
    Returns the current Elasticsearch cluster health.

    This endpoint is intentionally public so monitoring tools and the
    frontend can check search availability without authentication.
    Returns HTTP 200 in all cases — check the ``ok`` field in the response
    body to determine whether ES is operational.
    """
    status = search_service.health()
    return {
        "elasticsearch": status,
        "search_available": status.get("ok", False),
    }
