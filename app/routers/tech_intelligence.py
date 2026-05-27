"""
tech_intelligence.py — Internal technology intelligence queue endpoints.

Serves the imported tech-radar intelligence payload for Command Center.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, Query, Request

from ..core.limiter import limiter
from ..core.security import verify_premium_security

router = APIRouter(prefix="/api/v1/tech-intelligence", tags=["tech-intelligence"])

_REPO_ROOT = Path(__file__).resolve().parents[2]
_PRIMARY_PATH = _REPO_ROOT / "app" / "data" / "tech-intelligence" / "latest.json"
_FALLBACK_PATH = _REPO_ROOT / "docs" / "tech-radar" / "intelligence" / "latest.json"


def _load_payload() -> dict[str, Any] | None:
    for path in (_PRIMARY_PATH, _FALLBACK_PATH):
        if not path.exists():
            continue
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
    return None


def _priority_rank(value: str | None) -> int:
    rank = {"low": 1, "medium": 2, "high": 3, "critical": 4}
    return rank.get((value or "").strip().lower(), 0)


def _hours_since(iso_value: str | None) -> float | None:
    if not iso_value:
        return None
    try:
        dt = datetime.fromisoformat(str(iso_value).replace("Z", "+00:00"))
    except Exception:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    return max(0.0, (now - dt).total_seconds() / 3600.0)


def _normalize_signal(signal: dict[str, Any]) -> dict[str, Any]:
    top_domains = signal.get("topDomains")
    if not isinstance(top_domains, list):
        top_domains = []

    capability_tags = signal.get("capabilityTags")
    if not isinstance(capability_tags, list):
        capability_tags = []

    return {
        "title": signal.get("title"),
        "url": signal.get("url"),
        "published_at": signal.get("publishedAt"),
        "priority": signal.get("priority"),
        "source_name": signal.get("sourceName"),
        "overall_score": signal.get("overallScore"),
        "capability_tags": [str(tag) for tag in capability_tags[:6]],
        "top_domains": [
            {
                "domain_id": domain.get("domainId"),
                "domain_label": domain.get("domainLabel"),
                "score": domain.get("score"),
            }
            for domain in top_domains[:3]
            if isinstance(domain, dict)
        ],
    }


@router.get("/queue", summary="Get prioritized technology opportunity queue")
@limiter.limit("60/minute")
async def get_tech_intelligence_queue(
    request: Request,
    limit: int = Query(default=20, ge=1, le=100),
    min_priority: str = Query(default="medium", pattern="^(low|medium|high|critical)$"),
    _: dict = Depends(verify_premium_security),
):
    payload = _load_payload()
    if payload is None:
        return {
            "status": "missing",
            "detail": "No technology intelligence payload available yet.",
            "generated_at": None,
            "queue": [],
            "queue_count": 0,
        }

    all_signals = payload.get("prioritizedSignals")
    if not isinstance(all_signals, list):
        all_signals = []

    threshold = _priority_rank(min_priority)
    queue = [
        signal
        for signal in all_signals
        if isinstance(signal, dict)
        and _priority_rank(signal.get("priority")) >= threshold
    ][:limit]

    generated_at = payload.get("generatedAt")
    staleness_hours = _hours_since(generated_at)

    return {
        "status": "ok",
        "generated_at": generated_at,
        "staleness_hours": round(staleness_hours, 2)
        if staleness_hours is not None
        else None,
        "signals_analyzed": payload.get("signalsAnalyzed"),
        "queue_count": len(queue),
        "queue": queue,
        "domain_summary": payload.get("domainSummary") or [],
    }


@router.get("/public-brief", summary="Get public technology research digest")
@limiter.limit("120/minute")
async def get_public_tech_intelligence_brief(
    request: Request,
    limit: int = Query(default=6, ge=1, le=12),
    include_review_required: bool = Query(default=False),
):
    payload = _load_payload()
    if payload is None:
        return {
            "status": "missing",
            "detail": "No technology intelligence payload available yet.",
            "generated_at": None,
            "highlights": [],
            "highlights_count": 0,
        }

    all_signals = payload.get("prioritizedSignals")
    if not isinstance(all_signals, list):
        all_signals = []

    approved_signals = payload.get("websiteAutoApprovedSignals")
    if not isinstance(approved_signals, list):
        approved_signals = []

    filtered_signals = []
    source_signals = all_signals if include_review_required else approved_signals
    for signal in source_signals:
        if not isinstance(signal, dict):
            continue
        if include_review_required:
            publication = signal.get("websitePublication") or {}
            status = str(publication.get("status") or "review-required").strip().lower()
            if status not in {"auto-approved", "review-required"}:
                continue
        filtered_signals.append(signal)
        if len(filtered_signals) >= limit:
            break

    highlights = [_normalize_signal(signal) for signal in filtered_signals]

    generated_at = payload.get("generatedAt")
    staleness_hours = _hours_since(generated_at)
    domain_summary = payload.get("domainSummary")
    if not isinstance(domain_summary, list):
        domain_summary = []

    return {
        "status": "ok",
        "generated_at": generated_at,
        "staleness_hours": round(staleness_hours, 2)
        if staleness_hours is not None
        else None,
        "signals_analyzed": payload.get("signalsAnalyzed"),
        "source_count": payload.get("sourceCount"),
        "highlights_count": len(highlights),
        "highlights": highlights,
        "website_publication_summary": payload.get("websitePublicationSummary") or {},
        "domain_summary": [
            {
                "domain_id": item.get("domainId"),
                "domain_label": item.get("domainLabel"),
                "signal_count": item.get("signalCount"),
                "pressure_score": item.get("pressureScore"),
            }
            for item in domain_summary[:4]
            if isinstance(item, dict)
        ],
    }
