"""
vector_search_service.py — Pinecone vector database integration for semantic
search on blog posts.

Embeds blog post content and stores vectors in a Pinecone index.  Provides
semantic similarity search so customers can find relevant content even when
they use different keywords.

Embedding provider (auto-selected, OpenAI preferred for index continuity):
  1. OpenAI  text-embedding-3-small     → 1536 dims  (OPENAI_API_KEY)
  2. Google  gemini-embedding-001       → 1536 dims via output_dimensionality
                                          (GOOGLE_API_KEY / GEMINI_API_KEY)

Both produce 1536-dim vectors so either can populate the SAME Pinecone index.

  ⚠️  VECTORS FROM DIFFERENT MODELS ARE NOT COMPARABLE.  Matching dimensions
      only means Pinecone accepts the write — similarity scores across mixed
      providers are meaningless.  If the active provider changes, the index
      must be rebuilt with reindex_all_blog_posts() so every vector comes
      from one model.  get_index_status() reports the active provider so the
      mismatch is visible rather than silent.

Required environment variables:
  PINECONE_API_KEY    — Pinecone API key (from console.pinecone.io)
  PINECONE_INDEX_NAME — Name of the Pinecone index (e.g. "blog-posts")
  OPENAI_API_KEY *or* GOOGLE_API_KEY / GEMINI_API_KEY — for embeddings

The index must be created in Pinecone with dimension=1536 and metric=cosine
before use.  See VECTOR_SEARCH.md for setup instructions.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

# Embedding models and the shared output dimension the Pinecone index expects.
_EMBEDDING_MODEL = "text-embedding-3-small"      # OpenAI
_GOOGLE_EMBEDDING_MODEL = "gemini-embedding-001"  # Google
_EMBEDDING_DIM = 1536


def _google_key() -> str:
    return (os.getenv("GOOGLE_API_KEY", "") or os.getenv("GEMINI_API_KEY", "")).strip()


def embedding_provider() -> str:
    """Which provider will serve embeddings: 'openai' | 'google' | 'none'.

    OpenAI is preferred when available so an index built with OpenAI vectors
    keeps working. Google is the fallback when OPENAI_API_KEY is absent.
    """
    if os.getenv("OPENAI_API_KEY", "").strip():
        return "openai"
    if _google_key():
        return "google"
    return "none"


def _get_openai_client():
    """Return an OpenAI client, raising clearly if the key is missing."""
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")
    from openai import OpenAI  # noqa: PLC0415
    return OpenAI(api_key=api_key)


def _get_google_client():
    """Return a google-genai client, raising clearly if the key is missing."""
    key = _google_key()
    if not key:
        raise RuntimeError("GOOGLE_API_KEY / GEMINI_API_KEY is not set")
    from google import genai  # noqa: PLC0415
    return genai.Client(api_key=key)


def _embed_google(cleaned: str) -> list[float]:
    """Embed with gemini-embedding-001, pinned to the index's 1536 dims."""
    client = _get_google_client()
    resp = client.models.embed_content(
        model=_GOOGLE_EMBEDDING_MODEL,
        contents=cleaned,
        config={"output_dimensionality": _EMBEDDING_DIM},
    )
    embeddings = getattr(resp, "embeddings", None)
    if not embeddings:
        raise RuntimeError("Google embedding response contained no embeddings")
    vector = list(getattr(embeddings[0], "values", None) or [])
    # Never write a wrong-width vector into a 1536-dim index — fail loudly
    # instead of silently corrupting search quality.
    if len(vector) != _EMBEDDING_DIM:
        raise RuntimeError(
            f"{_GOOGLE_EMBEDDING_MODEL} returned {len(vector)} dims, expected "
            f"{_EMBEDDING_DIM}; the installed google-genai may not support "
            "output_dimensionality. Pin the SDK or recreate the index."
        )
    return vector


def _get_pinecone_index():
    """
    Return a Pinecone Index object for the configured index.

    Raises RuntimeError if PINECONE_API_KEY or PINECONE_INDEX_NAME are absent.
    """
    api_key = os.getenv("PINECONE_API_KEY", "")
    index_name = os.getenv("PINECONE_INDEX_NAME", "")

    if not api_key:
        raise RuntimeError("PINECONE_API_KEY is not set")
    if not index_name:
        raise RuntimeError("PINECONE_INDEX_NAME is not set")

    from pinecone import Pinecone  # noqa: PLC0415
    pc = Pinecone(api_key=api_key)
    return pc.Index(index_name)


