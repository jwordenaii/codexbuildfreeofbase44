"""
runtime_config.py — Hot-reloadable secret/config store, owner-only.

Lets the Command Center owner paste API keys into a UI instead of editing
Railway env vars and redeploying. Values are persisted to a JSON file at
RUNTIME_CONFIG_PATH (default: the durable data dir, see durable_storage.py) and shadow
the corresponding os.environ values when read via `get(name)`.

Usage from any service:
    from app.services import runtime_config
    api_key = runtime_config.get("ANTHROPIC_API_KEY")    # checks runtime store, falls back to os.environ

Design constraints:
  - File is created with mode 0600 where the OS supports it.
  - Empty/whitespace values delete the key (treated as "unset").
  - get() never raises; returns "" when missing.
  - Thread-safe via a single lock.
  - Updates are atomic (write tmp + os.replace).
"""

from __future__ import annotations

import json
import logging
import os
import tempfile
import threading
from pathlib import Path
from typing import Iterable

from . import durable_kv
from .durable_storage import durable_data_dir

logger = logging.getLogger(__name__)

# Key under which the whole config document is stored in the Postgres KV.
# One document, exactly mirroring the JSON file it replaces.
_KV_KEY = "runtime_config"

# The Claude model every surface reports and uses. This default was
# previously copy-pasted into 6 files, so upgrading the model updated some
# call sites and silently left others on the old one — production kept
# reporting claude-sonnet-4-5 after the model had "been upgraded".
# Override per-deployment with the ANTHROPIC_MODEL key.
DEFAULT_ANTHROPIC_MODEL = "claude-opus-5"


def anthropic_model() -> str:
    """Configured Claude model, or the flagship default."""
    return (get("ANTHROPIC_MODEL") or "").strip() or DEFAULT_ANTHROPIC_MODEL


def _default_state_path() -> Path:
    configured = (os.environ.get("RUNTIME_CONFIG_PATH") or "").strip()
    if configured:
        return Path(configured)
    return durable_data_dir() / "jworden_runtime_config.json"


_STATE_PATH = _default_state_path()
_LOCK = threading.Lock()
_CACHE: dict[str, str] | None = None

# Whitelist of keys the admin UI is allowed to manage. Anything outside this list
# is rejected — prevents an attacker who somehow reaches the admin endpoint from
# rewriting unrelated env vars (DATABASE_URL, JWT_SECRET_KEY, etc.).
MANAGED_KEYS: tuple[str, ...] = (
    # Jarvis brain
    "ANTHROPIC_API_KEY", "ANTHROPIC_MODEL",
    "OPENAI_API_KEY",
    "GOOGLE_API_KEY", "GEMINI_API_KEY",
    "LLM_FALLBACK_SILENT", "JARVIS_MAX_TIER",
    "JARVIS_MODEL_OVERRIDE", "JARVIS_DISABLE_GEMINI", "LLM_DISABLED_PROVIDERS",
    "JARVIS_LOW_COST_MODE", "JARVIS_EFFORT",
    "JARVIS_CHAT_MAX_TOKENS", "JARVIS_FAST_MAX_TOKENS", "JARVIS_CLAUDE_MAX_TOKENS",
    # Voice — ElevenLabs is the premium TTS tier and outranks OpenAI whenever a
    # key is present (see tts_service.py). Managed here so the owner can paste
    # the key into the Command Center rather than redeploying.
    "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID", "ELEVENLABS_MODEL",
    "JARVIS_TTS_VOICE", "JARVIS_TTS_MODEL",
    # Web search (Tavily preferred; Exa used automatically as a fallback)
    "TAVILY_API_KEY", "TAVILY_MAX_RESULTS", "EXA_API_KEY",
    # Voice / phone
    "VAPI_API_KEY", "VAPI_PHONE_NUMBER_ID", "VAPI_ASSISTANT_ID",
    # SMS verification
    "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_VERIFY_SERVICE_SID",
    "ADMIN_2FA_PHONE",
    # Email
    "SENDGRID_API_KEY", "SENDGRID_FROM_EMAIL", "SENDGRID_FROM_NAME",
    "ADMIN_NOTIFY_EMAIL",
    # Company info (safe to manage from UI)
    "COMPANY_PHONE", "COMPANY_EMAIL", "COMPANY_WEBSITE", "COMPANY_ADDRESS",
    # Google integrations (large JSON blobs allowed)
    "GA4_PROPERTY_ID", "GA4_SERVICE_ACCOUNT_JSON",
    "GSC_SITE_URL", "GSC_SERVICE_ACCOUNT_JSON",
    "GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_SITE_DOMAIN",
    "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_CUSTOMER_ID", "GOOGLE_ADS_LOGIN_CUSTOMER_ID",
    "GOOGLE_MAPS_API_KEY", "GOOGLE_PAGESPEED_API_KEY",
    "GOOGLE_PLACES_API_KEY", "GOOGLE_PLACE_ID",
    # Google Business Profile automation (posts + review sync)
    "GBP_OAUTH_TOKEN", "GBP_ACCOUNT_ID", "GBP_REVIEW_LINK",
    # Live search intelligence (Google Trends / SerpAPI for hotspot heatmap)
    "SERPAPI_KEY", "GOOGLE_TRENDS_GEO", "SEARCH_PULSE_TERMS",
    # Licensing / tier (controls which premium features are exposed)
    "LICENSE_TIER",
    # Crew wearable health monitoring (per-provider HMAC secrets + thresholds)
    "WEARABLE_APPLE_HEALTH_SECRET", "WEARABLE_FITBIT_SECRET",
    "WEARABLE_GARMIN_SECRET", "WEARABLE_WHOOP_SECRET", "WEARABLE_OURA_SECRET",
    "WEARABLE_DEV_OPEN",
    "WEARABLE_HR_SPIKE_BPM", "WEARABLE_HR_SUSTAINED_BPM",
    "WEARABLE_SPO2_LOW", "WEARABLE_SPO2_CRITICAL",
    "WEARABLE_SKIN_TEMP_HIGH_F", "WEARABLE_HRV_LOW_MS",
    # Zip-code property scan -> direct-mail campaign pipeline
    # (Regrid parcel lookup + Lob physical mail send; both honest-mock
    # when unset — see app/services/parcel_service.py + mailer_service.py)
    "REGRID_API_KEY", "LOB_API_KEY",
)

