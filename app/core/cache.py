"""
cache.py — Redis caching utilities for JWordenAI.

Implements the cache-aside pattern: check Redis first, fall back to the
database on a miss, then populate the cache for subsequent requests.

TTL strategy (seconds):
  CRM_LEADS_TTL       = 30    — frequently updated pipeline data
  ANALYTICS_TTL       = 60    — expensive BI aggregations
  KPI_WALL_TTL        = 300   — aggregate KPI dashboard (5 min)
  CUSTOMERS_TTL       = 120   — reference CRM data (2 min)
  BLOG_TTL            = 3600  — static content (1 hour)
  ESTIMATES_TTL       = 86400 — pricing data (24 hours)

Public API
──────────
  get_redis()                          → redis.Redis | None
  cache_get(key) → dict | list | None
  cache_set(key, value, ttl)
  cache_delete(key)
  cache_delete_pattern(pattern)
  cached(key_fn, ttl)                  → decorator
  invalidate_crm_caches()
  invalidate_analytics_caches()
  invalidate_customer_caches(customer_id)
  invalidate_proposal_caches()
  record_cache_hit()
  record_cache_miss()
  get_cache_stats() → dict
"""

from __future__ import annotations

import json
import logging
import os
import time
from functools import wraps
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)

# ── TTL constants (seconds) ───────────────────────────────────────────────────

CRM_LEADS_TTL: int = int(os.getenv("CACHE_TTL_CRM_LEADS", "30"))
ANALYTICS_TTL: int = int(os.getenv("CACHE_TTL_ANALYTICS", "60"))
KPI_WALL_TTL: int = int(os.getenv("CACHE_TTL_KPI_WALL", "300"))
CUSTOMERS_TTL: int = int(os.getenv("CACHE_TTL_CUSTOMERS", "120"))
BLOG_TTL: int = int(os.getenv("CACHE_TTL_BLOG", "3600"))
ESTIMATES_TTL: int = int(os.getenv("CACHE_TTL_ESTIMATES", "86400"))

# ── Cache key prefixes ────────────────────────────────────────────────────────

KEY_CRM_LEADS = "crm:leads"
KEY_CRM_FUNNEL = "crm:funnel"
KEY_ANALYTICS_DASHBOARD = "analytics:dashboard"
KEY_ANALYTICS_FUNNEL = "analytics:funnel"
KEY_ANALYTICS_REVENUE = "analytics:revenue"
KEY_ANALYTICS_MONTHLY = "analytics:monthly"
KEY_KPI_WALL = "kpi:wall"
KEY_CUSTOMERS_LIST = "customers:list"
KEY_CUSTOMERS_STATS = "customers:stats"
KEY_CUSTOMER_DETAIL = "customers:detail:{id}"
KEY_BLOG_LIST = "blog:list"
KEY_BLOG_POST = "blog:post:{slug}"

# ── In-process hit/miss counters (per worker, resets on restart) ──────────────

_stats: dict[str, int] = {"hits": 0, "misses": 0, "errors": 0}

_REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Module-level Redis client (lazy-initialised, shared across requests)
_redis_client: Any = None


def get_redis() -> Any:
    """
    Return a shared Redis client, initialising it on first call.

    Returns None if Redis is unavailable so callers can fall back to the DB
    gracefully without raising exceptions.
    """
    global _redis_client  # noqa: PLW0603
    if _redis_client is not None:
        return _redis_client
    try:
        import redis  # type: ignore

        client = redis.from_url(
            _REDIS_URL,
            socket_connect_timeout=2,
            socket_timeout=2,
            decode_responses=True,
        )
        client.ping()
        _redis_client = client
        logger.info("Redis cache client initialised (%s)", _REDIS_URL.split("@")[-1])
        return _redis_client
    except Exception as exc:  # noqa: BLE001
        logger.warning("Redis unavailable — caching disabled: %s", exc)
        return None


def _reset_client() -> None:
    """Force re-initialisation of the Redis client (used in tests)."""
    global _redis_client  # noqa: PLW0603
    _redis_client = None


# ── Core cache operations ─────────────────────────────────────────────────────


