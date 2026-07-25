import logging
import time
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from typing import Optional

import httpx

from ..core.limiter import limiter
from ..core.security import verify_premium_security
from ..services import runtime_config

router = APIRouter(prefix="/api/v1/reviews", tags=["reviews"])

logger = logging.getLogger(__name__)

# Default Google Place ID for J. Worden & Sons Paving (Chester, VA) — same
# value the public frontend links out to for "Review on Google" / the Maps
# embed. Overridable per-tenant via runtime_config GOOGLE_PLACE_ID.
_DEFAULT_PLACE_ID = "ChIJG3X8o_OStokRzRynNBuVfQ0"

# Real, verified customer reviews sourced from the company's actual public
# Houzz profile (https://www.houzz.com/professionals/paving-contractors/
# j-worden-sons-asphalt-paving-pfvwus-pf~48430947) and the blended real
# aggregate across Google/Houzz/Angi/Facebook — mirrors
# jworden-production/src/lib/reviews.js. Used only when no
# GOOGLE_PLACES_API_KEY is configured. Never invent testimonials or
# attribute reviews to real business names that didn't actually leave them.
_REVIEW_PLATFORMS = [
    {"name": "Google", "rating": 4.4, "count": 7},
    {"name": "Houzz", "rating": 4.8, "count": 12},
    {"name": "Angi", "rating": 4.5, "count": 15},
    {"name": "Facebook", "rating": 4.3, "count": 40},
]
_VERIFIED_REVIEW_COUNT = sum(p["count"] for p in _REVIEW_PLATFORMS)
_VERIFIED_AGGREGATE_RATING = round(
    sum(p["rating"] * p["count"] for p in _REVIEW_PLATFORMS) / _VERIFIED_REVIEW_COUNT, 1
)
_VERIFIED_REVIEWS = [
    {
        "author": "Greg Orlick",
        "rating": 5,
        "text": (
            "J Worden and Sons did an excellent job repaving our driveway. "
            "They were professional, on time, and the finished product looks great."
        ),
        "date": "2022-04-19",
        "source": "Houzz",
    },
    {
        "author": "jaclynforrester",
        "rating": 5,
        "text": (
            "Great experience from start to finish. Fair pricing, great communication, "
            "and quality work on our driveway."
        ),
        "date": "2016-06-23",
        "source": "Houzz",
    },
    {
        "author": "daryllhall",
        "rating": 5,
        "text": "Very pleased with the paving work. Professional crew and a fair price.",
        "date": "2015-03-30",
        "source": "Houzz",
    },
    {
        "author": "Susan Armentrout",
        "rating": 5,
        "text": (
            "J Worden & Sons did a wonderful job paving our driveway. "
            "Would recommend them to anyone looking for quality asphalt work."
        ),
        "date": "2013-11-09",
        "source": "Houzz",
    },
]


async def _fetch_live_google_reviews(api_key: str, place_id: str) -> Optional[dict]:
    """Real Google Places Details API call. Returns None on any failure so
    callers can fall back to the verified static dataset."""
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                "https://maps.googleapis.com/maps/api/place/details/json",
                params={
                    "place_id": place_id,
                    "fields": "rating,user_ratings_total,reviews",
                    "key": api_key,
                },
            )
        data = resp.json()
        if data.get("status") != "OK":
            logger.warning("Google Places Details API returned status=%s", data.get("status"))
            return None
        result = data.get("result", {})
        reviews = [
            {
                "author": r.get("author_name", "Google User"),
                "rating": r.get("rating", 5),
                "text": r.get("text", ""),
                "date": time.strftime("%Y-%m-%d", time.gmtime(r.get("time", 0))) if r.get("time") else "",
                "source": "Google",
            }
            for r in result.get("reviews", [])
        ]
        return {
            "aggregate_rating": result.get("rating", _VERIFIED_AGGREGATE_RATING),
            "total_reviews": result.get("user_ratings_total", _VERIFIED_REVIEW_COUNT),
            "reviews": reviews or _VERIFIED_REVIEWS,
            "source": "google",
        }
    except Exception as exc:
        logger.warning("Google Places Details API call failed: %s", exc)
        return None


@router.get("", summary="Get reviews with aggregate rating")
async def get_reviews():
    api_key = (runtime_config.get("GOOGLE_PLACES_API_KEY") or "").strip()
    place_id = (runtime_config.get("GOOGLE_PLACE_ID") or "").strip() or _DEFAULT_PLACE_ID

    if api_key:
        live = await _fetch_live_google_reviews(api_key, place_id)
        if live is not None:
            return live

    return {
        "aggregate_rating": _VERIFIED_AGGREGATE_RATING,
        "total_reviews": _VERIFIED_REVIEW_COUNT,
        "reviews": _VERIFIED_REVIEWS,
        "source": "verified_static",  # real reviews, not fetched live — set GOOGLE_PLACES_API_KEY for live Google data
    }


# ── AI Review Response ────────────────────────────────────────────────────────

class ReviewResponseRequest(BaseModel):
    model_config = {"str_strip_whitespace": True}

    review_text:   str  = Field(..., min_length=1, max_length=2000)
    reviewer_name: Optional[str] = Field(default=None, max_length=120)
    rating:        int  = Field(default=5, ge=1, le=5)
    tone:          str  = Field(
        default="grateful",
        description="Response tone: grateful | professional | apologetic",
    )


class ReviewResponseOut(BaseModel):
    draft_response: str
    tone:           str
    engine:         str


@router.post(
    "/respond",
    summary="AI-drafted review response",
    response_model=ReviewResponseOut,
)
@limiter.limit("20/minute")
async def generate_review_response(
    request: Request,
    req: ReviewResponseRequest,
    security: dict = Depends(verify_premium_security),
):
    """
    Generate a professional AI-drafted response to a customer review.
    Returns a draft — Mr. Worden approves before publishing.
    Requires premium authentication (X-API-Key header).
    """
    import os  # noqa: PLC0415
    from ..services.review_responder import generate_review_response as _gen  # noqa: PLC0415

    tone = req.tone if req.tone in ("grateful", "professional", "apologetic") else "grateful"
    draft = _gen(
        review_text=req.review_text,
        reviewer_name=req.reviewer_name,
        rating=req.rating,
        tone=tone,
    )

    engine = "gpt-4o" if os.getenv("OPENAI_API_KEY") else "template"
    logger.info(
        "Review response generated: tenant=%s rating=%d tone=%s engine=%s",
        security.get("tenant_id"), req.rating, tone, engine,
    )

    return ReviewResponseOut(draft_response=draft, tone=tone, engine=engine)
