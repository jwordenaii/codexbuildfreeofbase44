"""
tts.py — POST /api/v1/tts/speak — neural TTS for Jarvis / Mr. Worden chat.

Replaces the browser's robotic SpeechSynthesisUtterance with a real
human-sounding voice (OpenAI `onyx` by default, ElevenLabs if configured).
"""

from __future__ import annotations

import hashlib
import logging
from typing import Optional

from fastapi import APIRouter, Body, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..core.limiter import limiter
from ..services import runtime_config as _cfg
from ..services import tts_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/tts", tags=["tts"])


class SpeakRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)
    voice: Optional[str] = Field(
        default=None,
        description="Optional voice override (e.g. 'onyx', 'echo', 'nova', or an ElevenLabs voice_id).",
    )


@router.post("/speak")
async def speak(request: Request, payload: SpeakRequest = Body(...)) -> Response:
    """
    Convert text to speech and stream MP3 back.

    Browser usage:
        const r = await fetch('/api/v1/tts/speak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: '...' })
        });
        const blob = await r.blob();
        new Audio(URL.createObjectURL(blob)).play();
    """
    try:
        audio, content_type, provider = tts_service.synthesize(
            payload.text, voice=payload.voice
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        # No provider configured — frontend should fall back to browser TTS.
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        logger.exception("TTS synthesis failed")
        raise HTTPException(status_code=502, detail=f"TTS provider error: {type(exc).__name__}: {exc}") from exc

    # Light caching: identical short utterances (greetings, confirmations) re-use
    # browser cache rather than re-billing the TTS API.
    etag = hashlib.sha1(
        f"{provider}|{payload.voice or ''}|{payload.text}".encode("utf-8")
    ).hexdigest()

    return Response(
        content=audio,
        media_type=content_type,
        headers={
            "Cache-Control": "public, max-age=86400",
            "ETag": etag,
            "X-TTS-Provider": provider,
        },
    )


@router.post("/stream")
async def speak_stream(request: Request, payload: SpeakRequest = Body(...)) -> StreamingResponse:
    """
    Convert text to speech and stream MP3 chunks directly to the browser.

    This reduces time-to-first-audio for longer utterances and keeps latency low.
    """
    try:
        audio_stream, content_type, provider = tts_service.synthesize_stream(
            payload.text, voice=payload.voice
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        logger.exception("TTS stream synthesis failed")
        raise HTTPException(status_code=502, detail=f"TTS stream provider error: {type(exc).__name__}: {exc}") from exc

    etag = hashlib.sha1(
        f"stream|{provider}|{payload.voice or ''}|{payload.text}".encode("utf-8")
    ).hexdigest()

    return StreamingResponse(
        audio_stream,
        media_type=content_type,
        headers={
            "Cache-Control": "no-store",
            "ETag": etag,
            "X-TTS-Provider": provider,
        },
    )


@router.get("/status")
async def status() -> dict:
    """Which TTS provider is currently active (for the admin/Jarvis status panel)."""
    import os as _os
    # Diagnostic: show which AI provider keys the container can actually see.
    def _seen(name: str) -> dict:
        v = _os.environ.get(name, "")
        return {"set": bool(v.strip()), "len": len(v)}
    return {
        "provider": tts_service.active_provider(),
        "default_voice": tts_service.DEFAULT_OPENAI_VOICE,
        "default_model": tts_service.DEFAULT_OPENAI_MODEL,
        "env_check": {
            "OPENAI_API_KEY":     _seen("OPENAI_API_KEY"),
            "ANTHROPIC_API_KEY":  _seen("ANTHROPIC_API_KEY"),
            "GOOGLE_API_KEY":     _seen("GOOGLE_API_KEY"),
            "GEMINI_API_KEY":     _seen("GEMINI_API_KEY"),
            "PERPLEXITY_API_KEY": _seen("PERPLEXITY_API_KEY"),
            "XAI_API_KEY":        _seen("XAI_API_KEY"),
            "ELEVENLABS_API_KEY": _seen("ELEVENLABS_API_KEY"),
        },
    }


@router.get("/claude-ping")
async def claude_ping() -> dict:
    """One-shot Claude smoke test — returns raw status + text or error."""
    import os as _os
    import httpx
    key = _os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not key:
        return {"ok": False, "error": "ANTHROPIC_API_KEY not set on container"}
    model = _cfg.anthropic_model()
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key":         key,
                    "anthropic-version": "2023-06-01",
                    "content-type":      "application/json",
                },
                json={
                    "model":      model,
                    "max_tokens": 50,
                    "messages":   [{"role": "user", "content": "Say PONG and nothing else."}],
                },
            )
        body = r.text[:500]
        return {"ok": r.status_code == 200, "model_tried": model, "status": r.status_code, "body": body}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": f"{type(exc).__name__}: {exc}"}


@router.get("/gemini-ping")
async def gemini_ping() -> dict:
    """One-shot Gemini smoke test."""
    import os as _os
    import httpx
    key = (_os.environ.get("GOOGLE_API_KEY", "") or _os.environ.get("GEMINI_API_KEY", "")).strip()
    if not key:
        return {"ok": False, "error": "GOOGLE_API_KEY or GEMINI_API_KEY not set on container"}
    model = _os.environ.get("GOOGLE_MODEL") or "gemini-2.5-flash"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.post(
                url,
                headers={"content-type": "application/json"},
                json={"contents": [{"parts": [{"text": "Say PONG and nothing else."}]}]},
            )
        return {"ok": r.status_code == 200, "model_tried": model, "status": r.status_code, "body": r.text[:500]}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": f"{type(exc).__name__}: {exc}"}


@router.get("/elevenlabs-ping")
async def elevenlabs_ping() -> dict:
    """Surface the exact ElevenLabs API error (auth, voice, quota, etc.)."""
    import os as _os
    import httpx
    key = _os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if not key:
        return {"ok": False, "error": "ELEVENLABS_API_KEY not set"}
    voice = _os.environ.get("ELEVENLABS_VOICE_ID", "pNInz6obpgDQGcFmaJgB")
    model = _os.environ.get("ELEVENLABS_MODEL", "eleven_turbo_v2_5")
    out: dict = {"key_len": len(key), "voice": voice, "model": model}
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            u = await client.get("https://api.elevenlabs.io/v1/user", headers={"xi-api-key": key})
            out["user_status"] = u.status_code
            t = await client.post(
                f"https://api.elevenlabs.io/v1/text-to-speech/{voice}",
                headers={"xi-api-key": key, "accept": "audio/mpeg", "content-type": "application/json"},
                json={"text": "Test.", "model_id": model},
            )
            out["tts_status"] = t.status_code
            out["tts_body"] = t.text[:400] if t.status_code != 200 else f"OK {len(t.content)} bytes"
        return out
    except Exception as exc:  # noqa: BLE001
        out["error"] = f"{type(exc).__name__}: {exc}"
        return out
