"""
vector_search_service.py — Pinecone vector database integration for semantic
search on blog posts.

Embeds blog post content using OpenAI's text-embedding-3-small model and
stores vectors in a Pinecone index.  Provides semantic similarity search so
customers can find relevant content even when they use different keywords.

Required environment variables:
  PINECONE_API_KEY    — Pinecone API key (from console.pinecone.io)
  PINECONE_INDEX_NAME — Name of the Pinecone index (e.g. "blog-posts")
  OPENAI_API_KEY      — OpenAI API key (for embeddings)

The index must be created in Pinecone with dimension=1536 (text-embedding-3-small)
and metric=cosine before use.  See VECTOR_SEARCH.md for setup instructions.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

# Embedding model and its output dimension
_EMBEDDING_MODEL = "text-embedding-3-small"
_EMBEDDING_DIM = 1536


def _get_openai_client():
    """Return an OpenAI client, raising clearly if the key is missing."""
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")
    from openai import OpenAI  # noqa: PLC0415
    return OpenAI(api_key=api_key)


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
    Generate an embedding vector for the given text using OpenAI.

    Args:
        text: The text to embed (title + excerpt + body combined).

    Returns:
        A list of 1536 floats representing the embedding vector.
    """
    client = _get_openai_client()
    # Replace newlines to improve embedding quality (OpenAI recommendation)
    cleaned = text.replace("\n", " ").strip()
    response = client.embeddings.create(
        model=_EMBEDDING_MODEL,
        input=cleaned,
    )
    return response.data[0].embedding


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
            return {
                "configured": True,
                "index_name": os.getenv("PINECONE_INDEX_NAME", ""),
                "total_vector_count": stats.get("total_vector_count", 0),
                "dimension": stats.get("dimension", _EMBEDDING_DIM),
                "namespaces": stats.get("namespaces", {}),
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
