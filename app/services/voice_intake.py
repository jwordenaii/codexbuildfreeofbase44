"""
voice_intake.py — Voice/phone AI intake service for JWordenAI.

Transcribes audio using OpenAI Whisper, extracts lead entities with GPT-4o,
and creates lead records from phone call recordings.

Supports:
  - Direct audio file transcription
  - Twilio recording callback processing
  - Entity extraction (name, address, service, urgency)

Public API
──────────
  transcribe_audio(audio_bytes, content_type) → str
  extract_lead_entities(transcript) → dict
  create_lead_from_transcript(transcript, db) → dict
"""

from __future__ import annotations

import io
import json
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

_OPENAI_KEY = os.getenv("OPENAI_API_KEY", "")


def transcribe_audio(audio_bytes: bytes, content_type: str) -> str:
    """
    Transcribe audio using OpenAI Whisper API.
    Falls back to a stub message if OpenAI is unavailable.
    """
    if not _OPENAI_KEY:
        return "[Transcription unavailable — configure OPENAI_API_KEY]"

    try:
        from openai import OpenAI  # type: ignore

        client = OpenAI(api_key=_OPENAI_KEY)

        # Map content type to file extension
        ext_map = {
            "audio/mpeg": "mp3",
            "audio/mp3": "mp3",
            "audio/wav": "wav",
            "audio/x-wav": "wav",
            "audio/mp4": "mp4",
            "audio/m4a": "m4a",
            "audio/ogg": "ogg",
            "audio/webm": "webm",
        }
        ext = ext_map.get(content_type, "mp3")

        # OpenAI requires a file-like object with a name attribute
        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = f"recording.{ext}"

        response = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            language="en",
        )
        return response.text or ""
    except Exception as exc:  # noqa: BLE001
        logger.error("Whisper transcription error: %s", exc)
        return "[Transcription failed. Please try again or contact us directly.]"


def extract_lead_entities(transcript: str) -> dict:
    """
    Use GPT-4o to extract lead entities from a phone call transcript.

    Returns:
      {name, phone, email, address, service_type, urgency, message, confidence}
    """
    if not _OPENAI_KEY:
        return _stub_entities()

    try:
        from openai import OpenAI  # type: ignore

        client = OpenAI(api_key=_OPENAI_KEY)
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a lead data extraction assistant for an asphalt paving company. "
                        "Extract the following from this phone call transcript and return as JSON: "
                        "name (customer full name or 'Unknown'), "
                        "phone (phone number or null), "
                        "email (email or null), "
                        "address (project address or null), "
                        "service_type (one of: paving, sealcoating, crackfill, parking_lot, driveway, or 'unknown'), "
                        "property_type (residential or commercial, default residential), "
                        "urgency (asap, within_1_week, within_1_month, or flexible), "
                        "project_size_sqft (number or null), "
                        "message (brief summary of what they want), "
                        "confidence (0.0-1.0 how confident you are in the extraction). "
                        "Return only valid JSON."
                    ),
                },
                {"role": "user", "content": f"Transcript:\n{transcript}"},
            ],
            max_tokens=400,
            temperature=0.2,
        )
        text = response.choices[0].message.content or "{}"
        if "```" in text:
            text = text.split("```")[1].lstrip("json").strip()
        return json.loads(text)
    except Exception as exc:  # noqa: BLE001
        logger.error("Entity extraction error: %s", exc)
        return _stub_entities()


def create_lead_from_transcript(transcript: str, db=None) -> dict:
    """
    Extract entities from a transcript and create a Lead record.
    Returns the created lead data or error dict.
    """
    entities = extract_lead_entities(transcript)

    if not db:
        return {"error": "No database session provided", "entities": entities}

    try:
        from ..models import Lead  # noqa: PLC0415
        from ..services.lead_scorer import score_lead  # noqa: PLC0415
        from ..services.notifications import send_lead_notification  # noqa: PLC0415

        # Build a complete lead dict for scoring
        lead_data = {
            "name": entities.get("name", "Phone Caller"),
            "email": entities.get("email") or "noemail@voicecall.internal",
            "phone": entities.get("phone") or "unknown",
            "service_type": entities.get("service_type", "paving"),
            "property_type": entities.get("property_type", "residential"),
            "urgency": entities.get("urgency", "flexible"),
            "project_size_sqft": entities.get("project_size_sqft"),
            "address": entities.get("address"),
            "message": f"[VOICE LEAD] {entities.get('message', transcript[:500])}",
        }

        scoring = score_lead(lead_data)
        db_lead = Lead(
            name=lead_data["name"],
            email=lead_data["email"],
            phone=lead_data["phone"],
            service_type=lead_data["service_type"],
            property_type=lead_data["property_type"],
            urgency=lead_data["urgency"],
            project_size_sqft=lead_data.get("project_size_sqft"),
            address=lead_data.get("address"),
            message=lead_data["message"],
            score_value=scoring["score"],
            score_label=scoring["label"],
            score_priority=scoring["priority"],
        )
        db.add(db_lead)
        db.commit()
        db.refresh(db_lead)

        # Fire notification
        send_lead_notification({**lead_data, "db_id": db_lead.id, "score": scoring})

        return {
            "status": "created",
            "lead_id": db_lead.id,
            "score_label": scoring["label"],
            "entities": entities,
            "transcript_preview": transcript[:200],
        }
    except Exception as exc:  # noqa: BLE001
        logger.error("create_lead_from_transcript error: %s", exc)
        return {"error": "Lead creation failed.", "entities": entities}


def _stub_entities() -> dict:
    return {
        "name": "Unknown",
        "phone": None,
        "email": None,
        "address": None,
        "service_type": "unknown",
        "property_type": "residential",
        "urgency": "flexible",
        "project_size_sqft": None,
        "message": "Voice lead — manual review required",
        "confidence": 0.0,
    }
