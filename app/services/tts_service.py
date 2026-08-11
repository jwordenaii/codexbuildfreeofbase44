"""
tts_service.py — Neural text-to-speech for the Mr. Worden / Jarvis voice.

Replaces the browser's built-in `SpeechSynthesisUtterance` (which sounds like
a 1990s Apple voice) with a real human-sounding neural TTS.

Provider chain (first configured one wins):
  1. ElevenLabs       — best quality, supports voice cloning.
                        Requires ELEVENLABS_API_KEY (+ optional ELEVENLABS_VOICE_ID).
  2. OpenAI tts-1-hd  — very good, ships today using existing OPENAI_API_KEY.
                        Default voice: "onyx" (deep, calm — Jarvis-like).

Returns raw MP3 bytes ready to stream to the browser as audio/mpeg.
"""

from __future__ import annotations

import logging
import os
from collections.abc import Callable, Iterator
from typing import Optional

import httpx

from . import runtime_config as _cfg

logger = logging.getLogger(__name__)

# ── Voice profiles ───────────────────────────────────────────────────────────
# OpenAI voices: alloy, echo, fable, onyx, nova, shimmer
# Onyx = deep calm male, closest to Iron Man's J.A.R.V.I.S.

OPENAI_VOICES = {"alloy", "echo", "fable", "onyx", "nova", "shimmer"}
def _voice_cfg(name: str, default: str) -> str:
    """runtime store -> env -> default. Read per call so a key pasted into
    the Command Center takes effect without a redeploy."""
    return (_cfg.get(name) or "").strip() or default


DEFAULT_OPENAI_VOICE = os.getenv("JARVIS_TTS_VOICE", "onyx")
DEFAULT_OPENAI_MODEL = os.getenv("JARVIS_TTS_MODEL", "tts-1-hd")  # -hd = higher quality

# ElevenLabs: paste any voice ID from your ElevenLabs library.
# "21m00Tcm4TlvDq8ikWAM" = Rachel (default fallback if user provides no ID).
DEFAULT_ELEVENLABS_VOICE = os.getenv("ELEVENLABS_VOICE_ID", "pNInz6obpgDQGcFmaJgB")  # Adam (deep male)
DEFAULT_ELEVENLABS_MODEL = os.getenv("ELEVENLABS_MODEL", "eleven_turbo_v2_5")


def _env_float(name: str, default: float, lo: float = 0.0, hi: float = 1.0) -> float:
    """Read a 0..1 tuning knob from the environment, clamped. Never raises."""
    try:
        return max(lo, min(float(os.getenv(name, "").strip()), hi))
    except (TypeError, ValueError):
        return default


# ── Delivery tuning ──────────────────────────────────────────────────────────
#
# These were previously written out twice — once in _synthesize_elevenlabs and
# once in _stream_elevenlabs — so the buffered and streamed paths could drift
# into sounding different. One definition, used by both.
#
# The defaults target the register the product is going for: composed,
# measured, dry. That is mostly a function of these two numbers.
#
#   stability   0.45 -> 0.65   Higher is steadier and less emotionally
#                              variable. Low stability reads as expressive or
#                              theatrical, which is the opposite of a butler
#                              who never sounds surprised.
#   style       0.30 -> 0.05   Style exaggerates the source voice's delivery
#                              quirks. Near zero keeps the read neutral and
#                              unhurried. It also lowers latency.
#
# similarity_boost stays high so the voice does not wander off-model, and
# speaker_boost stays on for presence.
#
# All four are env-overridable so the voice can be re-tuned without a deploy.
def _voice_settings() -> dict:
    return {
        "stability": _env_float("ELEVENLABS_STABILITY", 0.65),
        "similarity_boost": _env_float("ELEVENLABS_SIMILARITY", 0.85),
        "style": _env_float("ELEVENLABS_STYLE", 0.05),
        "use_speaker_boost": (os.getenv("ELEVENLABS_SPEAKER_BOOST", "1").strip() != "0"),
    }


def _has_elevenlabs() -> bool:
    return bool(_voice_cfg("ELEVENLABS_API_KEY", ""))


def _has_openai() -> bool:
    return bool(_voice_cfg("OPENAI_API_KEY", ""))


def active_provider() -> str:
    """Which provider will be used right now."""
    if _has_elevenlabs():
        return "elevenlabs"
    if _has_openai():
        return "openai"
    return "none"


def _http_timeout() -> httpx.Timeout:
    # Long reads are normal for larger utterances; keep connect timeout tight.
    return httpx.Timeout(connect=10.0, read=120.0, write=30.0, pool=30.0)


# ── ElevenLabs ───────────────────────────────────────────────────────────────

def _synthesize_elevenlabs(text: str, voice_id: Optional[str] = None) -> bytes:
    api_key = _voice_cfg("ELEVENLABS_API_KEY", "")
    if not api_key:
        raise RuntimeError("ELEVENLABS_API_KEY missing")

    voice = voice_id or _voice_cfg("ELEVENLABS_VOICE_ID", DEFAULT_ELEVENLABS_VOICE)
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice}"
    headers = {
        "xi-api-key": api_key,
        "accept": "audio/mpeg",
        "content-type": "application/json",
    }
    payload = {
        "text": text,
        "model_id": _voice_cfg("ELEVENLABS_MODEL", DEFAULT_ELEVENLABS_MODEL),
        "voice_settings": _voice_settings(),
    }
    with httpx.Client(timeout=_http_timeout()) as client:
        resp = client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        return resp.content