# Tier-gated feature catalogue. Used by the frontend + admin UI to decide which
# premium surfaces to render. Lite licensees never see premium-tier features.
FEATURE_TIERS: dict[str, str] = {
    # core (always on)
    "lead_capture":         "core",
    "basic_crm":            "core",
    "single_admin_login":   "core",
    "static_content":       "core",
    # premium (licensed customers)
    "jarvis_brain":         "premium",
    "web_search":           "premium",
    "vapi_calling":         "premium",
    "sendgrid_email":       "premium",
    "twilio_verify":        "premium",
    "role_content_editor":  "premium",
    "multi_staff_rbac":     "premium",
    "daily_checkin":        "premium",
    "advanced_analytics":   "premium",
    "search_pulse_heatmap": "premium",
    "crew_wearables":       "premium",
    "truck_dispatch":       "premium",
    "asphalt_thermal":      "premium",
    "drone_capture":        "premium",
    "lidar_ingest":         "premium",
    "roller_compaction":    "premium",
    "staff_portal":         "core",
    # owner-only (master deployment never licensed out)
    "integrations_panel":   "owner",
    "autonomy_kill_switch": "owner",
    "key_management":       "owner",
}

_TIER_RANK = {"owner": 3, "premium": 2, "core": 1}


def current_tier() -> str:
    """Returns 'owner' (default) | 'premium' | 'lite' (== core only)."""
    raw = (get("LICENSE_TIER") or "owner").strip().lower()
    if raw in {"lite", "basic", "core"}:
        return "core"
    if raw == "premium":
        return "premium"
    return "owner"


def feature_enabled(name: str) -> bool:
    required = FEATURE_TIERS.get(name, "owner")
    return _TIER_RANK.get(current_tier(), 0) >= _TIER_RANK.get(required, 3)


def enabled_features() -> dict[str, bool]:
    return {k: feature_enabled(k) for k in FEATURE_TIERS}

# Keys that should NEVER be returned as plaintext on read — only last 4 chars.
SENSITIVE_KEYS: frozenset[str] = frozenset({
    "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "TAVILY_API_KEY", "EXA_API_KEY",
    "GOOGLE_API_KEY", "GEMINI_API_KEY",
    "VAPI_API_KEY", "TWILIO_AUTH_TOKEN",
    "SENDGRID_API_KEY", "GOOGLE_ADS_DEVELOPER_TOKEN", "SERPAPI_KEY",
    "GA4_SERVICE_ACCOUNT_JSON", "GSC_SERVICE_ACCOUNT_JSON",
    "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_MAPS_API_KEY", "GOOGLE_PAGESPEED_API_KEY",
    "GOOGLE_PLACES_API_KEY", "GBP_OAUTH_TOKEN",
    "WEARABLE_APPLE_HEALTH_SECRET", "WEARABLE_FITBIT_SECRET",
    "WEARABLE_GARMIN_SECRET", "WEARABLE_WHOOP_SECRET", "WEARABLE_OURA_SECRET",
    "REGRID_API_KEY", "LOB_API_KEY",
    "ELEVENLABS_API_KEY",
})


def _sanitize(data: object) -> dict[str, str]:
    """Keep only whitelisted keys with non-empty string values."""
    if not isinstance(data, dict):
        raise ValueError("runtime config root must be an object")
    return {k: str(v) for k, v in data.items() if k in MANAGED_KEYS and v not in (None, "")}


