"""
Background tasks for ambient voice event extraction.
"""

from __future__ import annotations

from typing import Any

from ..celery_app import celery_app


def classify_voice_transcript(transcript_text: str) -> dict[str, Any]:
    """Simple deterministic classifier used for shadow-mode extraction."""
    text = (transcript_text or "").lower()

    safety_terms = (
        "injury",
        "fall",
        "hard hat",
        "ppe",
        "near miss",
        "crane",
        "hazard",
        "stop work",
    )
    schedule_terms = (
        "delay",
        "late",
        "behind",
        "reschedule",
        "slip",
        "blocked",
        "crew short",
    )
    procurement_terms = (
        "steel",
        "concrete",
        "asphalt",
        "supplier",
        "shipment",
        "material",
    )
    quality_terms = (
        "crack",
        "rework",
        "out of tolerance",
        "defect",
        "failed inspection",
    )

    def _hit(terms: tuple[str, ...]) -> int:
        return sum(1 for t in terms if t in text)

    score_safety = _hit(safety_terms)
    score_schedule = _hit(schedule_terms)
    score_proc = _hit(procurement_terms)
    score_quality = _hit(quality_terms)

    score_map = {
        "safety": score_safety,
        "schedule": score_schedule,
        "procurement": score_proc,
        "quality": score_quality,
    }
    event_type = max(score_map, key=score_map.get)
    top_score = score_map[event_type]

    if top_score <= 0:
        event_type = "general"
        confidence = 0.42
    else:
        confidence = min(0.95, 0.55 + 0.12 * top_score)

    risk_signal = (
        event_type in {"safety", "schedule", "procurement"} and confidence >= 0.65
    )

    return {
        "event_type": event_type,
        "event_confidence": round(confidence, 3),
        "risk_signal": risk_signal,
    }


@celery_app.task(name="app.tasks.voice_events.extract_ambient_voice_event")
def extract_ambient_voice_event(payload: dict[str, Any]) -> dict[str, Any]:
    """Extract event metadata from transcript payload for review workflows."""
    transcript = str(payload.get("transcript_text") or "")
    extraction = classify_voice_transcript(transcript)
    return {
        "event_id": payload.get("event_id"),
        "project_id": payload.get("project_id"),
        **extraction,
    }
