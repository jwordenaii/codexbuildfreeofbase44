"""
search_service.py — Elasticsearch full-text search for blog posts.

Provides a SearchService class that wraps the official elasticsearch-py
client (v8) with graceful degradation: every method catches connection
errors and logs them rather than crashing the request.

Environment variables
─────────────────────
  ELASTICSEARCH_URL  — Elasticsearch base URL (default: http://localhost:9200)

Public API
──────────
  search_service.index_blog_post(post_id, title, body, excerpt, tags)
  search_service.search_blog(query, limit=10)
  search_service.delete_blog_post(post_id)
  search_service.reindex_all_blog_posts()
"""

from __future__ import annotations

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

_INDEX_NAME = "blog_posts"

# Mapping for the blog_posts index — defined once and applied on first use.
_INDEX_MAPPING = {
    "settings": {
        "analysis": {
            "analyzer": {
                "blog_analyzer": {
                    "type": "custom",
                    "tokenizer": "standard",
                    "filter": ["lowercase", "stop", "snowball"],
                }
            }
        }
    },
    "mappings": {
        "properties": {
            "post_id":    {"type": "integer"},
            "slug":       {"type": "keyword"},
            "title":      {"type": "text", "analyzer": "blog_analyzer", "boost": 3},
            "excerpt":    {"type": "text", "analyzer": "blog_analyzer", "boost": 2},
            "body":       {"type": "text", "analyzer": "blog_analyzer"},
            "tags":       {"type": "text", "analyzer": "blog_analyzer"},
            "category":   {"type": "keyword"},
            "status":     {"type": "keyword"},
            "published_at": {"type": "date"},
        }
    },
}