def _stream_elevenlabs(text: str, voice_id: Optional[str] = None) -> Iterator[bytes]:
    api_key = _voice_cfg("ELEVENLABS_API_KEY", "")
    if not api_key:
        raise RuntimeError("ELEVENLABS_API_KEY missing")

    voice = voice_id or _voice_cfg("ELEVENLABS_VOICE_ID", DEFAULT_ELEVENLABS_VOICE)
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice}"
    headers = {
        "xi-api-key": api_key,
        "accept": "audio/mpeg",
        "content-type": "application/json",
    }
    payload = {
        "text": text,
        "model_id": _voice_cfg("ELEVENLABS_MODEL", DEFAULT_ELEVENLABS_MODEL),
        "voice_settings": _voice_settings(),
    }

    with httpx.Client(timeout=_http_timeout()) as client:
        with client.stream("POST", url, headers=headers, json=payload) as resp:
            resp.raise_for_status()
            for chunk in resp.iter_bytes(chunk_size=8192):
                if chunk:
                    yield chunk


# ── OpenAI ───────────────────────────────────────────────────────────────────

def _synthesize_openai(text: str, voice: Optional[str] = None) -> bytes:
    api_key = _voice_cfg("OPENAI_API_KEY", "")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY missing")

    chosen = (voice or DEFAULT_OPENAI_VOICE).lower()
    if chosen not in OPENAI_VOICES:
        chosen = DEFAULT_OPENAI_VOICE

    # Use raw HTTP so we don't depend on a specific openai SDK version's audio API.
    url = "https://api.openai.com/v1/audio/speech"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": DEFAULT_OPENAI_MODEL,
        "voice": chosen,
        "input": text,
        "response_format": "mp3",
        "speed": 1.0,
    }
    with httpx.Client(timeout=_http_timeout()) as client:
        resp = client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        return resp.content


def _stream_openai(text: str, voice: Optional[str] = None) -> Iterator[bytes]:
    api_key = _voice_cfg("OPENAI_API_KEY", "")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY missing")

    chosen = (voice or DEFAULT_OPENAI_VOICE).lower()
    if chosen not in OPENAI_VOICES:
        chosen = DEFAULT_OPENAI_VOICE

    url = "https://api.openai.com/v1/audio/speech"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": DEFAULT_OPENAI_MODEL,
        "voice": chosen,
        "input": text,
        "response_format": "mp3",
        "speed": 1.0,
    }

    with httpx.Client(timeout=_http_timeout()) as client:
        with client.stream("POST", url, headers=headers, json=payload) as resp:
            resp.raise_for_status()
            for chunk in resp.iter_bytes(chunk_size=8192):
                if chunk:
                    yield chunk


# ── Public API ───────────────────────────────────────────────────────────────

# Hard cap so a runaway prompt can't burn $$$ in TTS.
MAX_CHARS = int(os.getenv("TTS_MAX_CHARS", "4000"))


def synthesize(text: str, voice: Optional[str] = None) -> tuple[bytes, str, str]:
    """
    Convert text → MP3 bytes using the best configured provider.

    Returns: (mp3_bytes, content_type, provider_used)
    Raises RuntimeError if no provider is configured or the call fails.
    """
    cleaned = (text or "").strip()
    if not cleaned:
        raise ValueError("text is empty")
    if len(cleaned) > MAX_CHARS:
        cleaned = cleaned[:MAX_CHARS]

    last_err: Optional[Exception] = None

    if _has_elevenlabs():
        try:
            audio = _synthesize_elevenlabs(cleaned, voice_id=voice)
            return audio, "audio/mpeg", "elevenlabs"
        except Exception as exc:  # noqa: BLE001
            logger.warning("ElevenLabs TTS failed, falling back to OpenAI: %s", exc)
            last_err = exc

    if _has_openai():
        try:
            audio = _synthesize_openai(cleaned, voice=voice)
            return audio, "audio/mpeg", "openai"
        except Exception as exc:  # noqa: BLE001
            logger.error("OpenAI TTS failed: %s", exc)
            last_err = exc

    raise RuntimeError(
        f"No TTS provider available (last error: {last_err}). "
        "Set OPENAI_API_KEY (default) or ELEVENLABS_API_KEY."
    )


def synthesize_stream(text: str, voice: Optional[str] = None) -> tuple[Iterator[bytes], str, str]:
    """
    Convert text -> streamed MP3 bytes from provider to client.

    The stream is primed with the first chunk so provider fallback can happen
    before the HTTP response starts.
    """
    cleaned = (text or "").strip()
    if not cleaned:
        raise ValueError("text is empty")
    if len(cleaned) > MAX_CHARS:
        cleaned = cleaned[:MAX_CHARS]

    candidates: list[tuple[str, Callable[[], Iterator[bytes]]]] = []
    if _has_elevenlabs():
        candidates.append(("elevenlabs", lambda: _stream_elevenlabs(cleaned, voice_id=voice)))
    if _has_openai():
        candidates.append(("openai", lambda: _stream_openai(cleaned, voice=voice)))

    last_err: Optional[Exception] = None
    for provider, make_stream in candidates:
        try:
            stream = make_stream()
            first = next(stream)

            def _merged() -> Iterator[bytes]:
                if first:
                    yield first
                for chunk in stream:
                    if chunk:
                        yield chunk

            return _merged(), "audio/mpeg", provider
        except StopIteration as exc:
            last_err = RuntimeError(f"{provider} returned empty audio stream")
            logger.warning("%s stream returned empty response", provider)
            continue
        except Exception as exc:  # noqa: BLE001
            logger.warning("%s stream failed, trying fallback: %s", provider, exc)
            last_err = exc

    raise RuntimeError(
        f"No TTS stream provider available (last error: {last_err}). "
        "Set OPENAI_API_KEY (default) or ELEVENLABS_API_KEY."
    )
