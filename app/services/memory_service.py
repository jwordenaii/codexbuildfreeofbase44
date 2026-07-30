"""
memory_service.py — JARVIS's long-term memory.

THE RULE THIS MODULE ENFORCES
-----------------------------
Memory holds *judgment*, never business facts.

Lead counts, invoice balances, job status, schedules and prices live in their
own tables and are read through tools on every question. If they were also
cached here, a memory written in April would be recited as fact in August —
a stale second source of truth is worse than having no memory at all.

What belongs here is everything true across conversations and written down
nowhere else: the operator's preferences and standing orders, how a particular
GC actually behaves when it comes time to pay, which supplier burned him, why
he priced a job the way he did.

`remember()` rejects content that looks like a volatile business fact rather
than trusting the caller to observe the rule.

Retrieval is Postgres tags + text match, scored by importance, provenance and
recency. No vector database: at this size it would be a dependency without a
payoff, and the schema leaves room to add embeddings later.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

_VALID_KINDS = {
    "preference",
    "standing_order",
    "person",
    "company",
    "equipment",
    "crew",
    "decision",
    "context",
}
_VALID_SOURCES = {"stated", "observed", "inferred"}

# Provenance weighting: something the operator said outranks something Jarvis
# worked out for himself.
_SOURCE_WEIGHT = {"stated": 1.0, "observed": 0.8, "inferred": 0.55}

# Content that looks like a volatile business fact. These belong in their own
# tables and must be read live, so remembering them is refused outright.
_VOLATILE = re.compile(
    r"\b("
    r"we (?:currently )?have \d+ (?:leads?|jobs?|customers?)"
    r"|balance (?:is|of) \$[\d,]+"
    r"|invoice #?\d+"
    r"|owes? (?:us )?\$[\d,]+"
    r"|\d+ leads? (?:in|are) (?:the )?pipeline"
    r"|revenue (?:is|was) \$[\d,]+"
    r")\b",
    re.I,
)

_STOP = {
    "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "be",
    "to", "of", "in", "on", "for", "with", "that", "this", "it", "we", "i",
    "he", "she", "they", "at", "by", "from", "as", "his", "her", "our",
}


def _tokens(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]+", (text or "").lower()) if len(w) > 2 and w not in _STOP}


def remember(
    content: str,
    kind: str = "context",
    subject: str | None = None,
    tags: str | None = None,
    source: str = "stated",
    importance: int = 5,
    supersedes: int | None = None,
) -> dict[str, Any]:
    """
    Store something worth knowing next week.

    Refuses volatile business facts — those are read from their own tables.
    Pass ``supersedes`` to correct an earlier memory; the old row is retired
    rather than deleted, so a correction leaves a trail.
    """
    text = (content or "").strip()
    if not text:
        return {"status": "error", "detail": "Nothing to remember."}
    if len(text) > 2000:
        return {"status": "error", "detail": "Memory too long; summarise it to the durable point."}

    if _VOLATILE.search(text):
        return {
            "status": "refused",
            "detail": (
                "That reads like a live business fact (counts, balances, invoices). "
                "Those are read from their own tables on every question so they cannot go "
                "stale — remembering them would create a second, ageing source of truth. "
                "Store the judgement instead, e.g. 'KBP pays slow, usually 50-60 days'."
            ),
        }

    k = kind if kind in _VALID_KINDS else "context"
    src = source if source in _VALID_SOURCES else "stated"
    imp = max(1, min(10, int(importance or 5)))

    try:
        from ..database import SessionLocal  # noqa: PLC0415
        from ..models import AgentMemory  # noqa: PLC0415

        db = SessionLocal()
        try:
            row = AgentMemory(
                kind=k,
                subject=(subject or None),
                content=text,
                tags=(tags or "").strip().lower() or None,
                source=src,
                confidence=_SOURCE_WEIGHT.get(src, 0.8),
                importance=imp,
            )
            db.add(row)
            db.flush()

            retired = None
            if supersedes:
                old = db.query(AgentMemory).filter(AgentMemory.id == int(supersedes)).first()
                if old:
                    old.active = 0
                    old.superseded_by = row.id
                    retired = old.id

            db.commit()
            db.refresh(row)
            return {
                "status": "ok",
                "id": row.id,
                "stored": text,
                "kind": k,
                "subject": subject,
                "superseded": retired,
                "detail": "Noted." + (f" Replaces memory #{retired}." if retired else ""),
            }
        finally:
            db.close()
    except Exception as exc:  # noqa: BLE001
        logger.warning("remember failed: %s", exc)
        return {"status": "error", "detail": f"Could not store memory: {type(exc).__name__}"}


def recall(
    query: str | None = None,
    subject: str | None = None,
    kind: str | None = None,
    limit: int = 12,
) -> dict[str, Any]:
    """
    Retrieve relevant memories, most useful first.

    Scoring blends term overlap, importance, provenance and recency, so a thing
    the operator stated last week outranks something inferred months ago.
    """
    try:
        from ..database import SessionLocal  # noqa: PLC0415
        from ..models import AgentMemory  # noqa: PLC0415

        db = SessionLocal()
        try:
            q = db.query(AgentMemory).filter(AgentMemory.active == 1)
            if subject:
                q = q.filter(AgentMemory.subject.ilike(f"%{subject}%"))
            if kind and kind in _VALID_KINDS:
                q = q.filter(AgentMemory.kind == kind)
            rows = q.order_by(AgentMemory.updated_at.desc()).limit(400).all()

            terms = _tokens(query) if query else set()
            now = datetime.now(timezone.utc)

            scored = []
            for r in rows:
                score = float(r.importance) * 1.5
                score *= _SOURCE_WEIGHT.get(r.source, 0.8)
                if terms:
                    hay = _tokens(f"{r.content} {r.tags or ''} {r.subject or ''}")
                    overlap = len(terms & hay)
                    if overlap == 0 and not subject and not kind:
                        continue  # asked something specific; this isn't about it
                    score += overlap * 6
                # Gentle recency nudge — old standing orders still matter.
                age_days = max(0.0, (now - r.updated_at.replace(tzinfo=timezone.utc)).days) if r.updated_at else 0
                score += max(0.0, 8.0 - age_days / 30.0)
                scored.append((score, r))

            scored.sort(key=lambda t: t[0], reverse=True)
            top = [r for _, r in scored[: max(1, min(50, limit))]]

            # Usage stats make it possible to prune dead weight later.
            for r in top:
                r.use_count = (r.use_count or 0) + 1
                r.last_used_at = now
            db.commit()

            return {
                "status": "ok",
                "count": len(top),
                "memories": [
                    {
                        "id": r.id,
                        "kind": r.kind,
                        "subject": r.subject,
                        "content": r.content,
                        "source": r.source,
                        "importance": r.importance,
                        "learned": r.created_at.strftime("%b %d, %Y") if r.created_at else None,
                    }
                    for r in top
                ],
            }
        finally:
            db.close()
    except Exception as exc:  # noqa: BLE001
        logger.warning("recall failed: %s", exc)
        return {"status": "error", "detail": f"Could not read memory: {type(exc).__name__}", "memories": []}


def forget(memory_id: int) -> dict[str, Any]:
    """Retire a memory. Kept as an inactive row rather than deleted, so a wrong
    correction can still be traced."""
    try:
        from ..database import SessionLocal  # noqa: PLC0415
        from ..models import AgentMemory  # noqa: PLC0415

        db = SessionLocal()
        try:
            row = db.query(AgentMemory).filter(AgentMemory.id == int(memory_id)).first()
            if not row:
                return {"status": "error", "detail": f"No memory #{memory_id}."}
            row.active = 0
            db.commit()
            return {"status": "ok", "id": row.id, "detail": f"Forgotten: {row.content[:80]}"}
        finally:
            db.close()
    except Exception as exc:  # noqa: BLE001
        logger.warning("forget failed: %s", exc)
        return {"status": "error", "detail": f"Could not forget: {type(exc).__name__}"}


def briefing(limit: int = 14) -> str:
    """
    A compact block of the most load-bearing memories, for injection into the
    system prompt at the start of a conversation.

    Memory that requires an explicit tool call is barely memory — he should
    walk in already knowing the standing orders and strong preferences, and use
    the recall tool only for specifics.
    """
    try:
        res = recall(limit=limit)
        rows = res.get("memories") or []
        if not rows:
            return ""
        # Standing orders first: they are instructions, not trivia.
        order = {"standing_order": 0, "preference": 1, "company": 2, "person": 3}
        rows.sort(key=lambda m: (order.get(m["kind"], 4), -m["importance"]))
        lines = [
            f"- [{m['kind']}{'/' + m['subject'] if m['subject'] else ''}] {m['content']}"
            + (f" (you told me {m['learned']})" if m["source"] == "stated" and m["learned"] else "")
            for m in rows
        ]
        return (
            "\n\nWHAT YOU ALREADY KNOW (long-term memory — these persist across "
            "conversations; treat them as context, not as live business data, and say "
            "when you are relying on one):\n" + "\n".join(lines)
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("memory briefing failed: %s", exc)
        return ""