class SearchService:
    """
    Thin wrapper around the Elasticsearch 8 Python client for blog search.

    The client is created lazily on first use so the application starts
    successfully even when Elasticsearch is unreachable (e.g. local dev
    without a running ES instance).
    """

    def __init__(self) -> None:
        self._client: Any = None
        self._es_url: str = os.getenv("ELASTICSEARCH_URL", "http://localhost:9200")

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _get_client(self) -> Any:
        """Return (and lazily create) the Elasticsearch client."""
        if self._client is None:
            try:
                from elasticsearch import Elasticsearch  # noqa: PLC0415
                self._client = Elasticsearch(
                    self._es_url,
                    request_timeout=10,
                    retry_on_timeout=True,
                    max_retries=2,
                )
                logger.info("Elasticsearch client initialised: url=%s", self._es_url)
            except Exception as exc:  # noqa: BLE001
                logger.error("Failed to create Elasticsearch client: %s", exc)
                raise
        return self._client

    def _ensure_index(self) -> None:
        """Create the blog_posts index with the correct mapping if it doesn't exist."""
        client = self._get_client()
        if not client.indices.exists(index=_INDEX_NAME):
            client.indices.create(index=_INDEX_NAME, body=_INDEX_MAPPING)
            logger.info("Elasticsearch index created: %s", _INDEX_NAME)

    # ── Public API ────────────────────────────────────────────────────────────

    def index_blog_post(
        self,
        post_id: int,
        title: str,
        body: str,
        excerpt: str,
        tags: str | None = None,
        slug: str | None = None,
        category: str | None = None,
        status: str = "published",
        published_at: str | None = None,
    ) -> bool:
        """
        Index (or re-index) a single blog post.

        Uses the post_id as the document ID so repeated calls are idempotent
        (Elasticsearch will overwrite the existing document).

        Returns True on success, False on any Elasticsearch error.
        """
        try:
            client = self._get_client()
            self._ensure_index()
            doc = {
                "post_id":     post_id,
                "slug":        slug or "",
                "title":       title,
                "excerpt":     excerpt,
                "body":        body,
                "tags":        tags or "",
                "category":    category or "",
                "status":      status,
                "published_at": published_at,
            }
            client.index(index=_INDEX_NAME, id=str(post_id), document=doc)
            logger.info("Indexed blog post: post_id=%d title=%r", post_id, title)
            return True
        except Exception as exc:  # noqa: BLE001
            logger.error("Failed to index blog post post_id=%d: %s", post_id, exc)
            return False

    def search_blog(self, query: str, limit: int = 10) -> list[dict]:
        """
        Full-text search across blog posts.

        Supports:
          - Phrase search:   "sealcoating driveway"  (quoted terms)
          - Fuzzy matching:  typos are tolerated via fuzziness=AUTO
          - Boolean:         terms are combined with OR across fields,
                             boosted by field importance (title > excerpt > body)

        Returns a list of result dicts with keys:
          post_id, slug, title, excerpt, score
        """
        if not query or not query.strip():
            return []

        try:
            client = self._get_client()
            self._ensure_index()

            es_query = {
                "query": {
                    "bool": {
                        "should": [
                            # Phrase match — highest relevance
                            {
                                "multi_match": {
                                    "query": query,
                                    "fields": ["title^3", "excerpt^2", "body", "tags"],
                                    "type": "phrase",
                                    "boost": 2,
                                }
                            },
                            # Best-fields fuzzy match — catches typos
                            {
                                "multi_match": {
                                    "query": query,
                                    "fields": ["title^3", "excerpt^2", "body", "tags"],
                                    "type": "best_fields",
                                    "fuzziness": "AUTO",
                                    "prefix_length": 2,
                                }
                            },
                        ],
                        "minimum_should_match": 1,
                        # Only surface published posts
                        "filter": [{"term": {"status": "published"}}],
                    }
                },
                "size": limit,
                "_source": ["post_id", "slug", "title", "excerpt", "category", "published_at"],
                "highlight": {
                    "fields": {
                        "title":   {"number_of_fragments": 0},
                        "excerpt": {"number_of_fragments": 1, "fragment_size": 200},
                    },
                    "pre_tags":  ["<mark>"],
                    "post_tags": ["</mark>"],
                },
            }

            response = client.search(index=_INDEX_NAME, body=es_query)
            hits = response.get("hits", {}).get("hits", [])

            results = []
            for hit in hits:
                src = hit.get("_source", {})
                highlight = hit.get("highlight", {})
                results.append({
                    "post_id":      src.get("post_id"),
                    "slug":         src.get("slug", ""),
                    "title":        src.get("title", ""),
                    "excerpt":      src.get("excerpt", ""),
                    "category":     src.get("category", ""),
                    "published_at": src.get("published_at"),
                    "score":        round(hit.get("_score", 0.0), 4),
                    "highlight":    {
                        "title":   highlight.get("title", []),
                        "excerpt": highlight.get("excerpt", []),
                    },
                })

            logger.info(
                "Blog search: query=%r hits=%d limit=%d",
                query, len(results), limit,
            )
            return results

        except Exception as exc:  # noqa: BLE001
            logger.error("Blog search failed: query=%r error=%s", query, exc)
            return []

    def delete_blog_post(self, post_id: int) -> bool:
        """
        Remove a blog post from the search index.

        Returns True on success or if the document did not exist.
        Returns False on any Elasticsearch connection/server error.
        """
        try:
            client = self._get_client()
            self._ensure_index()
            client.delete(index=_INDEX_NAME, id=str(post_id), ignore=[404])
            logger.info("Deleted blog post from index: post_id=%d", post_id)
            return True
        except Exception as exc:  # noqa: BLE001
            logger.error("Failed to delete blog post post_id=%d from index: %s", post_id, exc)
            return False

    def reindex_all_blog_posts(self) -> dict:
        """
        Rebuild the entire blog_posts index from the database.

        Drops and recreates the index, then bulk-indexes every published post.
        Returns a summary dict: {indexed, skipped, errors, total}.
        """
        from ..database import SessionLocal  # noqa: PLC0415
        from ..models import BlogPost  # noqa: PLC0415

        summary = {"indexed": 0, "skipped": 0, "errors": 0, "total": 0}

        try:
            client = self._get_client()

            # Drop and recreate the index for a clean rebuild
            if client.indices.exists(index=_INDEX_NAME):
                client.indices.delete(index=_INDEX_NAME)
                logger.info("Dropped existing index: %s", _INDEX_NAME)
            client.indices.create(index=_INDEX_NAME, body=_INDEX_MAPPING)
            logger.info("Recreated index: %s", _INDEX_NAME)

        except Exception as exc:  # noqa: BLE001
            logger.error("Failed to recreate Elasticsearch index: %s", exc)
            summary["errors"] += 1
            return summary

        db = SessionLocal()
        try:
            posts = db.query(BlogPost).filter(BlogPost.status == "published").all()
            summary["total"] = len(posts)

            for post in posts:
                published_at_str = (
                    post.published_at.isoformat() if post.published_at else None
                )
                ok = self.index_blog_post(
                    post_id=post.id,
                    title=post.title,
                    body=post.body or "",
                    excerpt=post.excerpt or "",
                    tags=post.tags,
                    slug=post.slug,
                    category=post.category,
                    status=post.status,
                    published_at=published_at_str,
                )
                if ok:
                    summary["indexed"] += 1
                else:
                    summary["errors"] += 1

        except Exception as exc:  # noqa: BLE001
            logger.error("Error during reindex: %s", exc, exc_info=True)
            summary["errors"] += 1
        finally:
            db.close()

        logger.info(
            "Reindex complete: indexed=%d errors=%d total=%d",
            summary["indexed"], summary["errors"], summary["total"],
        )
        return summary

    def get_index_status(self) -> dict:
        """
        Return basic index health and document count.

        Returns a dict with keys: available, doc_count, index_name, es_url.
        """
        try:
            client = self._get_client()
            self._ensure_index()
            stats = client.indices.stats(index=_INDEX_NAME)
            doc_count = (
                stats.get("indices", {})
                .get(_INDEX_NAME, {})
                .get("total", {})
                .get("docs", {})
                .get("count", 0)
            )
            health = client.cluster.health(index=_INDEX_NAME)
            return {
                "available":  True,
                "doc_count":  doc_count,
                "index_name": _INDEX_NAME,
                "es_url":     self._es_url,
                "status":     health.get("status", "unknown"),
            }
        except Exception as exc:  # noqa: BLE001
            logger.warning("Elasticsearch unavailable: %s", exc)
            return {
                "available":  False,
                "doc_count":  0,
                "index_name": _INDEX_NAME,
                "es_url":     self._es_url,
                "error":      str(exc),
            }


# Module-level singleton — import this everywhere
search_service = SearchService()
