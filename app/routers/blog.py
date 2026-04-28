"""
blog.py — Blog post CRUD + AI draft generation for JWordenAI.

Endpoints:
  GET  /api/v1/blog              → list published posts (paginated)
  GET  /api/v1/blog/{slug}       → single post + increment view count
  POST /api/v1/blog/draft        → AI-generate a blog post draft (admin only)
  POST /api/v1/blog              → create/publish a post (admin only)
  PUT  /api/v1/blog/{slug}       → update a post (admin only)
  POST /api/v1/blog/{slug}/publish → publish a draft (admin only)

AI draft generation uses GPT-4o to write a full, SEO-optimized article
based on a topic prompt. Drafts are saved with status='draft' and must
be reviewed + published via the admin dashboard.
"""

from __future__ import annotations

import logging
import math
import os
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..core.limiter import limiter
from ..core.security import verify_premium_security
from ..database import get_db
from ..models import BlogPost

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/blog", tags=["blog"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _slugify(text: str) -> str:
    slug = text.lower().strip()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s_-]+', '-', slug)
    slug = slug[:160]
    return slug


def _estimate_read_time(body: str) -> int:
    words = len(body.split())
    return max(1, math.ceil(words / 200))  # 200 wpm average


def _serialize_post(post: BlogPost, full_body: bool = False) -> dict:
    return {
        "id":               post.id,
        "slug":             post.slug,
        "title":            post.title,
        "excerpt":          post.excerpt,
        "body":             post.body if full_body else None,
        "category":         post.category,
        "tags":             post.tags,
        "meta_title":       post.meta_title,
        "meta_description": post.meta_description,
        "focus_keyword":    post.focus_keyword,
        "status":           post.status,
        "published_at":     post.published_at.isoformat() if post.published_at else None,
        "featured":         bool(post.featured),
        "author_name":      post.author_name,
        "ai_generated":     bool(post.ai_generated),
        "read_time_minutes":post.read_time_minutes,
        "view_count":       post.view_count,
        "created_at":       post.created_at.isoformat() if post.created_at else None,
        "updated_at":       post.updated_at.isoformat() if post.updated_at else None,
    }


# ── Request / response models ─────────────────────────────────────────────────

class BlogPostCreate(BaseModel):
    slug:             Optional[str] = Field(default=None, max_length=200)
    title:            str           = Field(..., min_length=5, max_length=300)
    excerpt:          str           = Field(..., min_length=10, max_length=500)
    body:             str           = Field(..., min_length=50)
    category:         Optional[str] = Field(default=None, max_length=60)
    tags:             Optional[str] = Field(default=None, max_length=500)
    meta_title:       Optional[str] = Field(default=None, max_length=300)
    meta_description: Optional[str] = Field(default=None, max_length=320)
    focus_keyword:    Optional[str] = Field(default=None, max_length=120)
    featured:         bool          = False
    status:           str           = Field(default="draft")


class BlogDraftRequest(BaseModel):
    model_config = {"str_strip_whitespace": True}

    topic:        str           = Field(..., min_length=5, max_length=300,
                                       description="Topic or title idea for the blog post")
    category:     Optional[str] = Field(default=None, max_length=60)
    focus_keyword:Optional[str] = Field(default=None, max_length=120)
    target_length:int           = Field(default=800, ge=300, le=2000,
                                       description="Approximate target word count")
    auto_publish:  bool         = Field(default=False,
                                       description="Immediately publish if True (requires admin approval otherwise)")


# ── AI draft generation ───────────────────────────────────────────────────────

_BLOG_SYSTEM_PROMPT = """You are an expert content writer for J. Worden & Sons Asphalt Paving — 
a 4th-generation family-owned asphalt contractor est. 1984, based in Chester, Virginia.

Your writing should:
1. Be authoritative, clear, and genuinely useful to homeowners or commercial property managers
2. Be optimized for SEO — use the focus keyword naturally 3–5 times in the article
3. Include practical advice based on real paving expertise (40+ years)
4. Use clear headings (## for H2, ### for H3), bullet points, and short paragraphs
5. Include internal link suggestions as [anchor text](/page) where relevant:
   - Quote form: [get a free estimate](/quote)
   - Contact: [contact us](/contact)
   - Services: [learn more about our services](/services)
6. End with a call-to-action paragraph that mentions the free estimate
7. Be factual — do not invent statistics or make specific claims you cannot verify
8. Write in first-person plural ("we") from the company's perspective where appropriate

Company contacts: Phone (804) 446-1296 | Chester, VA | Est. 1984
"""


