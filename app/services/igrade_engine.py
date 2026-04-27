"""
igrade_engine.py — Graded AI Processing Engine for JWordenAI.

Architecture
────────────
Every AI request is graded A–D before routing to the appropriate model tier,
giving Mr. Worden's platform maximum speed without sacrificing quality:

  Grade A — Complex / premium
    • Legal, compliance, multi-state, QSR franchise, liability analysis
    • Routed to: GPT-4o (full reasoning)
    • Target confidence: ≥ 0.85

  Grade B — Standard
    • Paving estimates, technical specs, ADA questions
    • Routed to: GPT-4o-mini
    • Target confidence: ≥ 0.75

  Grade C — Simple / fast
    • Basic info lookups, quick pricing ballparks, single-sentence answers
    • Routed to: GPT-4o-mini with reduced max_tokens
    • Target confidence: ≥ 0.65

  Grade D — Bulk / cached
    • Repeat queries, batch lead scoring, rule-engine-only decisions
    • Routed to: deterministic rule engine or LRU cache
    • Target confidence: ≥ 0.55

Self-Correction Sweep
─────────────────────
run_self_correction_sweep() reads the GradeLog and AICorrection tables to:
  1. Identify decision types with high correction rates (was_corrected / total).
  2. Generate a plain-English improvement report listing the top patterns.
  3. Returns a list of SelfCorrectionSuggestion dicts for the iGrade dashboard.

The sweep does NOT automatically rewrite the knowledge base — it surfaces
findings so Mr. Worden can approve before any changes are committed.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

# ── Grade-trigger keyword sets ────────────────────────────────────────────────

_GRADE_A_KEYWORDS = {
    # Legal / compliance
    "lien", "license", "permit", "osha", "prevailing wage", "bond",
    "insurance", "compliance", "dot", "regulation", "statute", "code",
    # High-complexity project types
    "qsr", "franchise", "kfc", "arby", "taco bell", "multi-state", "federal",
    "liability", "contract", "lawyer", "attorney", "sue", "lawsuit",
    # Premium analysis requests
    "analyze", "analysis", "assess", "recommend strategy", "bid strategy",
}

_GRADE_B_KEYWORDS = {
    # Standard paving Q&A
    "asphalt", "paving", "sealcoat", "sealcoating", "crack filling", "overlay",
    "base", "hma", "hot mix", "compaction", "drainage", "ada", "accessible",
    # Pricing / estimates
    "cost", "price", "estimate", "quote", "sqft", "sq ft", "per foot",
    "how much", "budget", "rate",
    # Technical specs
    "install", "thickness", "inches", "temperature", "laydown", "density",
}

_GRADE_C_KEYWORDS = {
    "hours", "open", "phone", "contact", "address", "location", "where",
    "hello", "hi", "hey", "what do you do", "services", "about", "who",
    "parking lot", "driveway", "patio", "masonry", "stone",
}

_GRADE_D_DECISION_TYPES = {"lead_score", "batch", "bulk"}


@dataclass
class GradeResult:
    """Output of grade_request()."""
    grade: str                           # A | B | C | D
    recommended_model: str               # gpt-4o | gpt-4o-mini | rule_engine
    max_tokens: int
    temperature: float
    rationale: str
    correction_hint: Optional[str] = None   # few-shot hint from past corrections


def grade_request(
    decision_type: str,
    question: str,
    db=None,
) -> GradeResult:
    """
    Grade an AI request and return routing instructions.

    Parameters
    ----------
    decision_type : str
        'chat' | 'compliance' | 'lead_score' | 'takeoff' | …
    question : str
        The user's raw question or input summary.
    db : SQLAlchemy Session, optional
        If provided, recent corrections for this decision_type are checked
        to inject a few-shot correction hint.

    Returns
    -------
    GradeResult with grade letter, model recommendation, and token budget.
    """
    q_lower = (question or "").lower()
    q_words = set(q_lower.split())
    dtype = (decision_type or "").lower()

    # ── Grade D: bulk/batch decision types ───────────────────────────────────
    if dtype in _GRADE_D_DECISION_TYPES:
        return GradeResult(
            grade="D",
            recommended_model="rule_engine",
            max_tokens=100,
            temperature=0.0,
            rationale="Bulk/batch decision type → deterministic rule engine.",
        )

    # ── Grade A: legal, compliance, or high-complexity ───────────────────────
    a_match = bool(q_words & _GRADE_A_KEYWORDS) or dtype in ("compliance", "legal")
    # Multi-sentence / long questions also grade A
    a_match = a_match or len(question or "") > 300

    if a_match:
        hint = _fetch_correction_hint(decision_type, question, db)
        return GradeResult(
            grade="A",
            recommended_model="gpt-4o",
            max_tokens=450,
            temperature=0.4,
            rationale="Legal/compliance/complex question → premium GPT-4o processing.",
            correction_hint=hint,
        )

    # ── Grade B: standard paving & technical Q&A ─────────────────────────────
    b_match = bool(q_words & _GRADE_B_KEYWORDS)
    if b_match:
        hint = _fetch_correction_hint(decision_type, question, db)
        return GradeResult(
            grade="B",
            recommended_model="gpt-4o-mini",
            max_tokens=350,
            temperature=0.5,
            rationale="Standard paving/technical question → GPT-4o-mini.",
            correction_hint=hint,
        )

    # ── Grade C: simple / fast lookup ────────────────────────────────────────
    c_match = bool(q_words & _GRADE_C_KEYWORDS)
    if c_match or len(question or "") < 60:
        return GradeResult(
            grade="C",
            recommended_model="gpt-4o-mini",
            max_tokens=200,
            temperature=0.6,
            rationale="Simple/short question → fast GPT-4o-mini response.",
        )

    # ── Default: Grade B ─────────────────────────────────────────────────────
    return GradeResult(
        grade="B",
        recommended_model="gpt-4o-mini",
        max_tokens=350,
        temperature=0.5,
        rationale="Default grade — standard processing.",
    )


def record_grade(
    decision_type: str,
    grade: str,
    input_summary: str,
    ai_engine: str,
    confidence: float,
    processing_ms: Optional[int] = None,
    was_corrected: bool = False,
    correction_applied: bool = False,
    tenant_id: str = "default",
    db=None,
) -> Optional[int]:
    """
    Persist a GradeLog record.  Returns the new record's id, or None on error.
    """
    if db is None:
        return None
    try:
        from ..models import GradeLog  # noqa: PLC0415

        entry = GradeLog(
            decision_type=decision_type,
            grade=grade,
            input_summary=input_summary[:500],
            ai_engine=ai_engine,
            confidence=confidence,
            processing_ms=processing_ms,
            was_corrected=int(was_corrected),
            correction_applied=int(correction_applied),
            tenant_id=tenant_id,
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return entry.id
    except Exception as exc:  # noqa: BLE001
        logger.error("record_grade error: %s", exc)
        return None


def get_grade_stats(db=None) -> dict:
    """
    Return grade distribution, avg confidence per grade, and correction rates.
    Safe to call without a DB — returns empty structure.
    """
    if db is None:
        return _empty_stats()

    try:
        from ..models import GradeLog  # noqa: PLC0415

        rows = db.query(GradeLog).all()
        total = len(rows)
        if total == 0:
            return _empty_stats()

        by_grade: dict[str, dict] = {
            g: {"count": 0, "confidence_sum": 0.0, "corrected": 0, "avg_ms": 0.0, "ms_sum": 0, "ms_count": 0}
            for g in ("A", "B", "C", "D")
        }

        for r in rows:
            g = r.grade if r.grade in by_grade else "B"
            by_grade[g]["count"] += 1
            by_grade[g]["confidence_sum"] += r.confidence or 0.0
            by_grade[g]["corrected"] += r.was_corrected or 0
            if r.processing_ms:
                by_grade[g]["ms_sum"] += r.processing_ms
                by_grade[g]["ms_count"] += 1

        grade_breakdown = {}
        for g, d in by_grade.items():
            cnt = d["count"]
            grade_breakdown[g] = {
                "count": cnt,
                "pct": round(cnt / total * 100, 1) if total else 0.0,
                "avg_confidence": round(d["confidence_sum"] / cnt, 3) if cnt else 0.0,
                "correction_rate": round(d["corrected"] / cnt * 100, 1) if cnt else 0.0,
                "avg_processing_ms": round(d["ms_sum"] / d["ms_count"]) if d["ms_count"] else None,
            }

        overall_avg_conf = round(sum(r.confidence or 0.0 for r in rows) / total, 3)
        total_corrected  = sum(r.was_corrected or 0 for r in rows)
        auto_corrected   = sum(r.correction_applied or 0 for r in rows)

        return {
            "total_decisions": total,
            "overall_avg_confidence": overall_avg_conf,
            "total_corrections": total_corrected,
            "auto_corrections_applied": auto_corrected,
            "overall_correction_rate_pct": round(total_corrected / total * 100, 1) if total else 0.0,
            "grade_breakdown": grade_breakdown,
        }
    except Exception as exc:  # noqa: BLE001
        logger.error("get_grade_stats error: %s", exc)
        return _empty_stats()


def run_self_correction_sweep(db=None) -> dict:
    """
    Analyze GradeLog + AICorrection tables to identify patterns and suggest
    knowledge improvements.

    Returns
    -------
    {
        "swept_corrections": int,
        "patterns_found": int,
        "suggestions": [{"decision_type", "pattern", "frequency", "recommendation"}],
        "summary": str,
    }
    """
    if db is None:
        return {"swept_corrections": 0, "patterns_found": 0, "suggestions": [], "summary": "No database available."}

    try:
        from ..models import AICorrection, GradeLog  # noqa: PLC0415

        corrections = (
            db.query(AICorrection)
            .order_by(AICorrection.usage_count.desc())
            .limit(200)
            .all()
        )

        # Count word frequencies per decision_type
        type_word_freq: dict[str, dict[str, int]] = {}
        for c in corrections:
            dtype = c.decision_type
            if dtype not in type_word_freq:
                type_word_freq[dtype] = {}
            words = c.input_pattern.lower().split()
            for w in words:
                if len(w) > 3:  # skip very short words (articles, prepositions)
                    type_word_freq[dtype][w] = type_word_freq[dtype].get(w, 0) + 1

        suggestions = []
        for dtype, freq_map in type_word_freq.items():
            # Top 3 most-repeated words per decision type
            top_words = sorted(freq_map.items(), key=lambda x: x[1], reverse=True)[:3]
            for word, freq in top_words:
                if freq >= 2:
                    suggestions.append({
                        "decision_type": dtype,
                        "pattern": word,
                        "frequency": freq,
                        "recommendation": (
                            f"'{word}' appears {freq}× in corrected {dtype} queries. "
                            f"Consider adding targeted examples for this keyword to the "
                            f"knowledge base or system prompt to reduce future corrections."
                        ),
                    })

        # Also check high-correction-rate grades from GradeLog and mark them as
        # having had a correction applied in this sweep (single bulk update).
        db.query(GradeLog).filter(
            GradeLog.was_corrected == 1,
            GradeLog.correction_applied == 0,
        ).update({"correction_applied": 1}, synchronize_session=False)
        db.commit()

        summary_parts = [f"Sweep complete. Analyzed {len(corrections)} correction records."]
        if suggestions:
            summary_parts.append(
                f"Found {len(suggestions)} improvement patterns. "
                "Review suggestions in the iGrade panel and approve changes to the knowledge base."
            )
        else:
            summary_parts.append("No high-frequency correction patterns detected — AI is performing well.")

        return {
            "swept_corrections": len(corrections),
            "patterns_found": len(suggestions),
            "suggestions": suggestions[:20],  # cap at 20 for UI
            "summary": " ".join(summary_parts),
        }
    except Exception as exc:  # noqa: BLE001
        logger.error("run_self_correction_sweep error: %s", exc)
        return {
            "swept_corrections": 0,
            "patterns_found": 0,
            "suggestions": [],
            "summary": f"Sweep failed: {exc}",
        }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _empty_stats() -> dict:
    return {
        "total_decisions": 0,
        "overall_avg_confidence": 0.0,
        "total_corrections": 0,
        "auto_corrections_applied": 0,
        "overall_correction_rate_pct": 0.0,
        "grade_breakdown": {
            g: {"count": 0, "pct": 0.0, "avg_confidence": 0.0, "correction_rate": 0.0, "avg_processing_ms": None}
            for g in ("A", "B", "C", "D")
        },
    }


def _fetch_correction_hint(decision_type: str, question: str, db) -> Optional[str]:
    """Return a brief correction hint string for few-shot injection, or None."""
    if db is None:
        return None
    try:
        from ..services.corrections_engine import get_corrections  # noqa: PLC0415

        corrections = get_corrections(decision_type, question, limit=1, db=db)
        if corrections:
            c = corrections[0]
            return f"[Past correction example] Input: {c['input_pattern'][:120]} → Answer: {c['corrected_answer'][:120]}"
    except Exception:  # noqa: BLE001
        pass
    return None


class GradeTimer:
    """Context manager that measures wall-clock time and returns milliseconds."""

    def __init__(self):
        self._start: float = 0.0
        self.elapsed_ms: int = 0

    def __enter__(self):
        self._start = time.perf_counter()
        return self

    def __exit__(self, *_):
        self.elapsed_ms = int((time.perf_counter() - self._start) * 1000)