def _load() -> dict[str, str]:
    """
    Load + cache the config document. Lock must be held by caller.

    Order: Postgres KV (durable across redeploys AND shared by both Fly
    machines) → local JSON file → empty. The file is only authoritative when
    the database is unreachable or not configured; see durable_kv.py for why
    the file alone is not enough in production.
    """
    global _CACHE
    if _CACHE is not None:
        return _CACHE

    raw_db = durable_kv.get(_KV_KEY)
    if raw_db:
        try:
            _CACHE = _sanitize(json.loads(raw_db or "{}"))
            return _CACHE
        except Exception as exc:  # noqa: BLE001
            logger.exception("runtime_config: KV document unreadable, trying file: %s", exc)

    if not _STATE_PATH.exists():
        _CACHE = {}
        return _CACHE
    try:
        raw = _STATE_PATH.read_text(encoding="utf-8")
        _CACHE = _sanitize(json.loads(raw or "{}"))
        # One-time promotion: keys that predate the KV store (or were written
        # while the DB was down) get copied up so the next redeploy keeps them.
        if _CACHE and raw_db is None:
            durable_kv.set(_KV_KEY, json.dumps(_CACHE, sort_keys=True))
    except Exception as exc:
        logger.exception("runtime_config load failed; starting empty: %s", exc)
        _CACHE = {}
    return _CACHE


def _save(data: dict[str, str]) -> None:
    """
    Persist to Postgres (primary) and the local file (cache/fallback).
    Lock must be held by caller.
    """
    stored = durable_kv.set(_KV_KEY, json.dumps(data, sort_keys=True))

    # The local file is a cache/fallback. If Postgres accepted the write, a
    # failure here is not fatal, so don't let it surface as a 500 on an
    # otherwise-successful key update.
    try:
        _STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp_path = tempfile.mkstemp(prefix=".runtime_config_", dir=str(_STATE_PATH.parent))
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, sort_keys=True)
            os.replace(tmp_path, _STATE_PATH)
            try:
                os.chmod(_STATE_PATH, 0o600)
            except (OSError, PermissionError):
                pass  # best-effort on Windows
        finally:
            if os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass
    except OSError:
        if not stored:
            # Neither store took it — the value only lives in this process's
            # memory and will be lost. Loud, because it means a key the owner
            # just pasted into the UI is not actually saved.
            logger.error("runtime_config: BOTH Postgres and file writes failed; value not persisted")
        else:
            logger.warning("runtime_config: file cache write failed; Postgres holds the value")


# The flagship model, defined ONCE. This literal was previously copy-pasted
# into six files (jarvis, jarvis_router x2, tts, admin_integrations, health);
# they drifted, and production reported claude-sonnet-4-5 on the tool path
# while the chat lane ran Opus.
DEFAULT_ANTHROPIC_MODEL = "claude-opus-5"


def anthropic_model() -> str:
    """Configured Claude model, or the flagship default."""
    return (get("ANTHROPIC_MODEL") or "").strip() or DEFAULT_ANTHROPIC_MODEL


def get(name: str, default: str = "") -> str:
    """Lookup order: runtime store → os.environ → default."""
    with _LOCK:
        cache = _load()
        if name in cache and cache[name]:
            return cache[name]
    return os.environ.get(name, default)


def set_value(name: str, value: str) -> bool:
    """
    Set or delete a single managed key. Empty/whitespace value deletes.
    Returns True on success, False if the key is not in MANAGED_KEYS.
    """
    if name not in MANAGED_KEYS:
        return False
    value = (value or "").strip()
    with _LOCK:
        cache = _load()
        if value:
            cache[name] = value
        else:
            cache.pop(name, None)
        _save(cache)
    return True


def set_many(updates: dict[str, str]) -> dict[str, bool]:
    """Apply multiple updates at once. Returns {key: applied?}."""
    results: dict[str, bool] = {}
    with _LOCK:
        cache = _load()
        for k, v in (updates or {}).items():
            if k not in MANAGED_KEYS:
                results[k] = False
                continue
            v = (v or "").strip() if isinstance(v, str) else ""
            if v:
                cache[k] = v
            else:
                cache.pop(k, None)
            results[k] = True
        _save(cache)
    return results


def _mask(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 4:
        return "•" * len(value)
    return "•" * (len(value) - 4) + value[-4:]


def status_for(keys: Iterable[str] | None = None) -> dict[str, dict]:
    """
    Return a dict of {key: {set: bool, source: 'runtime'|'env'|'none', preview: str}}
    Sensitive keys are always masked. Suitable for an admin UI.
    """
    target = tuple(keys) if keys else MANAGED_KEYS
    out: dict[str, dict] = {}
    with _LOCK:
        cache = _load()
        for k in target:
            in_runtime = bool(cache.get(k))
            in_env = bool(os.environ.get(k, "").strip())
            value = cache.get(k) or os.environ.get(k, "")
            source = "runtime" if in_runtime else ("env" if in_env else "none")
            preview = _mask(value) if (k in SENSITIVE_KEYS or len(value) > 64) else value
            out[k] = {
                "set":     bool(value),
                "source":  source,
                "preview": preview,
                "managed": True,
                "sensitive": k in SENSITIVE_KEYS,
            }
    return out


def reload() -> int:
    """Force re-read from disk. Returns number of keys loaded."""
    global _CACHE
    with _LOCK:
        _CACHE = None
        return len(_load())