def _generate_blog_draft_openai(
    topic: str,
    category: Optional[str],
    focus_keyword: Optional[str],
    target_length: int,
) -> dict:
    """Call GPT-4o to generate a full blog post. Returns dict with title, excerpt, body."""
    openai_key = os.getenv("OPENAI_API_KEY", "")
    if not openai_key:
        raise ValueError("OPENAI_API_KEY not set")

    from openai import OpenAI  # type: ignore
    client = OpenAI(api_key=openai_key)

    keyword_line = f"Focus keyword: {focus_keyword}" if focus_keyword else ""
    category_line = f"Category: {category}" if category else ""

    prompt = f"""Write a complete, SEO-optimized blog post for J. Worden & Sons Asphalt Paving.

Topic / title idea: {topic}
{category_line}
{keyword_line}
Target word count: approximately {target_length} words

Format your response as:
TITLE: [SEO-optimized title]
META_DESCRIPTION: [150–160 character meta description]
EXCERPT: [2–3 sentence teaser paragraph]
---
[Full article body in Markdown]
"""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": _BLOG_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        max_tokens=2500,
        temperature=0.7,
    )

    raw = response.choices[0].message.content or ""

    # Parse structured response
    title = topic
    meta_description = None
    excerpt = ""
    body = raw

    lines = raw.split('\n')
    body_start = 0
    for idx, line in enumerate(lines):
        if line.startswith("TITLE:"):
            title = line[6:].strip()
        elif line.startswith("META_DESCRIPTION:"):
            meta_description = line[17:].strip()
        elif line.startswith("EXCERPT:"):
            excerpt = line[8:].strip()
        elif line.strip() == "---":
            body_start = idx + 1
            break

    body = '\n'.join(lines[body_start:]).strip()

    return {
        "title": title,
        "excerpt": excerpt or topic,
        "body": body,
        "meta_description": meta_description,
    }


# ── Public endpoints ──────────────────────────────────────────────────────────