def cache_get(key: str) -> Optional[Any]:
    """
    Retrieve a cached value by key.

    Returns the deserialised Python object on a hit, or None on a miss /
    Redis error.  Updates hit/miss counters.
    """
    r = get_redis()
    if r is None:
        _stats["misses"] += 1
        return None
    try:
        raw = r.get(key)
        if raw is None:
            _stats["misses"] += 1
            return None
        _stats["hits"] += 1
        return json.loads(raw)
    except Exception as exc:  # noqa: BLE001
        _stats["errors"] += 1
        logger.warning("cache_get(%s) error: %s", key, exc)
        return None


def cache_set(key: str, value: Any, ttl: int) -> bool:
    """
    Serialise *value* to JSON and store it in Redis with the given TTL.

    Returns True on success, False on error.
    """
    r = get_redis()
    if r is None:
        return False
    try:
        r.setex(key, ttl, json.dumps(value, default=str))
        return True
    except Exception as exc:  # noqa: BLE001
        _stats["errors"] += 1
        logger.warning("cache_set(%s) error: %s", key, exc)
        return False


def cache_delete(key: str) -> bool:
    """Delete a single cache key.  Returns True on success."""
    r = get_redis()
    if r is None:
        return False
    try:
        r.delete(key)
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("cache_delete(%s) error: %s", key, exc)
        return False


def cache_delete_pattern(pattern: str) -> int:
    """
    Delete all keys matching a glob pattern (e.g. ``"crm:leads*"``).

    Returns the number of keys deleted.  Uses SCAN to avoid blocking Redis.
    """
    r = get_redis()
    if r is None:
        return 0
    deleted = 0
    try:
        cursor = 0
        while True:
            cursor, keys = r.scan(cursor, match=pattern, count=100)
            if keys:
                r.delete(*keys)
                deleted += len(keys)
            if cursor == 0:
                break
    except Exception as exc:  # noqa: BLE001
        logger.warning("cache_delete_pattern(%s) error: %s", pattern, exc)
    return deleted


# ── Decorator ─────────────────────────────────────────────────────────────────


def cached(key: str, ttl: int) -> Callable:
    """
    Decorator that caches the return value of an async or sync function.

    Usage::

        @cached(key="crm:funnel", ttl=CRM_LEADS_TTL)
        async def get_funnel(db):
            ...

    The *key* is used verbatim — include any dynamic segments before
    applying the decorator, or use ``cache_get`` / ``cache_set`` directly
    for keys that depend on request parameters.
    """
    def decorator(fn: Callable) -> Callable:
        import asyncio  # noqa: PLC0415

        if asyncio.iscoroutinefunction(fn):
            @wraps(fn)
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                cached_val = cache_get(key)
                if cached_val is not None:
                    return cached_val
                result = await fn(*args, **kwargs)
                cache_set(key, result, ttl)
                return result
            return async_wrapper
        else:
            @wraps(fn)
            def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
                cached_val = cache_get(key)
                if cached_val is not None:
                    return cached_val
                result = fn(*args, **kwargs)
                cache_set(key, result, ttl)
                return result
            return sync_wrapper
    return decorator


# ── Cache invalidation helpers ────────────────────────────────────────────────


def invalidate_crm_caches() -> None:
    """
    Invalidate all CRM and analytics caches.

    Call this after any lead stage update, creation, or deletion so the
    next request fetches fresh data from the database.
    """
    keys = [
        KEY_CRM_LEADS,
        KEY_CRM_FUNNEL,
        KEY_ANALYTICS_DASHBOARD,
        KEY_ANALYTICS_FUNNEL,
        KEY_ANALYTICS_REVENUE,
        KEY_ANALYTICS_MONTHLY,
        KEY_KPI_WALL,
    ]
    for key in keys:
        cache_delete(key)
    # Also wipe any paginated crm:leads:* variants
    cache_delete_pattern("crm:leads:*")
    logger.debug("CRM caches invalidated")


def invalidate_analytics_caches() -> None:
    """Invalidate all analytics dashboard caches."""
    keys = [
        KEY_ANALYTICS_DASHBOARD,
        KEY_ANALYTICS_FUNNEL,
        KEY_ANALYTICS_REVENUE,
        KEY_ANALYTICS_MONTHLY,
        KEY_KPI_WALL,
    ]
    for key in keys:
        cache_delete(key)
    logger.debug("Analytics caches invalidated")


def invalidate_customer_caches(customer_id: Optional[int] = None) -> None:
    """
    Invalidate customer list, stats, and optionally a specific customer's
    detail cache.
    """
    cache_delete(KEY_CUSTOMERS_LIST)
    cache_delete(KEY_CUSTOMERS_STATS)
    cache_delete_pattern("customers:list:*")
    if customer_id is not None:
        cache_delete(KEY_CUSTOMER_DETAIL.format(id=customer_id))
    logger.debug("Customer caches invalidated (id=%s)", customer_id)


