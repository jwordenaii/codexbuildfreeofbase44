"""
facebook_page.py — Facebook Page management via the Meta Graph API.

Backs the Command Center's Facebook tab: read the Page's published posts,
publish a new one, and delete one.

Credentials come from runtime_config (which falls back to os.environ):

    FACEBOOK_PAGE_ID            numeric Page ID, or the page's username
    FACEBOOK_PAGE_ACCESS_TOKEN  long-lived Page access token

Neither is set today. Every endpoint therefore reports `configured: false` with
the exact variables that are missing, rather than returning an empty feed —
"this Page has no posts" and "we were never able to ask" must not look the same
on screen. The write endpoints refuse outright rather than pretending to post.
"""

import logging
from typing import Any, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from ..core.limiter import limiter
from ..core.security import verify_premium_security
from ..services import runtime_config

router = APIRouter(prefix="/api/v1/facebook", tags=["facebook"])
logger = logging.getLogger(__name__)

GRAPH_VERSION = "v21.0"
GRAPH_BASE = f"https://graph.facebook.com/{GRAPH_VERSION}"
TIMEOUT = httpx.Timeout(15.0, connect=5.0)


class PublishRequest(BaseModel):
    message: str = Field(min_length=1, max_length=63206)
    link: Optional[str] = Field(default=None, description="Optional URL to attach")


def _credentials() -> tuple[str, str, list[str]]:
    """Returns (page_id, token, missing_variable_names)."""
    page_id = runtime_config.get("FACEBOOK_PAGE_ID")
    token = runtime_config.get("FACEBOOK_PAGE_ACCESS_TOKEN")
    missing = [
        name
        for name, value in (
            ("FACEBOOK_PAGE_ID", page_id),
            ("FACEBOOK_PAGE_ACCESS_TOKEN", token),
        )
        if not value
    ]
    return page_id, token, missing


def _not_configured(missing: list[str]) -> dict[str, Any]:
    return {
        "configured": False,
        "reason": "not_configured",
        "missing": missing,
        "detail": (
            "Facebook Page management is not configured. Set "
            + " and ".join(missing)
            + ". A Page access token comes from a Meta app with the "
            "pages_manage_posts and pages_read_engagement permissions."
        ),
    }


def _graph_error(resp: httpx.Response) -> str:
    """Meta nests the useful part; surface it rather than a bare status code."""
    try:
        err = resp.json().get("error", {})
        parts = [err.get("message"), err.get("error_user_msg")]
        text = " — ".join(p for p in parts if p)
        return text or f"HTTP {resp.status_code}"
    except Exception:
        return f"HTTP {resp.status_code}"


@router.get("/status", dependencies=[Depends(verify_premium_security)])
@limiter.limit("30/minute")
async def status_(request: Request):
    """Whether the integration can talk to the Page, and as whom."""
    page_id, token, missing = _credentials()
    if missing:
        return _not_configured(missing)

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(
                f"{GRAPH_BASE}/{page_id}",
                params={"fields": "id,name,fan_count,link", "access_token": token},
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Could not reach Meta Graph API: {exc}")

    if resp.status_code != 200:
        return {
            "configured": True,
            "connected": False,
            "reason": "graph_error",
            "detail": _graph_error(resp),
        }

    page = resp.json()
    return {
        "configured": True,
        "connected": True,
        "page": {
            "id": page.get("id"),
            "name": page.get("name"),
            "followers": page.get("fan_count"),
            "url": page.get("link"),
        },
    }


@router.get("/posts", dependencies=[Depends(verify_premium_security)])
@limiter.limit("30/minute")
async def list_posts(request: Request, limit: int = 15):
    """Published posts, newest first."""
    page_id, token, missing = _credentials()
    if missing:
        return {**_not_configured(missing), "posts": []}

    limit = max(1, min(limit, 50))
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(
                f"{GRAPH_BASE}/{page_id}/published_posts",
                params={
                    "fields": "id,message,created_time,permalink_url,full_picture,"
                    "shares,likes.summary(true),comments.summary(true)",
                    "limit": limit,
                    "access_token": token,
                },
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Could not reach Meta Graph API: {exc}")

    if resp.status_code != 200:
        return {
            "configured": True,
            "connected": False,
            "reason": "graph_error",
            "detail": _graph_error(resp),
            "posts": [],
        }

    posts = []
    for item in resp.json().get("data", []):
        posts.append(
            {
                "id": item.get("id"),
                "message": item.get("message", ""),
                "created_time": item.get("created_time"),
                "permalink": item.get("permalink_url"),
                "image": item.get("full_picture"),
                "likes": (item.get("likes", {}).get("summary", {}) or {}).get("total_count"),
                "comments": (item.get("comments", {}).get("summary", {}) or {}).get("total_count"),
                "shares": (item.get("shares", {}) or {}).get("count", 0),
            }
        )

    return {"configured": True, "connected": True, "posts": posts, "count": len(posts)}


@router.post("/posts", dependencies=[Depends(verify_premium_security)])
@limiter.limit("10/minute")
async def publish_post(request: Request, payload: PublishRequest):
    """Publish a post to the Page. Requires pages_manage_posts."""
    page_id, token, missing = _credentials()
    if missing:
        # Refuse rather than report a success that never reached Facebook.
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=_not_configured(missing)["detail"],
        )

    body: dict[str, Any] = {"message": payload.message, "access_token": token}
    if payload.link:
        body["link"] = payload.link

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(f"{GRAPH_BASE}/{page_id}/feed", data=body)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Could not reach Meta Graph API: {exc}")

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=_graph_error(resp))

    post_id = resp.json().get("id")
    logger.info("facebook: published post %s", post_id)
    return {"ok": True, "id": post_id}


@router.delete("/posts/{post_id}", dependencies=[Depends(verify_premium_security)])
@limiter.limit("10/minute")
async def delete_post(request: Request, post_id: str):
    """Delete a post from the Page."""
    _page_id, token, missing = _credentials()
    if missing:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=_not_configured(missing)["detail"],
        )

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.delete(f"{GRAPH_BASE}/{post_id}", params={"access_token": token})
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Could not reach Meta Graph API: {exc}")

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=_graph_error(resp))

    return {"ok": True, "deleted": post_id}
