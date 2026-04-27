"""
corrections_engine.py — Human-review learning loop for JWordenAI.

When a human reviewer corrects an AI decision, the correction is stored in
the AICorrection table.  Before generating new responses, the AI engine
fetches relevant corrections as few-shot examples to guide the model.

Public API
──────────
  get_corrections(decision_type, question, limit=5) → list[dict]
  save_correction(decision_type, input_summary, corrected_answer, reviewer_notes=None) → None
  increment_usage(correction_id) → None
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# Max characters stored for the input pattern in AICorrection records
MAX_INPUT_PATTERN_LENGTH = 2000


def get_corrections(
    decision_type: str,
    question: str,
    limit: int = 5,
    db=None,
) -> list[dict]:
    """
    Return up to *limit* corrections for *decision_type* that are semantically
    relevant to *question*.  Falls back to most-used corrections if no DB.
    """
    if db is None:
        return []
    try:
        from ..models import AICorrection  # noqa: PLC0415

        q = (
            db.query(AICorrection)
            .filter(AICorrection.decision_type == decision_type)
            .order_by(AICorrection.usage_count.desc())
            .limit(limit * 2)
            .all()
        )

        # Simple keyword relevance filter
        question_words = set(question.lower().split())
        scored = []
        for c in q:
            pattern_words = set(c.input_pattern.lower().split())
            overlap = len(question_words & pattern_words)
            scored.append((overlap, c))

        scored.sort(key=lambda x: x[0], reverse=True)
        top = [c for _, c in scored[:limit]]

        return [
            {
                "id": c.id,
                "input_pattern": c.input_pattern,
                "corrected_answer": c.corrected_answer,
                "reviewer_notes": c.reviewer_notes,
                "usage_count": c.usage_count,
            }
            for c in top
        ]
    except Exception as exc:  # noqa: BLE001
        logger.error("get_corrections error: %s", exc)
        return []


def save_correction(
    decision_type: str,
    input_summary: str,
    corrected_answer: str,
    reviewer_notes: Optional[str] = None,
    db=None,
) -> None:
    """Persist a new correction to the database."""
    if db is None:
        return
    try:
        from ..models import AICorrection  # noqa: PLC0415

        correction = AICorrection(
            decision_type=decision_type,
            input_pattern=input_summary[:MAX_INPUT_PATTERN_LENGTH],
            corrected_answer=corrected_answer,
            reviewer_notes=reviewer_notes,
            usage_count=0,
        )
        db.add(correction)
        db.commit()
        logger.info("Saved correction for decision_type=%s", decision_type)
    except Exception as exc:  # noqa: BLE001
        logger.error("save_correction error: %s", exc)


def increment_usage(correction_id: int, db=None) -> None:
    """Increment the usage counter for a correction record."""
    if db is None:
        return
    try:
        from ..models import AICorrection  # noqa: PLC0415

        obj = db.get(AICorrection, correction_id)
        if obj:
            obj.usage_count += 1
            obj.updated_at = datetime.now(timezone.utc)
            db.commit()
    except Exception as exc:  # noqa: BLE001
        logger.error("increment_usage error: %s", exc)
