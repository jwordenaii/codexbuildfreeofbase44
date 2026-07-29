"""
runtime_config.py — Hot-reloadable secret/config store, owner-only.

Lets the Command Center owner paste API keys into a UI instead of editing
Railway env vars and redeploying. Values are persisted to a JSON file at
RUNTIME_CONFIG_PATH (default /tmp/jworden_runtime_config.json) and shadow
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

logger = logging.getLogger(__name__)


def _default_state_path() -> Path:
    configured = (os.environ.get("RUNTIME_CONFIG_PATH") or "").strip()
    if configured:
        return Path(configured)

    railway_mount = (os.environ.get("RAILWAY_VOLUME_MOUNT_PATH") or "").strip()
    if railway_mount:
        return Path(railway_mount) / "jworden_runtime_config.json"

    data_dir = Path("/data")
    try:
        if data_dir.exists() and os.access(data_dir, os.W_OK):
            return data_dir / "jworden_runtime_config.json"
    except Exception:  # noqa: BLE001
        pass

    if os.name == "nt":
        return Path.cwd() / ".runtime" / "jworden_runtime_config.json"

    return Path("/tmp/jworden_runtime_config.json")


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
    # Web search
    "TAVILY_API_KEY", "TAVILY_MAX_RESULTS",
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
    # Property scan + direct-mail engine (market orchestration)
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
    "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "TAVILY_API_KEY",
    "GOOGLE_API_KEY", "GEMINI_API_KEY",
    "VAPI_API_KEY", "TWILIO_AUTH_TOKEN",
    "SENDGRID_API_KEY", "GOOGLE_ADS_DEVELOPER_TOKEN", "SERPAPI_KEY",
    "GA4_SERVICE_ACCOUNT_JSON", "GSC_SERVICE_ACCOUNT_JSON",
    "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_MAPS_API_KEY", "GOOGLE_PAGESPEED_API_KEY",
    "WEARABLE_APPLE_HEALTH_SECRET", "WEARABLE_FITBIT_SECRET",
    "WEARABLE_GARMIN_SECRET", "WEARABLE_WHOOP_SECRET", "WEARABLE_OURA_SECRET",
})


def _load() -> dict[str, str]:
    """Load + cache the JSON state file. Lock must be held by caller."""
    global _CACHE
    if _CACHE is not None:
        return _CACHE
    if not _STATE_PATH.exists():
        _CACHE = {}
        return _CACHE
    try:
        raw = _STATE_PATH.read_text(encoding="utf-8")
        data = json.loads(raw or "{}")
        if not isinstance(data, dict):
            raise ValueError("runtime config root must be an object")
        # Keep only string values + whitelisted keys
        _CACHE = {k: str(v) for k, v in data.items() if k in MANAGED_KEYS and v not in (None, "")}
    except Exception as exc:
        logger.exception("runtime_config load failed; starting empty: %s", exc)
        _CACHE = {}
    return _CACHE


def _save(data: dict[str, str]) -> None:
    """Atomic write. Lock must be held by caller."""
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
