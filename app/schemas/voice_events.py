"""
Schemas for ambient voice capture ingestion and supervisor review workflows.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class AmbientVoiceIngestRequest(BaseModel):
    """Payload for ambient voice event ingestion."""

    project_id: str = Field(..., min_length=1, max_length=128)
    site_id: str = Field(..., min_length=1, max_length=128)
    zone_id: str | None = Field(default=None, max_length=128)
    trade_id: str | None = Field(default=None, max_length=128)
    speaker_id: str | None = Field(default=None, max_length=128)
    speaker_role: Literal[
        "foreman", "superintendent", "crew", "operator", "unknown"
    ] = "unknown"
    transcript_text: str = Field(..., min_length=3, max_length=10000)
    source: Literal[
        "push_to_talk", "standup", "call_center", "vapi", "twilio", "other"
    ] = "other"
    source_audio_uri: str | None = Field(default=None, max_length=1024)
    captured_at_utc: datetime | None = None


class VoiceReviewQueueItem(BaseModel):
    """Stored queue item for supervisor review."""

    event_id: str
    project_id: str
    site_id: str
    zone_id: str | None = None
    trade_id: str | None = None
    speaker_id: str | None = None
    speaker_role: str = "unknown"
    transcript_text: str
    event_type: Literal["safety", "schedule", "procurement", "quality", "general"] = (
        "general"
    )
    event_confidence: float = Field(..., ge=0.0, le=1.0)
    risk_signal: bool = False
    status: Literal["pending_review", "verified", "dismissed"] = "pending_review"
    reviewed_by: str | None = None
    review_note: str | None = None
    source: str = "other"
    source_audio_uri: str | None = None
    captured_at_utc: datetime
    created_at_utc: datetime


class VoiceReviewVerifyRequest(BaseModel):
    """Supervisor review action request."""

    status: Literal["verified", "dismissed"]
    reviewed_by: str = Field(..., min_length=1, max_length=128)
    review_note: str | None = Field(default=None, max_length=1024)
