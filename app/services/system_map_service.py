"""
system_map_service.py — lets JARVIS read his own platform.

Jarvis previously had no way to answer "what can you actually do?", "do we have
anything for lien deadlines?" or "where does drone data live?". He either
guessed from training memory or declined. Both are bad: the platform has ~104
routers and 70+ tables, and any hardcoded description of it would be stale
within a week.

So this introspects the *running* application instead of describing it:

  * routes come from the live FastAPI app object — whatever is mounted right
    now is what he reports, including anything added after this file was written
  * tables come from a live SQLAlchemy inspection of the production database
  * a keyword search spans both, so "lien" finds the endpoints and the tables

That makes the answer self-updating and impossible to drift out of date.
"""

from __future__ import annotations

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

# Paths that exist for infrastructure rather than capability. Listing them adds
# noise to every answer without telling the operator anything useful.
_NOISE = re.compile(r"^/(openapi\.json|docs|redoc|docs/oauth2-redirect|static)")


def _group_of(path: str) -> str:
    """Capability group for a path: the segment after /api/v1/."""
    m = re.match(r"^/api/v1/([^/{]+)", path)
    if m:
        return m.group(1)
    m = re.match(r"^/([^/{]+)", path)
    return m.group(1) if m else "root"


def _collect_routes() -> list[dict[str, Any]]:
    """Read every mounted route off the live app."""
    from ..main import app  # noqa: PLC0415 — lazy: main imports this module's package

    out: list[dict[str, Any]] = []
    for r in app.routes:
        path = getattr(r, "path", None)
        if not path or _NOISE.match(path):
            continue
        methods = sorted((getattr(r, "methods", None) or set()) - {"HEAD", "OPTIONS"})
        if not methods:
            continue
        out.append(
            {
                "path": path,
                "methods": methods,
                "name": getattr(r, "name", None),
                "summary": (getattr(r, "summary", None) or "").strip() or None,
                "tags": list(getattr(r, "tags", None) or []),
                "group": _group_of(path),
            }
        )
    return out


def _collect_tables() -> list[str]:
    try:
        from sqlalchemy import inspect as sa_inspect  # noqa: PLC0415

        from ..database import engine  # noqa: PLC0415

        return sorted(sa_inspect(engine).get_table_names())
    except Exception as exc:  # noqa: BLE001
        logger.warning("[JARVIS] system map: table inspection failed: %s", exc)
        return []


def describe_system(query: str | None = None, detail: bool = False) -> dict[str, Any]:
    """
    Describe the platform, or search it.

    Without ``query``: an overview — every capability group with its endpoint
    count, plus the table inventory. Good for "what can you do?".

    With ``query``: only the endpoints and tables matching that keyword, with
    full paths. Good for "do we have anything for liens?" — the answer names
    real endpoints he can then call or point the operator at.
    """
    try:
        routes = _collect_routes()
    except Exception as exc:  # noqa: BLE001
        logger.warning("[JARVIS] system map: route inspection failed: %s", exc)
        return {
            "status": "unavailable",
            "detail": f"Could not inspect the running app: {type(exc).__name__}",
            "groups": {},
        }

    tables = _collect_tables()

    if query:
        q = query.strip().lower()
        hit_routes = [
            r
            for r in routes
            if q in r["path"].lower()
            or q in (r["name"] or "").lower()
            or q in (r["summary"] or "").lower()
            or any(q in t.lower() for t in r["tags"])
        ]
        hit_tables = [t for t in tables if q in t.lower()]
        return {
            "status": "ok",
            "query": query,
            "matched_endpoints": len(hit_routes),
            "matched_tables": len(hit_tables),
            # Cap so a broad term can't blow up the tool result.
            "endpoints": [
                {"methods": r["methods"], "path": r["path"], "summary": r["summary"]}
                for r in sorted(hit_routes, key=lambda x: x["path"])[:40]
            ],
            "tables": hit_tables[:40],
            "note": (
                "These are live routes on the running app, not a stored description."
                if hit_routes or hit_tables
                else "Nothing in the platform matches that term."
            ),
        }

    groups: dict[str, Any] = {}
    for r in routes:
        g = groups.setdefault(r["group"], {"endpoints": 0, "paths": []})
        g["endpoints"] += 1
        if detail:
            g["paths"].append(f"{','.join(r['methods'])} {r['path']}")

    if not detail:
        for g in groups.values():
            g.pop("paths", None)

    return {
        "status": "ok",
        "summary": (
            f"{len(routes)} endpoints across {len(groups)} capability groups, "
            f"backed by {len(tables)} database tables."
        ),
        "total_endpoints": len(routes),
        "total_groups": len(groups),
        "total_tables": len(tables),
        "groups": dict(sorted(groups.items(), key=lambda kv: -kv[1]["endpoints"])),
        "tables": tables,
        "note": "Introspected from the running application, so this is always current.",
    }