def _embed_text(text: str) -> list[float]:
    """
    Generate an embedding vector for the given text.

    Uses whichever provider is configured (OpenAI preferred, Google fallback).
    Both are pinned to 1536 dims so either can serve the same index — but the
    active provider must be consistent across indexing AND querying, or the
    similarity scores are meaningless. See the module docstring.

    Args:
        text: The text to embed (title + excerpt + body combined).

    Returns:
        A list of 1536 floats representing the embedding vector.
    """
    # Replace newlines to improve embedding quality (OpenAI recommendation)
    cleaned = text.replace("\n", " ").strip()

    provider = embedding_provider()
    if provider == "openai":
        client = _get_openai_client()
        response = client.embeddings.create(
            model=_EMBEDDING_MODEL,
            input=cleaned,
        )
        return response.data[0].embedding
    if provider == "google":
        return _embed_google(cleaned)
    raise RuntimeError(
        "No embedding provider configured — set OPENAI_API_KEY or "
        "GOOGLE_API_KEY / GEMINI_API_KEY"
    )


def _build_document_text(title: str, excerpt: str, body: str) -> str:
    """
    Combine blog post fields into a single string for embedding.

    Title and excerpt are weighted by repetition since they are the most
    semantically dense parts of a post.
    """
    # Truncate body to avoid exceeding token limits (~8191 tokens for this model)
    body_preview = body[:4000] if body else ""
    return f"{title}\n\n{excerpt}\n\n{body_preview}"


