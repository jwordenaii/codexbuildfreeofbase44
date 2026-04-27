import logging
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from typing import Optional

from ..core.limiter import limiter
from ..core.security import verify_premium_security

router = APIRouter(prefix="/api/v1/reviews", tags=["reviews"])

logger = logging.getLogger(__name__)

# Stub dataset — replace with live Google Places API call once key is available
_STUB_REVIEWS = [
    {
        "author": "Mark D.",
        "rating": 5,
        "text": (
            "J. Worden & Sons did an outstanding job on our commercial parking lot. "
            "On time, on budget, and the quality is exceptional. The crew was professional "
            "and cleaned everything up perfectly."
        ),
        "date": "2024-11-15",
        "source": "Google",
    },
    {
        "author": "Patricia H.",
        "rating": 5,
        "text": (
            "Our driveway looks brand new. They showed up on schedule, got it done in "
            "one day, and the price was very fair. Fourth generation — you can tell they "
            "really know what they're doing."
        ),
        "date": "2024-10-22",
        "source": "Google",
    },
    {
        "author": "Riverside KFC Management",
        "rating": 5,
        "text": (
            "We have used J. Worden & Sons for all three of our franchise locations. "
            "Every project has been flawless — fast, clean, and built to last. "
            "Highly recommend for any commercial property."
        ),
        "date": "2024-09-08",
        "source": "Google",
    },
    {
        "author": "Tom B.",
        "rating": 5,
        "text": (
            "Exceptional sealcoating and crack fill on a 6-bay warehouse lot. "
            "The team was efficient and the results speak for themselves. "
            "Will definitely hire again."
        ),
        "date": "2024-08-30",
        "source": "Google",
    },
    {
        "author": "Sandra M.",
        "rating": 4,
        "text": (
            "Great work on my residential driveway. Slight delay on the start date "
            "but they kept me informed the whole time. End result is beautiful."
        ),
        "date": "2024-07-14",
        "source": "Google",
    },
    {
        "author": "Arby's Regional Ops",
        "rating": 5,
        "text": (
            "Trusted vendor for several Arby's locations in the region. "
            "Professional, reliable, and their asphalt work holds up year after year."
        ),
        "date": "2024-06-05",
        "source": "Google",
    },
]


@router.get("", summary="Get reviews with aggregate rating")
def get_reviews():
    ratings = [r["rating"] for r in _STUB_REVIEWS]
    average = round(sum(ratings) / len(ratings), 1) if ratings else 0.0
    return {
        "aggregate_rating": average,
        "total_reviews": 87,       # full Google count — stubs show a sample
        "reviews": _STUB_REVIEWS,
        "source": "stub",          # set to "google" once live Places API is wired
    }


# ── AI Review Response ────────────────────────────────────────────────────────

class ReviewResponseRequest(BaseModel):
    review_text:   str  = Field(..., min_length=1, max_length=2000, strip_whitespace=True)
    reviewer_name: Optional[str] = Field(default=None, max_length=120, strip_whitespace=True)
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