def invalidate_proposal_caches() -> None:
    """Invalidate proposal-related caches."""
    cache_delete_pattern("proposals:*")
    logger.debug("Proposal caches invalidated")


# ── Stats helpers ─────────────────────────────────────────────────────────────


def record_cache_hit() -> None:
    """Manually record a cache hit (for use outside cache_get)."""
    _stats["hits"] += 1


def record_cache_miss() -> None:
    """Manually record a cache miss (for use outside cache_get)."""
    _stats["misses"] += 1


def get_cache_stats() -> dict:
    """
    Return current hit/miss/error counters plus the computed hit ratio.

    Counters are per-process and reset on worker restart.
    """
    hits = _stats["hits"]
    misses = _stats["misses"]
    total = hits + misses
    hit_ratio = round(hits / total * 100, 2) if total > 0 else 0.0
    return {
        "hits": hits,
        "misses": misses,
        "errors": _stats["errors"],
        "total_requests": total,
        "hit_ratio_pct": hit_ratio,
    }


# ── Cache warming ─────────────────────────────────────────────────────────────


def warm_cache(db: Any) -> dict[str, bool]:
    """
    Pre-load hot data into Redis synchronously.

    Called by the ``warm_cache_task`` Celery beat job every 5 minutes.
    Returns a dict of {cache_key: success} for observability.
    """
    from ..services.analytics import (  # noqa: PLC0415
        get_full_dashboard,
        get_monthly_lead_volume,
    )

    results: dict[str, bool] = {}

    # 1. Analytics dashboard
    try:
        dashboard = get_full_dashboard(db)
        results[KEY_ANALYTICS_DASHBOARD] = cache_set(
            KEY_ANALYTICS_DASHBOARD, dashboard, ANALYTICS_TTL
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Cache warm: analytics dashboard failed: %s", exc)
        results[KEY_ANALYTICS_DASHBOARD] = False

    # 2. Monthly lead volume
    try:
        monthly = get_monthly_lead_volume(db)
        results[KEY_ANALYTICS_MONTHLY] = cache_set(
            KEY_ANALYTICS_MONTHLY, monthly, ANALYTICS_TTL
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Cache warm: monthly volume failed: %s", exc)
        results[KEY_ANALYTICS_MONTHLY] = False

    # 3. KPI wall — import inline to avoid circular imports
    try:
        from ..routers.kpi_wall import _compute_kpi_wall  # noqa: PLC0415

        kpi_data = _compute_kpi_wall(db)
        results[KEY_KPI_WALL] = cache_set(KEY_KPI_WALL, kpi_data, KPI_WALL_TTL)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Cache warm: KPI wall failed: %s", exc)
        results[KEY_KPI_WALL] = False

    # 4. Top CRM leads (first page, no filter)
    try:
        from ..models import Lead  # noqa: PLC0415

        leads = (
            db.query(Lead)
            .order_by(Lead.created_at.desc())
            .limit(100)
            .all()
        )
        leads_payload = {
            "total": len(leads),
            "offset": 0,
            "limit": 100,
            "leads": [
                {
                    "id": l.id,
                    "name": l.name,
                    "email": l.email,
                    "phone": l.phone,
                    "service_type": l.service_type,
                    "urgency": l.urgency,
                    "score_label": l.score_label,
                    "pipeline_stage": l.pipeline_stage or "new",
                    "contacted_at": l.contacted_at.isoformat() if l.contacted_at else None,
                    "proposal_sent_at": l.proposal_sent_at.isoformat() if l.proposal_sent_at else None,
                    "closed_at": l.closed_at.isoformat() if l.closed_at else None,
                    "closed_reason": l.closed_reason,
                    "created_at": l.created_at.isoformat(),
                }
                for l in leads
            ],
        }
        results[KEY_CRM_LEADS] = cache_set(KEY_CRM_LEADS, leads_payload, CRM_LEADS_TTL)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Cache warm: CRM leads failed: %s", exc)
        results[KEY_CRM_LEADS] = False

    logger.info(
        "Cache warming complete: %d/%d keys populated",
        sum(1 for v in results.values() if v),
        len(results),
    )
    return results