class VectorSearchService:
    """
    Service for indexing and searching blog posts in Pinecone.

    All methods degrade gracefully when Pinecone or OpenAI credentials are
    absent — they log a warning and return empty/None results rather than
    raising exceptions.  This ensures the blog CRUD endpoints continue to
    work even if vector search is not yet configured.
    """

    # ── Indexing ──────────────────────────────────────────────────────────────

    def index_blog_post(
        self,
        post_id: int,
        title: str,
        body: str,
        excerpt: str,
        *,
        category: Optional[str] = None,
        tags: Optional[str] = None,
        slug: Optional[str] = None,
        status: str = "published",
    ) -> bool:
        """
        Embed a blog post and upsert it into the Pinecone index.

        Args:
            post_id:  Database primary key (used as the Pinecone vector ID).
            title:    Post title.
            body:     Full post body (Markdown).
            excerpt:  Short teaser paragraph.
            category: Optional category string for metadata filtering.
            tags:     Optional comma-separated tags for metadata filtering.
            slug:     URL slug for linking back to the post.
            status:   Publication status ('draft' | 'published' | 'archived').

        Returns:
            True on success, False if indexing was skipped or failed.
        """
        try:
            index = _get_pinecone_index()
            document_text = _build_document_text(title, excerpt, body)
            vector = _embed_text(document_text)

            metadata = {
                "post_id": post_id,
                "title": title,
                "excerpt": excerpt[:500] if excerpt else "",
                "slug": slug or "",
                "category": category or "",
                "tags": tags or "",
                "status": status,
            }

            index.upsert(vectors=[{
                "id": str(post_id),
                "values": vector,
                "metadata": metadata,
            }])

            logger.info(
                "vector_search: indexed post_id=%d title=%r",
                post_id,
                title,
            )
            return True

        except RuntimeError as exc:
            logger.warning("vector_search: skipping index — %s", exc)
            return False
        except Exception as exc:  # noqa: BLE001
            logger.error(
                "vector_search: failed to index post_id=%d error=%s",
                post_id,
                exc,
                exc_info=True,
            )
            return False

    # ── Search ────────────────────────────────────────────────────────────────

    def search_semantic(
        self,
        query: str,
        limit: int = 10,
        *,
        filter_status: str = "published",
    ) -> list[dict]:
        """
        Perform a semantic similarity search against the Pinecone index.

        Args:
            query:         Natural-language search query from the user.
            limit:         Maximum number of results to return (1–100).
            filter_status: Only return posts with this status (default: 'published').

        Returns:
            List of result dicts ordered by descending similarity score:
            [
              {
                "post_id": 42,
                "title": "...",
                "excerpt": "...",
                "slug": "...",
                "category": "...",
                "tags": "...",
                "score": 0.91,
              },
              ...
            ]
            Returns an empty list if search is unavailable or fails.
        """
        if not query or not query.strip():
            return []

        limit = max(1, min(limit, 100))

        try:
            index = _get_pinecone_index()
            query_vector = _embed_text(query.strip())

            pinecone_filter = {"status": {"$eq": filter_status}} if filter_status else {}

            response = index.query(
                vector=query_vector,
                top_k=limit,
                include_metadata=True,
                filter=pinecone_filter if pinecone_filter else None,
            )

            results = []
            for match in response.get("matches", []):
                meta = match.get("metadata", {})
                results.append({
                    "post_id":  int(meta.get("post_id", 0)),
                    "title":    meta.get("title", ""),
                    "excerpt":  meta.get("excerpt", ""),
                    "slug":     meta.get("slug", ""),
                    "category": meta.get("category", ""),
                    "tags":     meta.get("tags", ""),
                    "score":    round(float(match.get("score", 0.0)), 4),
                })

            logger.info(
                "vector_search: query=%r returned %d results",
                query,
                len(results),
            )
            return results

        except RuntimeError as exc:
            logger.warning("vector_search: search unavailable — %s", exc)
            return []
        except Exception as exc:  # noqa: BLE001
            logger.error(
                "vector_search: search failed query=%r error=%s",
                query,
                exc,
                exc_info=True,
            )
            return []

    # ── Deletion ──────────────────────────────────────────────────────────────

    def delete_blog_post(self, post_id: int) -> bool:
        """
        Remove a blog post vector from the Pinecone index.

        Args:
            post_id: Database primary key of the post to remove.

        Returns:
            True on success, False if deletion was skipped or failed.
        """
        try:
            index = _get_pinecone_index()
            index.delete(ids=[str(post_id)])
            logger.info("vector_search: deleted post_id=%d from index", post_id)
            return True

        except RuntimeError as exc:
            logger.warning("vector_search: skipping delete — %s", exc)
            return False
        except Exception as exc:  # noqa: BLE001
            logger.error(
                "vector_search: failed to delete post_id=%d error=%s",
                post_id,
                exc,
                exc_info=True,
            )
            return False

    # ── Reindexing ────────────────────────────────────────────────────────────

    def reindex_all_blog_posts(self) -> dict:
        """
        Rebuild the entire Pinecone index from the database.

        Fetches all blog posts (all statuses) from the database and upserts
        their embeddings into Pinecone.  Existing vectors are overwritten.

        Returns:
            {
              "total":   int,   # posts found in DB
              "indexed": int,   # successfully indexed
              "failed":  int,   # failed to index
              "skipped": int,   # skipped (e.g. Pinecone not configured)
            }
        """
        from ..database import SessionLocal  # noqa: PLC0415
        from ..models import BlogPost  # noqa: PLC0415

        result = {"total": 0, "indexed": 0, "failed": 0, "skipped": 0}

        db = SessionLocal()
        try:
            posts = db.query(BlogPost).all()
            result["total"] = len(posts)
            logger.info("vector_search: reindexing %d blog posts", len(posts))

            for post in posts:
                success = self.index_blog_post(
                    post_id=post.id,
                    title=post.title or "",
                    body=post.body or "",
                    excerpt=post.excerpt or "",
                    category=post.category,
                    tags=post.tags,
                    slug=post.slug,
                    status=post.status or "draft",
                )
                if success:
                    result["indexed"] += 1
                else:
                    # Distinguish between "not configured" (first post returns False
                    # due to RuntimeError) and genuine failures.
                    result["failed"] += 1

            logger.info(
                "vector_search: reindex complete — indexed=%d failed=%d",
                result["indexed"],
                result["failed"],
            )
            return result

        except Exception as exc:  # noqa: BLE001
            logger.error("vector_search: reindex_all failed: %s", exc, exc_info=True)
            raise
        finally:
            db.close()

    # ── Status ────────────────────────────────────────────────────────────────

    def get_index_status(self) -> dict:
        """
        Return metadata about the Pinecone index (vector count, dimension, etc.).

        Returns:
            Dict with index stats, or an error/not_configured dict on failure.
        """
        try:
            index = _get_pinecone_index()
            stats = index.describe_index_stats()
            provider = embedding_provider()
            return {
                "configured": True,
                "index_name": os.getenv("PINECONE_INDEX_NAME", ""),
                "total_vector_count": stats.get("total_vector_count", 0),
                "dimension": stats.get("dimension", _EMBEDDING_DIM),
                "namespaces": stats.get("namespaces", {}),
                # Active embedding provider. If this changed since the vectors
                # were written, similarity scores are meaningless until
                # reindex_all_blog_posts() rebuilds the index on one model.
                "embedding_provider": provider,
                "embedding_model": (
                    _EMBEDDING_MODEL if provider == "openai"
                    else _GOOGLE_EMBEDDING_MODEL if provider == "google"
                    else None
                ),
            }
        except RuntimeError as exc:
            return {"configured": False, "reason": str(exc)}
        except Exception as exc:  # noqa: BLE001
            logger.error("vector_search: get_index_status failed: %s", exc)
            return {"configured": True, "error": str(exc)}


# ── Module-level singleton ────────────────────────────────────────────────────
# Import this instance in routers and tasks:
#   from ..services.vector_search_service import vector_search_service

vector_search_service = VectorSearchService()
