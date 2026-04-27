"""
seo.py — AI SEO content generation endpoints for JWordenAI.

Endpoints:
  POST /api/v1/seo/city-page   → generate SEO copy for a city/service area page
  POST /api/v1/seo/meta-tags   → generate meta title + description for any URL/topic
  POST /api/v1/seo/faq         → generate location + service specific FAQ set

All endpoints use GPT-4o and fall back to structured templates when
OPENAI_API_KEY is not set. All require premium auth.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from ..core.limiter import limiter
from ..core.security import verify_premium_security

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/seo", tags=["seo"])


# ── Request / Response models ─────────────────────────────────────────────────

class CityPageRequest(BaseModel):
    city:          str           = Field(..., min_length=2, max_length=100)
    state:         str           = Field(..., min_length=2, max_length=50)
    state_code:    str           = Field(..., min_length=2, max_length=2)
    services:      list[str]     = Field(default_factory=lambda: ["asphalt paving", "sealcoating"])
    target_length: int           = Field(default=400, ge=100, le=800)


class MetaTagsRequest(BaseModel):
    page_title:    str           = Field(..., min_length=5, max_length=200)
    page_type:     str           = Field(default="service", description="service | location | blog | home")
    focus_keyword: Optional[str] = Field(default=None, max_length=120)
    city:          Optional[str] = Field(default=None, max_length=100)
    service:       Optional[str] = Field(default=None, max_length=100)


class FAQGenRequest(BaseModel):
    city:          Optional[str] = Field(default=None, max_length=100)
    state_code:    Optional[str] = Field(default=None, max_length=2)
    service:       str           = Field(default="asphalt paving", max_length=100)
    count:         int           = Field(default=5, ge=2, le=10)


# ── AI helpers ────────────────────────────────────────────────────────────────

_SEO_SYSTEM = """You are an SEO specialist writing content for J. Worden & Sons Asphalt Paving — 
a 4th-generation family-owned contractor based in Chester, Virginia (est. 1984).

Writing rules:
• Be naturally conversational — not keyword-stuffed
• Include the primary keyword 2–3 times per 100 words
• Mention the company name and phone (804) 446-1296 where appropriate
• Local relevance: reference specific neighborhoods, roads, or landmarks when known
• Include a clear value proposition and call-to-action
• Accurate: do not invent specific statistics; rely on company facts provided
• Company facts: 40+ years, licensed & insured, KFC national vendor, Pavement Magazine Top 75, free estimates
"""


def _call_openai_seo(system: str, user: str, max_tokens: int = 600) -> str | None:
    openai_key = os.getenv("OPENAI_API_KEY", "")
    if not openai_key:
        return None
    try:
        from openai import OpenAI  # type: ignore
        client = OpenAI(api_key=openai_key)
        resp = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            max_tokens=max_tokens,
            temperature=0.65,
        )
        return (resp.choices[0].message.content or "").strip()
    except Exception as exc:  # noqa: BLE001
        logger.error("SEO OpenAI call failed [endpoint=%s]: %s", "seo_generation", exc)
        return None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/city-page", summary="Generate SEO copy for a city landing page")
@limiter.limit("20/minute")
async def generate_city_page_copy(
    request: Request,
    req: CityPageRequest,
    security: dict = Depends(verify_premium_security),
):
    """
    Generate premium SEO copy for a city/service area landing page.
    Returns: hero_headline, tagline, description, cta_text, h2_headings[]
    """
    services_str = ", ".join(req.services)
    user_prompt = f"""
Generate SEO-optimized copy for a city landing page.

Page: J. Worden & Sons Asphalt Paving — {req.city}, {req.state}
Primary services on this page: {services_str}
Primary keyword: "asphalt paving {req.city} {req.state_code}"

