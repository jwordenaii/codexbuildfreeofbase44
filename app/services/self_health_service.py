"""
self_health_service.py — lets JARVIS answer "is anything broken right now?"

Jarvis previously had no way to inspect his own platform. If the database was
down or an integration key was missing, he either failed opaquely mid-answer or
— worse — talked confidently about data he could not actually reach. This gives
him one honest, cheap self-check he can call before or instead of guessing.

Checks performed:
  * database connectivity (a real round-trip, not a config read)
  * which integration credentials are actually present in the environment
  * the alembic revision the database is on
  * background worker plumbing (broker configured or not)

Everything is reported as observed state. Nothing is inferred, and a failure is
reported as a failure rather than smoothed over.
"""

from __future__ import annotations

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

# Grouped so Jarvis can say "voice is fully configured but billing is not"
# instead of reciting a flat list of variable names at the operator.
_INTEGRATION_GROUPS: dict[str, list[str]] = {
    "ai": ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_API_KEY"],
    "voice_and_telephony": [
        "ELEVENLABS_API_KEY",
        "TWILIO_ACCOUNT_SID",
        "TWILIO_AUTH_TOKEN",
        "VAPI_API_KEY",
    ],
    "email": ["SENDGRID_API_KEY"],
    "maps_and_weather": ["GOOGLE_MAPS_API_KEY", "OPENWEATHERMAP_API_KEY"],
    "search": ["TAVILY_API_KEY", "EXA_API_KEY"],
    "billing": ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    "storage": ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "BUCKET_NAME"],
    "background_jobs": ["REDIS_URL", "CELERY_BROKER_URL"],
    "data": ["DATABASE_URL"],
}


def _present(name: str) -> bool:
    return bool((os.getenv(name) or "").strip())


def check_system_health() -> dict[str, Any]:
    """
    Return observed platform health.

    ``overall`` is one of "healthy" (database reachable, no degraded group),
    "degraded" (database fine, some capability unconfigured) or "unhealthy"
    (database unreachable — most tools will fail).
    """
    report: dict[str, Any] = {"status": "ok", "checks": {}}

    # ── Database ─────────────────────────────────────────────────────────────
    db: dict[str, Any] = {"reachable": False}
    try:
        from sqlalchemy import inspect as sa_inspect, text  # noqa: PLC0415

        from ..database import engine  # noqa: PLC0415

        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            db["reachable"] = True
            try:
                rev = list(conn.execute(text("SELECT version_num FROM alembic_version")))
                db["migration"] = rev[0][0] if rev else None
            except Exception:  # noqa: BLE001 — alembic table may not exist yet
                db["migration"] = None
        try:
            db["tables"] = len(sa_inspect(engine).get_table_names())
        except Exception:  # noqa: BLE001
            pass
    except Exception as exc:  # noqa: BLE001
        db["error"] = f"{type(exc).__name__}: {exc}"
        logger.warning("[JARVIS] self-health DB check failed: %s", exc)
    report["checks"]["database"] = db

    # ── Integrations ─────────────────────────────────────────────────────────
    integrations: dict[str, Any] = {}
    degraded: list[str] = []
    for group, keys in _INTEGRATION_GROUPS.items():
        present = [k for k in keys if _present(k)]
        missing = [k for k in keys if not _present(k)]
        state = "configured" if not missing else ("partial" if present else "not_configured")
        integrations[group] = {"state": state, "present": present, "missing": missing}
        if state != "configured":
            degraded.append(group)
    report["checks"]["integrations"] = integrations

    # ── Overall ──────────────────────────────────────────────────────────────
    if not db.get("reachable"):
        overall = "unhealthy"
        summary = "Database unreachable — most data tools will fail."
    elif degraded:
        overall = "degraded"
        summary = "Core is healthy; some capabilities are unconfigured: " + ", ".join(sorted(degraded)) + "."
    else:
        overall = "healthy"
        summary = "All checks passing."

    report["overall"] = overall
    report["summary"] = summary
    report["degraded_groups"] = sorted(degraded)
    return report
