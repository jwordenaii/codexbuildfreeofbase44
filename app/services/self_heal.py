"""
self_heal.py — Continuous infra monitor with safe recovery actions.

Purpose:
  - Run a lightweight health loop every few minutes
  - Detect sustained infra degradation (DB / Redis)
  - Execute only safe auto-heal actions inside the app boundary
  - Persist run state for operator visibility

This module intentionally avoids destructive actions such as process restarts.
It focuses on in-process recovery and controlled safety posture changes.
"""

from __future__ import annotations

import json
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import text

from ..core.cache import warm_cache
from ..database import SessionLocal, create_all_tables, engine
from . import autonomy_state
from .durable_storage import durable_data_dir
from .celery_health import check_queue_depth, check_redis_connection
from .monitoring_service import monitoring

logger = logging.getLogger(__name__)

_DEFAULT_STATE: dict[str, Any] = {
    "last_run_at": None,
    "last_status": "unknown",
    "last_error": None,
    "last_actions": [],
    "last_checks": {},
    "consecutive_failures": 0,
    "total_runs": 0,
    "total_recoveries": 0,
}


def _state_path() -> Path:
    configured = (os.getenv("SELF_HEAL_STATE_PATH") or "").strip()
    if configured:
        return Path(configured)
    # /tmp is ephemeral on Fly — self-heal history vanished on every redeploy,
    # defeating the "sustained degradation" detection this module is built on.
    return durable_data_dir() / "jworden_self_heal_state.json"


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _env_flag(name: str, default: bool) -> bool:
    raw = (os.getenv(name) or ("1" if default else "0")).strip().lower()
    return raw in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    raw = (os.getenv(name) or "").strip()
    try:
        value = int(raw)
        return value if value > 0 else default
    except Exception:  # noqa: BLE001
        return default


def _redis_expected() -> bool:
    return bool((os.getenv("REDIS_URL") or os.getenv("CELERY_BROKER_URL") or "").strip())


def _load_state() -> dict[str, Any]:
    path = _state_path()
    if not path.exists():
        return dict(_DEFAULT_STATE)
    try:
        raw = path.read_text(encoding="utf-8")
        data = json.loads(raw or "{}")
        if not isinstance(data, dict):
            return dict(_DEFAULT_STATE)
        merged = dict(_DEFAULT_STATE)
        merged.update(data)
        return merged
    except Exception as exc:  # noqa: BLE001
        logger.warning("Self-heal: could not read state file: %s", exc)
        return dict(_DEFAULT_STATE)


def _save_state(state: dict[str, Any]) -> None:
    path = _state_path()
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        temp = path.with_suffix(path.suffix + ".tmp")
        temp.write_text(json.dumps(state, indent=2, sort_keys=True), encoding="utf-8")
        temp.replace(path)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Self-heal: could not write state file: %s", exc)


def _db_probe() -> dict[str, Any]:
    try:
        start = time.monotonic()
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        latency_ms = round((time.monotonic() - start) * 1000, 2)
        return {"ok": True, "latency_ms": latency_ms}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}


def _run_cache_warm() -> dict[str, Any]:
    db = SessionLocal()
    try:
        result = warm_cache(db)
        return {"ok": True, "result": result}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}
    finally:
        db.close()


