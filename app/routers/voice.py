"""
voice.py — Voice/phone AI intake endpoints for JWordenAI.

Routes:
  POST /api/v1/voice/transcribe                   — transcribe audio + extract lead
  POST /api/v1/voice/twilio-webhook               — Twilio TwiML call handler
  POST /api/v1/voice/twilio-recording-callback    — process completed Twilio recording

Premium security required on /transcribe; Twilio webhooks are open.
"""

import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..core.limiter import limiter
from ..core.security import verify_premium_security
from ..database import get_db
from ..models import VoiceReviewEvent
from ..schemas.voice_events import (
    AmbientVoiceIngestRequest,
    VoiceReviewVerifyRequest,
)
from ..services.voice_intake import (
    create_lead_from_transcript,
    extract_lead_entities,
    transcribe_audio,
)

try:
    from ..tasks.voice_events import extract_ambient_voice_event
except Exception:  # noqa: BLE001
    extract_ambient_voice_event = None

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/voice", tags=["voice"])

_ALLOWED_AUDIO_TYPES = {
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/mp4",
    "audio/m4a",
    "audio/ogg",
    "audio/webm",
}


def _event_to_dict(event: VoiceReviewEvent) -> dict[str, Any]:
    return {
        "event_id": event.event_id,
        "project_id": event.project_id,
        "site_id": event.site_id,
        "zone_id": event.zone_id,
        "trade_id": event.trade_id,
        "speaker_id": event.speaker_id,
        "speaker_role": event.speaker_role,
        "transcript_text": event.transcript_text,
        "event_type": event.event_type,
        "event_confidence": float(event.event_confidence),
        "risk_signal": bool(event.risk_signal),
        "status": event.status,
        "reviewed_by": event.reviewed_by,
        "review_note": event.review_note,
        "reviewed_at_utc": (
            event.reviewed_at_utc.isoformat() if event.reviewed_at_utc else None
        ),
        "source": event.source,
        "source_audio_uri": event.source_audio_uri,
        "captured_at_utc": event.captured_at_utc.isoformat(),
        "created_at_utc": event.created_at_utc.isoformat(),
    }


@router.post("/transcribe", summary="Transcribe audio and extract lead information")
@limiter.limit("10/minute")
async def transcribe_upload(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """
    Upload an audio file (mp3/wav/m4a). Returns transcript and extracted lead entities.
    Optionally creates a lead record if entity extraction is confident enough.
    """
    if file.content_type not in _ALLOWED_AUDIO_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported audio type. Allowed: {', '.join(sorted(_ALLOWED_AUDIO_TYPES))}",
        )

    audio_bytes = await file.read()
    if len(audio_bytes) > 25 * 1024 * 1024:  # 25 MB Whisper limit
        raise HTTPException(status_code=413, detail="Audio file exceeds 25 MB limit")

    transcript = transcribe_audio(audio_bytes, file.content_type)
    entities = extract_lead_entities(transcript)

    result = {
        "transcript": transcript,
        "entities": entities,
        "lead_created": False,
    }

    # Auto-create lead if confidence is high enough
    if (
        entities.get("confidence", 0) >= 0.6
        and entities.get("name", "Unknown") != "Unknown"
    ):
        lead_result = create_lead_from_transcript(transcript, db=db)
        if "lead_id" in lead_result:
            result["lead_created"] = True
            result["lead_id"] = lead_result["lead_id"]
            result["lead_score"] = lead_result.get("score_label")

    return result


@router.post("/twilio-webhook", summary="Twilio TwiML webhook for incoming calls")
async def twilio_webhook(request: Request):
    """
    Handle incoming Twilio calls. Returns TwiML to greet the caller and record.
    No authentication — Twilio validates via its own webhook signature mechanism.
    """
    twiml = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">
    Thank you for calling J. Worden and Sons Asphalt Paving.
    Please describe your paving project after the beep, and we will follow up within 24 hours.
    Press any key when finished.
  </Say>
  <Record
    action="/api/v1/voice/twilio-recording-callback"
    method="POST"
    maxLength="120"
    finishOnKey="any"
    transcribe="false"
    playBeep="true"
  />
  <Say voice="alice">
    Thank you. We will review your message and contact you shortly.
    For immediate assistance, please call us directly at 804-446-1296.
    Goodbye.
  </Say>
