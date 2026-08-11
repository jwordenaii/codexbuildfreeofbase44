"""
web_search.py — web search tool for Jarvis, backed by Tavily with an Exa fallback.

Set env:
  TAVILY_API_KEY=tvly-xxxxxxxxxxxxxxxxxxxxxxxx     (preferred - includes a synthesized answer)
  (Optional) TAVILY_MAX_RESULTS=5
  EXA_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx  (used automatically when Tavily isn't configured)

Tavily free tier = 1,000 searches/month, no card required. Get a key at https://app.tavily.com/.
Exa: https://exa.ai/ - neural/semantic search, no synthesized answer field.

Returns a compact dict:
  { "query": str, "answer": str | None, "results": [ {title, url, snippet} ], "engine": "tavily" | "exa" }

Falls back to a stub when no key is set so callers can still test the path.
"""
from __future__ import annotations
import os
import logging
from typing import Any

from app.services import runtime_config as _cfg

logger = logging.getLogger(__name__)

def _tavily_key() -> str:  return _cfg.get("TAVILY_API_KEY")
def _exa_key() -> str:     return _cfg.get("EXA_API_KEY")
def _max_results() -> int:
    raw = _cfg.get("TAVILY_MAX_RESULTS") or "5"
    try:    return int(raw)
    except (TypeError, ValueError): return 5
_TAVILY_URL = "https://api.tavily.com/search"
_EXA_URL = "https://api.exa.ai/search"


def is_available() -> bool:
    return bool(_tavily_key()) or bool(_exa_key())


async def search(query: str, *, max_results: int | None = None, deep: bool = False) -> dict[str, Any]:
    """
    Run a web search. Safe for any caller - never raises.
    Prefers Tavily (returns a synthesized answer); falls back to Exa when
    only EXA_API_KEY is configured. deep=True triggers Tavily's 'advanced'
    search depth (slower, richer) - ignored for the Exa path.
    """
    q = (query or "").strip()
    if not q:
        return {"query": "", "answer": None, "results": [], "engine": "tavily", "error": "empty query"}

    if not _tavily_key() and not _exa_key():
        return {
            "query": q,
            "answer": None,
            "results": [],
            "engine": "tavily",
            "error": "No web search key set - add TAVILY_API_KEY or EXA_API_KEY in Command Center -> Integrations to enable live web search.",
        }

    try:
        import httpx  # type: ignore
    except ImportError:
        return {"query": q, "answer": None, "results": [], "engine": "tavily", "error": "httpx not installed"}

    if _tavily_key():
        payload = {
            "api_key":            _tavily_key(),
            "query":              q,
            "search_depth":       "advanced" if deep else "basic",
            "include_answer":     True,
            "include_raw_content": False,
            "max_results":        int(max_results or _max_results()),
        }
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                r = await client.post(_TAVILY_URL, json=payload)
            if r.status_code != 200:
                logger.warning("[WEB_SEARCH] Tavily non-200: %s %s", r.status_code, r.text[:200])
                return {"query": q, "answer": None, "results": [], "engine": "tavily", "error": f"http {r.status_code}"}
            data = r.json()
            return {
                "query":   q,
                "answer":  data.get("answer"),
                "results": [
                    {
                        "title":   item.get("title", ""),
                        "url":     item.get("url", ""),
                        "snippet": (item.get("content") or "")[:500],
                        "score":   item.get("score"),
                    }
                    for item in (data.get("results") or [])[:int(max_results or _max_results())]
                ],
                "engine": "tavily",
            }
        except Exception as exc:  # noqa: BLE001
            logger.warning("[WEB_SEARCH] Tavily call failed: %s", exc)
            return {"query": q, "answer": None, "results": [], "engine": "tavily", "error": str(exc)[:200]}

    # Exa fallback (no Tavily key configured)
    payload = {
        "query":       q,
        "numResults":  int(max_results or _max_results()),
        "contents":    {"text": {"maxCharacters": 500}},
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(
                _EXA_URL,
                json=payload,
                headers={"x-api-key": _exa_key(), "content-type": "application/json"},
            )
        if r.status_code != 200:
            logger.warning("[WEB_SEARCH] Exa non-200: %s %s", r.status_code, r.text[:200])
            return {"query": q, "answer": None, "results": [], "engine": "exa", "error": f"http {r.status_code}"}
        data = r.json()
        return {
            "query":   q,
            "answer":  None,
            "results": [
                {
                    "title":   item.get("title", ""),
                    "url":     item.get("url", ""),
                    "snippet": (item.get("text") or "")[:500],
                    "score":   item.get("score"),
                }
                for item in (data.get("results") or [])[:int(max_results or _max_results())]
            ],
            "engine": "exa",
        }
    except Exception as exc:  # noqa: BLE001
        logger.warning("[WEB_SEARCH] Exa call failed: %s", exc)
        return {"query": q, "answer": None, "results": [], "engine": "exa", "error": str(exc)[:200]}