def run_self_heal_cycle(trigger: str = "manual") -> dict[str, Any]:
    """
    Run one monitor-and-heal cycle.

    Returns a structured dict suitable for Celery task results and ops dashboards.
    """
    enabled = _env_flag("SELF_HEAL_ENABLED", True)
    threshold = _env_int("SELF_HEAL_FAILURE_THRESHOLD", 2)
    queue_threshold = _env_int("SELF_HEAL_QUEUE_DEPTH_THRESHOLD", 3000)
    auto_freeze = _env_flag("SELF_HEAL_AUTO_FREEZE_ON_FAILURE", True)

    state = _load_state()
    state["total_runs"] = int(state.get("total_runs", 0)) + 1

    if not enabled:
        state.update(
            {
                "last_run_at": _utc_now(),
                "last_status": "disabled",
                "last_error": None,
                "last_actions": [],
                "last_checks": {},
            }
        )
        _save_state(state)
        return {
            "ok": True,
            "enabled": False,
            "status": "disabled",
            "trigger": trigger,
            "state": state,
        }

    redis_expected = _redis_expected()
    redis_check: dict[str, Any]
    queue_check: dict[str, Any]
    if redis_expected:
        redis_check = check_redis_connection()
        queue_check = check_queue_depth()
    else:
        redis_check = {
            "ok": True,
            "skipped": True,
            "detail": "REDIS_URL/CELERY_BROKER_URL not configured",
        }
        queue_check = {
            "ok": True,
            "skipped": True,
            "queue_depth": 0,
            "detail": "Queue depth skipped (Redis not configured)",
        }

    checks: dict[str, Any] = {
        "database": _db_probe(),
        "redis": redis_check,
        "queue": queue_check,
    }

    infra_ok = bool(checks["database"].get("ok") and checks["redis"].get("ok"))
    queue_depth = checks["queue"].get("queue_depth") if checks["queue"].get("ok") else None

    prev_failures = int(state.get("consecutive_failures", 0))
    consecutive_failures = 0 if infra_ok else prev_failures + 1

    actions: list[dict[str, Any]] = []

    # Safe action 1: if DB probe fails, re-run table verification/creation.
    if not checks["database"].get("ok"):
        try:
            create_all_tables()
            actions.append(
                {
                    "action": "verify_create_tables",
                    "ok": True,
                    "detail": "Executed create_all_tables()",
                }
            )
        except Exception as exc:  # noqa: BLE001
            actions.append(
                {
                    "action": "verify_create_tables",
                    "ok": False,
                    "error": str(exc),
                }
            )

    # Safe action 2: if queue is backing up, proactively warm caches.
    if isinstance(queue_depth, int) and queue_depth >= queue_threshold:
        warm_result = _run_cache_warm()
        actions.append(
            {
                "action": "warm_cache_on_queue_pressure",
                **warm_result,
                "queue_depth": queue_depth,
                "queue_threshold": queue_threshold,
            }
        )

    # Escalation: sustained failures trigger ops alerts and optional autonomy freeze.
    if not infra_ok and consecutive_failures >= threshold:
        if auto_freeze and not autonomy_state.is_frozen():
            frozen = autonomy_state.freeze(
                reason=(
                    f"self-heal freeze after {consecutive_failures} consecutive infra failures"
                )
            )
            actions.append(
                {
                    "action": "freeze_autonomy",
                    "ok": bool(frozen.get("frozen")),
                    "detail": frozen.get("reason"),
                }
            )

        message = (
            f"Self-heal detected sustained degradation.\n"
            f"- Consecutive failures: {consecutive_failures}\n"
            f"- Database ok: {checks['database'].get('ok')}\n"
            f"- Redis ok: {checks['redis'].get('ok')}\n"
            f"- Queue depth: {queue_depth}"
        )
        monitoring.send_slack_alert(
            title="Self-Heal Escalation Triggered",
            message=message,
            severity="critical",
        )
        monitoring.log_error(
            error_type="self_heal_escalation",
            message="Self-heal escalation triggered",
            context={
                "consecutive_failures": consecutive_failures,
                "database_ok": checks["database"].get("ok"),
                "redis_ok": checks["redis"].get("ok"),
                "redis_expected": redis_expected,
                "queue_depth": queue_depth,
                "trigger": trigger,
            },
        )

    if infra_ok and prev_failures >= threshold:
        state["total_recoveries"] = int(state.get("total_recoveries", 0)) + 1
        monitoring.send_slack_alert(
            title="Self-Heal Recovery",
            message=(
                f"Infra recovered after {prev_failures} consecutive failures.\n"
                f"- Database ok: {checks['database'].get('ok')}\n"
                f"- Redis ok: {checks['redis'].get('ok')}\n"
                f"- Queue depth: {queue_depth}"
            ),
            severity="info",
        )

    monitoring.log_metric("ops.self_heal.cycle_ok", 1 if infra_ok else 0)
    monitoring.log_metric("ops.self_heal.consecutive_failures", float(consecutive_failures))
    if isinstance(queue_depth, int):
        monitoring.log_metric("ops.self_heal.queue_depth", float(queue_depth))

    status = "healthy" if infra_ok else "degraded"
    state.update(
        {
            "last_run_at": _utc_now(),
            "last_status": status,
            "last_error": None if infra_ok else "infra_degraded",
            "last_actions": actions,
            "last_checks": checks,
            "consecutive_failures": consecutive_failures,
        }
    )
    _save_state(state)

    return {
        "ok": infra_ok,
        "enabled": True,
        "status": status,
        "trigger": trigger,
        "checks": checks,
        "actions": actions,
        "consecutive_failures": consecutive_failures,
        "threshold": threshold,
    }


def get_self_heal_status() -> dict[str, Any]:
    """Return current self-heal config + last known cycle state."""
    state = _load_state()
    return {
        "enabled": _env_flag("SELF_HEAL_ENABLED", True),
        "failure_threshold": _env_int("SELF_HEAL_FAILURE_THRESHOLD", 2),
        "queue_depth_threshold": _env_int("SELF_HEAL_QUEUE_DEPTH_THRESHOLD", 3000),
        "auto_freeze_on_failure": _env_flag("SELF_HEAL_AUTO_FREEZE_ON_FAILURE", True),
        "state_path": str(_state_path()),
        "autonomy_frozen": autonomy_state.is_frozen(),
        "state": state,
    }
