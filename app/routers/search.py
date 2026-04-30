"""
search.py — Public blog search endpoint.

Endpoints:
  GET /api/v1/search/blog?q=sealcoating&limit=10
      Full-text search across published blog posts.
      Returns results with title, excerpt, slug, and relevance score.
      No authentication required.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query, Request

from ..core.limiter import limiter
from ..services.search_service import search_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/search", tags=["search"])


@router.get("/blog", summary="Full-text search across published blog posts")
@limiter.limit("60/minute")
def search_blog(
    request: Request,
    q: str = Query(..., min_length=1, max_length=200, description="Search query"),
    limit: int = Query(default=10, ge=1, le=50, description="Maximum number of results"),
):
    """
    Search published blog posts using Elasticsearch full-text search.

    Supports:
    - **Phrase search**: wrap terms in quotes, e.g. `"sealcoating driveway"`
    - **Fuzzy matching**: minor typos are tolerated automatically
    - **Boolean**: multiple terms are scored across title, excerpt, and body

    Results are ranked by relevance score (highest first).
    """
    query = q.strip()
    if not query:
        raise HTTPException(status_code=422, detail="Search query cannot be empty")

    results = search_service.search_blog(query=query, limit=limit)

    return {
        "query":   query,
        "limit":   limit,
        "total":   len(results),
        "results": results,
    }