@router.get("", summary="List published blog posts")
@limiter.limit("60/minute")
def list_posts(
    request: Request,
    page:     int = 1,
    per_page: int = 12,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(BlogPost).filter(BlogPost.status == "published")
    if category and category != "all":
        query = query.filter(BlogPost.category == category)
    total = query.count()
    posts = (
        query
        .order_by(BlogPost.featured.desc(), BlogPost.published_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return {
        "total":    total,
        "page":     page,
        "per_page": per_page,
        "pages":    math.ceil(total / per_page) if per_page else 1,
        "posts":    [_serialize_post(p) for p in posts],
    }


@router.get("/{slug}", summary="Get a single blog post")
@limiter.limit("120/minute")
def get_post(slug: str, request: Request, db: Session = Depends(get_db)):
    post = db.query(BlogPost).filter(
        BlogPost.slug == slug, BlogPost.status == "published"
    ).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Increment view count
    try:
        post.view_count = (post.view_count or 0) + 1
        db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()

    return _serialize_post(post, full_body=True)


# ── Admin endpoints (require premium security) ────────────────────────────────

@router.post("/draft", summary="AI-generate a blog post draft")
@limiter.limit("10/minute")
async def generate_draft(
    request: Request,
    req: BlogDraftRequest,
    db: Session = Depends(get_db),
    security: dict = Depends(verify_premium_security),
):
    """
    Use GPT-4o to generate a full SEO blog post draft.
    Saved with status='draft' unless auto_publish=True.
    """
    try:
        result = _generate_blog_draft_openai(
            topic=req.topic,
            category=req.category,
            focus_keyword=req.focus_keyword,
            target_length=req.target_length,
        )
        engine = "gpt-4o"
    except Exception as exc:  # noqa: BLE001
        logger.error("Blog AI draft failed: %s", exc)
        # Fallback stub
        result = {
            "title": req.topic,
            "excerpt": f"Expert insights on {req.topic} from J. Worden & Sons Asphalt Paving.",
            "body": f"# {req.topic}\n\nThis article is coming soon. Contact us at (804) 446-1296 for expert advice.",
            "meta_description": f"J. Worden & Sons shares expert insights on {req.topic}. Free estimates for Virginia homeowners and commercial properties.",
        }
        engine = "template_fallback"

    slug = _slugify(result["title"])

    # Ensure unique slug
    base_slug = slug
    counter = 1
    while db.query(BlogPost).filter(BlogPost.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    status = "published" if req.auto_publish else "draft"
    now = datetime.now(timezone.utc) if req.auto_publish else None

    post = BlogPost(
        slug             = slug,
        title            = result["title"],
        excerpt          = result["excerpt"],
        body             = result["body"],
        category         = req.category,
        focus_keyword    = req.focus_keyword,
        meta_description = result.get("meta_description"),
        meta_title       = result["title"],
        status           = status,
        published_at     = now,
        ai_generated     = 1,
        read_time_minutes= _estimate_read_time(result["body"]),
        tenant_id        = security.get("tenant_id", "default"),
    )
    db.add(post)
    db.commit()
    db.refresh(post)

    logger.info("Blog draft created: slug=%s status=%s engine=%s", slug, status, engine)
    return {
        "status":   "created",
        "engine":   engine,
        "post":     _serialize_post(post, full_body=True),
    }


@router.post("", summary="Create a blog post")
@limiter.limit("20/minute")
async def create_post(
    request: Request,
    req: BlogPostCreate,
    db: Session = Depends(get_db),
    security: dict = Depends(verify_premium_security),
):
    slug = req.slug or _slugify(req.title)
    if db.query(BlogPost).filter(BlogPost.slug == slug).first():
        raise HTTPException(status_code=409, detail=f"Slug '{slug}' already exists")

    now = datetime.now(timezone.utc) if req.status == "published" else None
    post = BlogPost(
        slug             = slug,
        title            = req.title,
        excerpt          = req.excerpt,
        body             = req.body,
        category         = req.category,
        tags             = req.tags,
        meta_title       = req.meta_title or req.title,
        meta_description = req.meta_description,
        focus_keyword    = req.focus_keyword,
        status           = req.status,
        published_at     = now,
        featured         = 1 if req.featured else 0,
        read_time_minutes= _estimate_read_time(req.body),
        tenant_id        = security.get("tenant_id", "default"),
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return {"status": "created", "post": _serialize_post(post, full_body=True)}


@router.put("/{slug}", summary="Update a blog post")
@limiter.limit("20/minute")
async def update_post(
    slug: str,
    request: Request,
    req: BlogPostCreate,
    db: Session = Depends(get_db),
    security: dict = Depends(verify_premium_security),
):
    post = db.query(BlogPost).filter(BlogPost.slug == slug).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    post.title             = req.title
    post.excerpt           = req.excerpt
    post.body              = req.body
    post.category          = req.category
    post.tags              = req.tags
    post.meta_title        = req.meta_title or req.title
    post.meta_description  = req.meta_description
    post.focus_keyword     = req.focus_keyword
    post.featured          = 1 if req.featured else 0
    post.read_time_minutes = _estimate_read_time(req.body)

    if req.status == "published" and post.status != "published":
        post.status      = "published"
        post.published_at= datetime.now(timezone.utc)
    else:
        post.status = req.status

    db.commit()
    db.refresh(post)
    return {"status": "updated", "post": _serialize_post(post, full_body=True)}


@router.post("/{slug}/publish", summary="Publish a draft post")
@limiter.limit("20/minute")
async def publish_post(
    slug: str,
    request: Request,
    db: Session = Depends(get_db),
    security: dict = Depends(verify_premium_security),
):
    post = db.query(BlogPost).filter(BlogPost.slug == slug).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.status == "published":
        return {"status": "already_published", "post": _serialize_post(post)}

    post.status       = "published"
    post.published_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(post)
    logger.info("Blog post published: slug=%s", slug)
    return {"status": "published", "post": _serialize_post(post)}