</Response>"""
    return Response(content=twiml, media_type="application/xml")


@router.post(
    "/twilio-recording-callback", summary="Process a completed Twilio recording"
)
async def twilio_recording_callback(
    request: Request,
    RecordingUrl: str = Form(default=""),
    RecordingSid: str = Form(default=""),
    CallSid: str = Form(default=""),
    db: Session = Depends(get_db),
):
    """
    Receive a completed Twilio recording URL, download the audio,
    transcribe it, extract entities, and create a lead record.
    No authentication — called by Twilio servers.
    """
    # SSRF protection: only accept requests with a valid RecordingSid.
    # We construct the download URL ourselves from the known-safe RecordingSid,
    # never using the user-provided RecordingUrl as a fetch target.
    _RECORDING_SID_RE = re.compile(r"^RE[0-9a-f]{32}$", re.IGNORECASE)
    if not RecordingSid or not _RECORDING_SID_RE.match(RecordingSid):
        logger.warning("Twilio callback received with invalid or missing RecordingSid")
        return {"status": "ignored", "reason": "invalid recording identifier"}

    try:
        import httpx  # noqa: PLC0415

        auth_sid = os.getenv("TWILIO_ACCOUNT_SID", "")
        auth_token = os.getenv("TWILIO_AUTH_TOKEN", "")
        if not auth_sid:
            logger.warning("Twilio credentials not configured — cannot fetch recording")
            return {"status": "error", "detail": "Twilio credentials not configured."}

        # Construct a safe URL entirely from server-controlled values
        safe_url = (
            f"https://api.twilio.com/2010-04-01/Accounts/{auth_sid}"
            f"/Recordings/{RecordingSid}.mp3"
        )

        resp = httpx.get(
            safe_url,
            auth=(auth_sid, auth_token),
            timeout=30.0,
            follow_redirects=False,
        )
        resp.raise_for_status()

        transcript = transcribe_audio(resp.content, "audio/mpeg")
        lead_result = create_lead_from_transcript(transcript, db=db)

        logger.info(
            "Twilio recording processed: call=%s recording=%s lead=%s",
            CallSid,
            RecordingSid,
            lead_result.get("lead_id"),
        )
        return {
            "status": "processed",
            "lead_id": lead_result.get("lead_id"),
            "score_label": lead_result.get("score_label"),
            "transcript_length": len(transcript),
        }

    except Exception as exc:  # noqa: BLE001
        logger.error("Twilio recording callback error: %s", exc)
        return {"status": "error", "detail": "Processing failed. Please try again."}


@router.post(
    "/ambient-ingest", summary="Ingest ambient voice transcript for shadow extraction"
)
@limiter.limit("30/minute")
async def ambient_ingest(
    request: Request,
    payload: AmbientVoiceIngestRequest,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """Ingest structured ambient voice transcript and enqueue for supervisor review."""
    now = datetime.now(timezone.utc)
    event_id = f"voice_evt_{uuid.uuid4().hex[:14]}"

    extraction: dict[str, Any] = {
        "event_type": "general",
        "event_confidence": 0.42,
        "risk_signal": False,
    }

    queued_task_id = None
    if extract_ambient_voice_event is not None:
        try:
            async_result = extract_ambient_voice_event.delay(
                {
                    "event_id": event_id,
                    "project_id": payload.project_id,
                    "transcript_text": payload.transcript_text,
                }
            )
            queued_task_id = async_result.id
        except Exception as exc:  # noqa: BLE001
            logger.warning("Ambient voice task enqueue failed: %s", exc)

    # Fallback deterministic extraction (also keeps queue item useful immediately).
    if extract_ambient_voice_event is not None:
        try:
            extraction = extract_ambient_voice_event.func(
                {
                    "event_id": event_id,
                    "project_id": payload.project_id,
                    "transcript_text": payload.transcript_text,
                }
            )
            extraction = {
                "event_type": extraction.get("event_type", "general"),
                "event_confidence": extraction.get("event_confidence", 0.42),
                "risk_signal": bool(extraction.get("risk_signal", False)),
            }
        except Exception as exc:  # noqa: BLE001
            logger.warning("Ambient voice local extraction fallback failed: %s", exc)

    item = VoiceReviewEvent(
        event_id=event_id,
        project_id=payload.project_id,
        site_id=payload.site_id,
        zone_id=payload.zone_id,
        trade_id=payload.trade_id,
        speaker_id=payload.speaker_id,
        speaker_role=payload.speaker_role,
        transcript_text=payload.transcript_text,
        event_type=extraction["event_type"],
        event_confidence=float(extraction["event_confidence"]),
        risk_signal=bool(extraction["risk_signal"]),
        source=payload.source,
        source_audio_uri=payload.source_audio_uri,
        captured_at_utc=payload.captured_at_utc or now,
        created_at_utc=now,
    )
    db.add(item)
    db.commit()

    return {
        "status": "queued",
        "event_id": event_id,
        "task_id": queued_task_id,
        "review_status": item.status,
        "event_type": item.event_type,
        "event_confidence": float(item.event_confidence),
    }


@router.get("/ops/review-queue", summary="Get ambient voice supervisor review queue")
@limiter.limit("60/minute")
async def get_voice_review_queue(
    request: Request,
    limit: int = 50,
    status: str = "pending_review",
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    safe_limit = max(1, min(int(limit), 200))
    query = db.query(VoiceReviewEvent)
    if status in {"pending_review", "verified", "dismissed"}:
        query = query.filter(VoiceReviewEvent.status == status)
    queue_items = (
        query.order_by(VoiceReviewEvent.created_at_utc.desc()).limit(safe_limit).all()
    )
    queue = [_event_to_dict(item) for item in queue_items]

    return {
        "status": "ok",
        "queue_count": len(queue),
        "queue": queue,
    }


@router.post(
    "/ops/review-queue/{event_id}/verify",
    summary="Verify or dismiss a voice queue item",
)
@limiter.limit("30/minute")
async def verify_voice_review_item(
    request: Request,
    event_id: str,
    payload: VoiceReviewVerifyRequest,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    event = (
        db.query(VoiceReviewEvent).filter(VoiceReviewEvent.event_id == event_id).first()
    )
    if event is None:
        raise HTTPException(status_code=404, detail="Voice review event not found")

    event.status = payload.status
    event.reviewed_by = payload.reviewed_by
    event.review_note = payload.review_note
    event.reviewed_at_utc = datetime.now(timezone.utc)
    db.add(event)
    db.commit()
    db.refresh(event)

    return {"status": "ok", "event": _event_to_dict(event)}
