"""
search_service.py — Elasticsearch full-text search client for JWordenAI.

Wraps the official elasticsearch-py 8.x client with:
  - Lazy initialisation (client created on first use, not at import time)
  - Per-operation retry logic with exponential back-off (up to MAX_RETRIES)
  - Graceful degradation: every public method returns a safe empty result
    when Elasticsearch is unavailable, so the rest of the API keeps working
  - Structured logging for every index / search / delete operation

Environment variables
─────────────────────
  ELASTICSEARCH_HOST      — ES hostname (default: localhost)
  ELASTICSEARCH_PORT      — ES port     (default: 9200)
  ELASTICSEARCH_USER      — Basic-auth username (optional)
  ELASTICSEARCH_PASSWORD  — Basic-auth password (optional)

Index strategy
──────────────
  jworden_blog_posts      — BlogPost records (title, excerpt, body, category, tags)
  jworden_content_blocks  — PageContent CMS blocks (key, title, body)

Public API
──────────
  index_blog_post(post)          → bool
  index_content_block(block)     → bool
  search(query, filters, size)   → dict  {"hits": [...], "total": int}
  delete_index(doc_id, index)    → bool
  health()                       → dict  {"ok": bool, ...}
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any

logger = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────────────────────────

_ES_HOST = os.getenv("ELASTICSEARCH_HOST", "localhost")
_ES_PORT = int(os.getenv("ELASTICSEARCH_PORT", "9200"))
_ES_USER = os.getenv("ELASTICSEARCH_USER", "")
_ES_PASSWORD = os.getenv("ELASTICSEARCH_PASSWORD", "")

MAX_RETRIES = 3
RETRY_BASE_DELAY = 0.5  # seconds; doubles on each retry

INDEX_BLOG = "jworden_blog_posts"
INDEX_CONTENT = "jworden_content_blocks"

# ── Index mappings ─────────────────────────────────────────────────────────────

_BLOG_MAPPING: dict = {
    "mappings": {
        "properties": {
            "doc_type":         {"type": "keyword"},
            "slug":             {"type": "keyword"},
            "title":            {"type": "text", "analyzer": "english", "boost": 3},
            "excerpt":          {"type": "text", "analyzer": "english", "boost": 2},
            "body":             {"type": "text", "analyzer": "english"},
            "category":         {"type": "keyword"},
            "tags":             {"type": "text", "analyzer": "english"},
            "focus_keyword":    {"type": "keyword"},
            "author_name":      {"type": "keyword"},
            "status":           {"type": "keyword"},
            "featured":         {"type": "boolean"},
            "published_at":     {"type": "date"},
            "read_time_minutes":{"type": "integer"},
            "view_count":       {"type": "integer"},
            "tenant_id":        {"type": "keyword"},
        }
    },
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 0,
    },
}

_CONTENT_MAPPING: dict = {
    "mappings": {
        "properties": {
            "doc_type":  {"type": "keyword"},
            "key":       {"type": "keyword"},
            "title":     {"type": "text", "analyzer": "english", "boost": 3},
            "body":      {"type": "text", "analyzer": "english"},
            "updated_at":{"type": "date"},
        }
    },
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 0,
    },
}


# ── Client factory ─────────────────────────────────────────────────────────────

_client: Any = None  # module-level singleton


def _get_client() -> Any:
    """
    Return a cached Elasticsearch client, creating it on first call.
    Returns None if the elasticsearch package is not installed or the
    host is unreachable — callers must handle None gracefully.
    """
    global _client  # noqa: PLW0603

    if _client is not None:
        return _client

    try:
        from elasticsearch import Elasticsearch  # type: ignore  # noqa: PLC0415

        kwargs: dict[str, Any] = {
            "hosts": [{"host": _ES_HOST, "port": _ES_PORT, "scheme": "http"}],
            "request_timeout": 5,
            "retry_on_timeout": True,
            "max_retries": 2,
        }
        if _ES_USER and _ES_PASSWORD:
            kwargs["basic_auth"] = (_ES_USER, _ES_PASSWORD)

        _client = Elasticsearch(**kwargs)
        logger.info(
            "Elasticsearch client initialised: host=%s port=%d", _ES_HOST, _ES_PORT
        )
        return _client
    except ImportError:
        logger.warning(
            "elasticsearch package not installed — search features disabled. "
            "Add elasticsearch==8.13.0 to requirements.txt."
        )
        return None
    except Exception as exc:  # noqa: BLE001
        logger.warning("Elasticsearch client init failed: %s", exc)
        return None


def reset_client() -> None:
    """Force the next call to _get_client() to create a fresh connection."""
    global _client  # noqa: PLW0603
    _client = None


# ── Internal helpers ───────────────────────────────────────────────────────────

def _ensure_index(client: Any, index: str, mapping: dict) -> None:
    """Create the index with the given mapping if it does not already exist."""
    try:
        if not client.indices.exists(index=index):
            client.indices.create(index=index, body=mapping)
            logger.info("Elasticsearch index created: %s", index)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not ensure index %s: %s", index, exc)


def _with_retry(fn, *args, **kwargs) -> Any:
    """
    Call *fn* with exponential back-off retry.  Returns the result on success,
    or None after MAX_RETRIES failures.
    """
    delay = RETRY_BASE_DELAY
    last_exc: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            return fn(*args, **kwargs)
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            if attempt < MAX_RETRIES:
                logger.debug(
                    "ES operation failed (attempt %d/%d): %s — retrying in %.1fs",
                    attempt, MAX_RETRIES, exc, delay,
                )
                time.sleep(delay)
                delay *= 2
            else:
                logger.warning(
                    "ES operation failed after %d attempts: %s", MAX_RETRIES, exc
                )
    return None


# ── Public API ─────────────────────────────────────────────────────────────────

def index_blog_post(post: Any) -> bool:
    """
    Index (or re-index) a BlogPost ORM object in Elasticsearch.

    The document ID is ``blog_{post.id}`` so re-indexing the same post
    is idempotent (ES will overwrite the existing document).

    Returns True on success, False on any error (including ES unavailable).
    """
    client = _get_client()
    if client is None:
        logger.debug("ES unavailable — skipping blog post index for id=%s", getattr(post, "id", "?"))
        return False

    _ensure_index(client, INDEX_BLOG, _BLOG_MAPPING)

    doc = {
        "doc_type":          "blog_post",
        "slug":              post.slug,
        "title":             post.title or "",
        "excerpt":           post.excerpt or "",
        "body":              post.body or "",
        "category":          post.category or "",
        "tags":              post.tags or "",
        "focus_keyword":     post.focus_keyword or "",
        "author_name":       post.author_name or "J. Worden & Sons",
        "status":            post.status or "draft",
        "featured":          bool(post.featured),
        "published_at":      post.published_at.isoformat() if post.published_at else None,
        "read_time_minutes": post.read_time_minutes,
        "view_count":        post.view_count or 0,
        "tenant_id":         post.tenant_id or "default",
    }

    result = _with_retry(
        client.index,
        index=INDEX_BLOG,
        id=f"blog_{post.id}",
        document=doc,
    )
    if result is not None:
        logger.info("Indexed blog post: id=%s slug=%s", post.id, post.slug)
        return True
    return False


def index_content_block(block: Any) -> bool:
    """
    Index (or re-index) a PageContent ORM object in Elasticsearch.

    The document ID is ``content_{block.id}`` for idempotent upserts.

    Returns True on success, False on any error.
    """
    client = _get_client()
    if client is None:
        logger.debug("ES unavailable — skipping content block index for key=%s", getattr(block, "key", "?"))
        return False

    _ensure_index(client, INDEX_CONTENT, _CONTENT_MAPPING)

    doc = {
        "doc_type":   "content_block",
        "key":        block.key or "",
        "title":      block.title or "",
        "body":       block.body or "",
        "updated_at": block.updated_at.isoformat() if block.updated_at else None,
    }

    result = _with_retry(
        client.index,
        index=INDEX_CONTENT,
        id=f"content_{block.id}",
        document=doc,
    )
    if result is not None:
        logger.info("Indexed content block: id=%s key=%s", block.id, block.key)
        return True
    return False


def search(
    query: str,
    filters: dict[str, str] | None = None,
    size: int = 20,
) -> dict[str, Any]:
    """
    Full-text search across blog posts and/or content blocks.

    Parameters
    ----------
    query:
        The user's search string.  Searched across title, excerpt, body,
        tags, and focus_keyword fields.
    filters:
        Optional dict of keyword filters.  Supported keys:
          ``type``     — "blog" | "content" | "all" (default: "all")
          ``category`` — blog post category (e.g. "asphalt-maintenance")
          ``status``   — blog post status (e.g. "published")
    size:
        Maximum number of results to return (default: 20, max: 100).

    Returns
    -------
    dict with keys:
      ``hits``  — list of result dicts (each has ``_id``, ``_score``, ``_source``)
      ``total`` — total number of matching documents
      ``query`` — the original query string (for debugging)

    On any error (including ES unavailable), returns an empty result set
    so callers can degrade gracefully.
    """
    client = _get_client()
    if client is None or not query or not query.strip():
        return {"hits": [], "total": 0, "query": query}

    filters = filters or {}
    doc_type_filter = filters.get("type", "all").lower()
    category_filter = filters.get("category", "")
    status_filter = filters.get("status", "")

    # Determine which indexes to search
    if doc_type_filter == "blog":
        indexes = [INDEX_BLOG]
    elif doc_type_filter == "content":
        indexes = [INDEX_CONTENT]
    else:
        indexes = [INDEX_BLOG, INDEX_CONTENT]

    # Build the ES query
    must_clauses: list[dict] = [
        {
            "multi_match": {
                "query": query.strip(),
                "fields": ["title^3", "excerpt^2", "body", "tags", "focus_keyword^2"],
                "type": "best_fields",
                "fuzziness": "AUTO",
                "minimum_should_match": "75%",
            }
        }
    ]

    filter_clauses: list[dict] = []
    if category_filter:
        filter_clauses.append({"term": {"category": category_filter}})
    if status_filter:
        filter_clauses.append({"term": {"status": status_filter}})

    es_query: dict = {
        "query": {
            "bool": {
                "must": must_clauses,
                "filter": filter_clauses,
            }
        },
        "highlight": {
            "fields": {
                "title":   {"number_of_fragments": 0},
                "excerpt": {"number_of_fragments": 1, "fragment_size": 200},
                "body":    {"number_of_fragments": 2, "fragment_size": 200},
            },
            "pre_tags":  ["<mark>"],
            "post_tags": ["</mark>"],
        },
        "size": min(size, 100),
        "_source": True,
    }

    def _do_search():
        return client.search(index=indexes, body=es_query)

    raw = _with_retry(_do_search)
    if raw is None:
        return {"hits": [], "total": 0, "query": query}

    hits_raw = raw.get("hits", {})
    total = hits_raw.get("total", {}).get("value", 0)

    hits = []
    for hit in hits_raw.get("hits", []):
        hits.append(
            {
                "_id":        hit.get("_id"),
                "_index":     hit.get("_index"),
                "_score":     hit.get("_score"),
                "_source":    hit.get("_source", {}),
                "highlights": hit.get("highlight", {}),
            }
        )

    logger.info(
        "ES search: query=%r type=%s total=%d", query, doc_type_filter, total
    )
    return {"hits": hits, "total": total, "query": query}


def delete_index(doc_id: str, index: str = INDEX_BLOG) -> bool:
    """
    Remove a document from the given index by its Elasticsearch document ID.

    Parameters
    ----------
    doc_id:
        The ES document ID (e.g. ``"blog_42"`` or ``"content_7"``).
    index:
        The index to delete from (default: ``INDEX_BLOG``).

    Returns True on success or if the document did not exist, False on error.
    """
    client = _get_client()
    if client is None:
        logger.debug("ES unavailable — skipping delete for doc_id=%s", doc_id)
        return False

    try:
        from elasticsearch import NotFoundError  # type: ignore  # noqa: PLC0415

        def _do_delete():
            return client.delete(index=index, id=doc_id)

        result = _with_retry(_do_delete)
        if result is not None:
            logger.info("Deleted ES document: index=%s id=%s", index, doc_id)
            return True
        return False
    except Exception as exc:  # noqa: BLE001
        # NotFoundError is acceptable — document was already gone
        if "NotFoundError" in type(exc).__name__ or "404" in str(exc):
            logger.debug("ES document not found (already deleted): index=%s id=%s", index, doc_id)
            return True
        logger.warning("ES delete failed: index=%s id=%s error=%s", index, doc_id, exc)
        return False


def health() -> dict[str, Any]:
    """
    Check Elasticsearch cluster health.

    Returns
    -------
    dict with keys:
      ``ok``      — True if ES is reachable and cluster status is green/yellow
      ``status``  — ES cluster status string ("green" | "yellow" | "red")
      ``error``   — error message if ES is unreachable (only present on failure)
      ``host``    — the configured ES host:port
    """
    client = _get_client()
    host_str = f"{_ES_HOST}:{_ES_PORT}"

    if client is None:
        return {
            "ok": False,
            "status": "unavailable",
            "error": "Elasticsearch client could not be initialised",
            "host": host_str,
        }

    try:
        import time as _time  # noqa: PLC0415

        t0 = _time.monotonic()
        info = client.cluster.health(timeout="3s")
        latency_ms = round((_time.monotonic() - t0) * 1000, 2)

        cluster_status = info.get("status", "unknown")
        ok = cluster_status in ("green", "yellow")

        return {
            "ok": ok,
            "status": cluster_status,
            "cluster_name": info.get("cluster_name", ""),
            "number_of_nodes": info.get("number_of_nodes", 0),
            "latency_ms": latency_ms,
            "host": host_str,
        }
    except Exception as exc:  # noqa: BLE001
        logger.warning("Elasticsearch health check failed: %s", exc)
        return {
            "ok": False,
            "status": "unreachable",
            "error": str(exc),
            "host": host_str,
        }
