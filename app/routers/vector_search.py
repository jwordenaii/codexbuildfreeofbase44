"""
vector_search.py — Public semantic search endpoint for blog posts.

Endpoints:
  GET /api/v1/search/semantic?q=sealcoating&limit=10
      Returns blog posts semantically similar to the query string.
      No authentication required — this is a public-facing search endpoint.

Semantic search uses OpenAI embeddings + Pinecone vector similarity so
customers find relevant content even when they use different keywords than
those in the post (e.g. searching "driveway repair" finds posts about
"asphalt patching" and "pothole filling").
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query, Request

from ..core.limiter import limiter
from ..services.vector_search_service import vector_search_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/search", tags=["search"])


@router.get("/semantic", summary="Semantic search over blog posts")
@limiter.limit("30/minute")
def semantic_search(
    request: Request,
    q: str = Query(..., min_length=2, max_length=500, description="Search query"),
    limit: int = Query(default=10, ge=1, le=50, description="Maximum results to return"),
):
    """
    Search blog posts by semantic similarity.

    Unlike keyword search, this finds posts that are *conceptually* related
    to the query even if they don't share the same words.

    **Examples**
    - `q=driveway repair` → finds posts about patching, pothole filling, resurfacing
    - `q=sealcoating benefits` → finds posts about driveway protection, longevity
    - `q=how long does asphalt last` → finds posts about lifespan, maintenance

    Results are ordered by descending similarity score (0–1).
    Only published posts are returned.
    """
    query = q.strip()
    if not query:
        raise HTTPException(status_code=422, detail="Query 'q' must not be blank")

    results = vector_search_service.search_semantic(query, limit=limit)

    return {
        "query":   query,
        "limit":   limit,
        "count":   len(results),
        "results": results,
    }