Provide EXACTLY this JSON structure (no markdown fences):
{{
  "hero_headline": "concise H1 under 70 chars",
  "tagline": "1 sentence subheading under 120 chars",
  "description": "{req.target_length}-word page description with keyword integration",
  "cta_text": "CTA button text (under 40 chars)",
  "h2_headings": ["heading 1", "heading 2", "heading 3"],
  "meta_title": "SEO meta title under 60 chars",
  "meta_description": "meta description 150–160 chars"
}}
"""
    import json  # noqa: PLC0415

    raw = _call_openai_seo(_SEO_SYSTEM, user_prompt, max_tokens=700)
    engine = "gpt-4o"

    if raw:
        try:
            data = json.loads(raw)
            data["engine"] = engine
            return data
        except json.JSONDecodeError:
            pass

    # Fallback template
    engine = "template"
    city, sc = req.city, req.state_code
    return {
        "hero_headline":     f"Asphalt Paving Contractor in {city}, {sc}",
        "tagline":           f"Trusted by {city} homeowners and businesses since 1984 — free estimates.",
        "description":       f"J. Worden & Sons Asphalt Paving serves {city}, {req.state} with professional {services_str}. Based in Chester, VA, our 4th-generation family-owned team brings 40+ years of expertise to every project in {city}. We are fully licensed, insured, and offer free on-site estimates. Call (804) 446-1296 today.",
        "cta_text":          f"Free Estimate in {city}",
        "h2_headings":       [
            f"Why {city} Chooses J. Worden & Sons",
            f"Asphalt Services in {city}, {sc}",
            f"Frequently Asked Questions — Paving in {city}",
        ],
        "meta_title":        f"Asphalt Paving in {city}, {sc} | J. Worden & Sons",
        "meta_description":  f"Professional asphalt paving, sealcoating & crack filling in {city}, {sc}. J. Worden & Sons — 4th-generation contractor, est. 1984. Free estimates: (804) 446-1296.",
        "engine":            engine,
    }


@router.post("/meta-tags", summary="Generate meta title and description")
@limiter.limit("30/minute")
async def generate_meta_tags(
    request: Request,
    req: MetaTagsRequest,
    security: dict = Depends(verify_premium_security),
):
    """Generate optimized meta title (≤60 chars) and meta description (≤160 chars)."""
    context_parts = [req.page_title]
    if req.city:    context_parts.append(f"location: {req.city}")
    if req.service: context_parts.append(f"service: {req.service}")
    if req.focus_keyword: context_parts.append(f"keyword: {req.focus_keyword}")

    user_prompt = f"""
Generate an SEO meta title and meta description for:
{' | '.join(context_parts)}
Page type: {req.page_type}
Company: J. Worden & Sons Asphalt Paving, Chester VA, Est. 1984

Return JSON (no fences):
{{"meta_title": "under 60 chars", "meta_description": "150–160 chars"}}
"""
    import json  # noqa: PLC0415

    raw = _call_openai_seo(_SEO_SYSTEM, user_prompt, max_tokens=200)
    engine = "gpt-4o"

    if raw:
        try:
            data = json.loads(raw)
            data["engine"] = engine
            return data
        except json.JSONDecodeError:
            pass

    # Fallback
    svc  = req.service or "asphalt paving"
    city = req.city or "Virginia"
    return {
        "meta_title":       f"{req.page_title} | J. Worden & Sons",
        "meta_description": f"Expert {svc} in {city} by J. Worden & Sons — 4th-generation contractor since 1984. Licensed & insured. Free estimates: (804) 446-1296.",
        "engine":           "template",
    }


@router.post("/faq", summary="Generate location & service specific FAQs")
@limiter.limit("20/minute")
async def generate_faq(
    request: Request,
    req: FAQGenRequest,
    security: dict = Depends(verify_premium_security),
):
    """Generate N location+service specific FAQ pairs for schema markup."""
    location = f"{req.city}, {req.state_code}" if req.city else "Virginia"

    user_prompt = f"""
Generate {req.count} SEO-optimized FAQ pairs for:
Location: {location}
Service: {req.service}
Company: J. Worden & Sons Asphalt Paving

Return JSON array (no fences):
[{{"question": "...", "answer": "2–3 sentences, specific and helpful"}}]

Make each question something a real homeowner or property manager would Google.
"""
    import json  # noqa: PLC0415

    raw = _call_openai_seo(_SEO_SYSTEM, user_prompt, max_tokens=800)
    engine = "gpt-4o"

    if raw:
        try:
            faqs = json.loads(raw)
            return {"faqs": faqs, "engine": engine, "count": len(faqs)}
        except json.JSONDecodeError:
            pass

    # Fallback FAQs
    svc = req.service
    loc = location
    return {
        "faqs": [
            {
                "question": f"How much does {svc} cost in {loc}?",
                "answer": f"The cost of {svc} in {loc} depends on project size, base condition, and access. Residential work typically starts around $3–$8 per square foot. Contact us for a free on-site estimate tailored to your property."
            },
            {
                "question": f"How long does {svc} last in {loc}?",
                "answer": f"Properly installed asphalt in {loc} lasts 20–30 years with regular maintenance. Sealcoating every 3–5 years significantly extends lifespan by protecting against UV, water, and oil damage."
            },
            {
                "question": f"Do you offer free estimates for {svc} in {loc}?",
                "answer": f"Yes — all estimates from J. Worden & Sons are free and come with no obligation. Call us at (804) 446-1296 or fill out the quote form on our website."
            },
        ],
        "engine": "template",
        "count": 3,
    }
