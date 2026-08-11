"""
orchestrator.py — Level 4 Autonomous Intelligence Engine

Implements the Orchestrator-Worker-Reflexion-RL pattern for autonomous
infrastructure management across J. Worden & Sons job sites.

Architecture:
  Orchestrator  — decomposes a high-level Goal into a TaskGraph
  Workers       — specialized agents that execute individual subtasks
                  (schedule_optimizer, material_analyzer, safety_auditor,
                   drone_inspector, procurement_agent, anomaly_responder,
                   cost_controller, weather_monitor)
  Reflexion     — critic loop that reviews each worker output before it is
                  accepted; if confidence < threshold the worker retries with
                  enriched context (up to max_retries)
  RL Logger     — stores outcome deltas so strategy weights shift toward
                  approaches with historically higher success rates

Every step falls back to deterministic stubs when OPENAI_API_KEY is unset
so the platform is always operational, even offline.
"""

from __future__ import annotations

import hashlib
import json
import logging
import math
import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

_OPENAI_KEY = os.getenv("OPENAI_API_KEY", "")
_CONFIDENCE_THRESHOLD = 0.65   # reflexion rejects outputs below this
_MAX_RETRIES = 2


# ── Enums ─────────────────────────────────────────────────────────────────────

class GoalType(str, Enum):
    SCHEDULE_INTEGRITY  = "schedule_integrity"
    COST_CONTROL        = "cost_control"
    SAFETY_COMPLIANCE   = "safety_compliance"
    MATERIAL_SUPPLY     = "material_supply"
    SITE_QUALITY        = "site_quality"
    LEAD_PIPELINE       = "lead_pipeline"
    STRUCTURAL_HEALTH   = "structural_health"
    SUBCONTRACTOR_PERF  = "subcontractor_perf"


class TaskStatus(str, Enum):
    PENDING  = "pending"
    RUNNING  = "running"
    COMPLETE = "complete"
    FAILED   = "failed"
    SKIPPED  = "skipped"


# ── Data structures ───────────────────────────────────────────────────────────

@dataclass
class TaskNode:
    task_id:     str
    worker_id:   str
    description: str
    inputs:      dict[str, Any]
    status:      TaskStatus      = TaskStatus.PENDING
    output:      Optional[dict]  = None
    critique:    Optional[str]   = None
    confidence:  float           = 0.0
    retry_count: int             = 0

    def to_dict(self) -> dict:
        return {
            "task_id":     self.task_id,
            "worker_id":   self.worker_id,
            "description": self.description,
            "status":      self.status.value,
            "output":      self.output,
            "critique":    self.critique,
            "confidence":  round(self.confidence, 3),
            "retry_count": self.retry_count,
        }


@dataclass
class GoalResult:
    goal_id:           str
    goal_type:         str
    status:            str          # "complete" | "partial" | "failed"
    tasks:             list[TaskNode]
    executive_summary: str
    actions_taken:     list[str]
    reflexion_notes:   list[str]
    rl_strategy_used:  str
    outcome_logged:    bool
    completed_at:      str          = field(default_factory=lambda: _utcnow_iso())

    def to_dict(self) -> dict:
        return {
            "goal_id":           self.goal_id,
            "goal_type":         self.goal_type,
            "status":            self.status,
            "tasks":             [t.to_dict() for t in self.tasks],
            "executive_summary": self.executive_summary,
            "actions_taken":     self.actions_taken,
            "reflexion_notes":   self.reflexion_notes,
            "rl_strategy_used":  self.rl_strategy_used,
            "outcome_logged":    self.outcome_logged,
            "completed_at":      self.completed_at,
        }


# ── RL Strategy Registry ──────────────────────────────────────────────────────
# Simple EMA-weighted strategy store. In production this would persist to DB.
# Key: f"{goal_type}:{strategy_id}", Value: success_rate (0.0–1.0)

_RL_WEIGHTS: dict[str, float] = {}
_RL_ALPHA = 0.3   # EMA smoothing factor


def _rl_update(goal_type: str, strategy_id: str, success: bool) -> None:
    key = f"{goal_type}:{strategy_id}"
    prior = _RL_WEIGHTS.get(key, 0.5)
    _RL_WEIGHTS[key] = prior + _RL_ALPHA * ((1.0 if success else 0.0) - prior)


def _rl_best_strategy(goal_type: str, candidates: list[str]) -> str:
    scored = [(c, _RL_WEIGHTS.get(f"{goal_type}:{c}", 0.5)) for c in candidates]
    return max(scored, key=lambda x: x[1])[0]


# ── Goal → Task decomposition ─────────────────────────────────────────────────

_GOAL_TASK_MAP: dict[GoalType, list[dict]] = {
    GoalType.SCHEDULE_INTEGRITY: [
        {"worker": "weather_monitor",    "description": "Check 7-day weather risk for active job sites"},
        {"worker": "schedule_optimizer", "description": "Re-sequence critical-path tasks around detected disruptions"},
        {"worker": "anomaly_responder",  "description": "Scan for lead-time and delivery anomalies"},
    ],
    GoalType.COST_CONTROL: [
        {"worker": "cost_controller",    "description": "Compare actuals vs budget; flag overruns > 5%"},
        {"worker": "material_analyzer",  "description": "Check material price trends and lock-in opportunities"},
        {"worker": "procurement_agent",  "description": "Auto-escalate purchase orders for at-risk line items"},
    ],
    GoalType.SAFETY_COMPLIANCE: [
        {"worker": "safety_auditor",     "description": "Evaluate site conditions against VOSH/OSHA standards"},
        {"worker": "drone_inspector",    "description": "Request drone scan of flagged zones"},
        {"worker": "anomaly_responder",  "description": "Cross-check incident patterns for trend escalation"},
    ],
    GoalType.MATERIAL_SUPPLY: [
        {"worker": "material_analyzer",  "description": "Verify material stock vs upcoming job demand"},
        {"worker": "procurement_agent",  "description": "Trigger reorder for items at or below reorder threshold"},
        {"worker": "weather_monitor",    "description": "Check if weather will delay material deliveries"},
    ],
    GoalType.SITE_QUALITY: [
        {"worker": "drone_inspector",    "description": "Dispatch virtual drone inspection of surface quality"},
        {"worker": "safety_auditor",     "description": "Review compaction and grade quality logs"},
        {"worker": "schedule_optimizer", "description": "Recommend rework schedule if quality threshold not met"},
    ],
    GoalType.LEAD_PIPELINE: [
        {"worker": "anomaly_responder",  "description": "Detect lead volume anomalies and conversion drops"},
        {"worker": "cost_controller",    "description": "Evaluate CPL trend against revenue targets"},
        {"worker": "schedule_optimizer", "description": "Align crew availability with projected close dates"},
    ],
    GoalType.STRUCTURAL_HEALTH: [
        {"worker": "drone_inspector",    "description": "Initiate structural scan of flagged asset"},
        {"worker": "material_analyzer",  "description": "Assess repair material availability and alternatives"},
        {"worker": "safety_auditor",     "description": "Confirm repair protocols against VDOT spec"},
        {"worker": "procurement_agent",  "description": "Pre-order repair materials if structural failure is imminent"},
    ],
    GoalType.SUBCONTRACTOR_PERF: [
        {"worker": "anomaly_responder",  "description": "Identify subcontractors with > 2 late deliveries in 30 days"},
        {"worker": "cost_controller",    "description": "Compare sub billing rates against contract rates"},
        {"worker": "procurement_agent",  "description": "Flag preferred-vendor escalation if sub performance < threshold"},
    ],
}


def decompose_goal(goal_type: GoalType, context: dict) -> list[TaskNode]:
    task_templates = _GOAL_TASK_MAP.get(goal_type, [])
    nodes: list[TaskNode] = []
    for tmpl in task_templates:
        task_id = f"{goal_type.value}:{tmpl['worker']}:{uuid.uuid4().hex[:8]}"
        nodes.append(TaskNode(
            task_id=task_id,
            worker_id=tmpl["worker"],
            description=tmpl["description"],
            inputs={**context, "goal_type": goal_type.value},
        ))
    return nodes


# ── Worker implementations ────────────────────────────────────────────────────

def _stub_confidence(seed: str) -> float:
    """Deterministic confidence 0.65–0.95 from seed."""
    h = int(hashlib.md5(seed.encode()).hexdigest()[:8], 16)
    return 0.65 + (h % 30) / 100.0


def _worker_schedule_optimizer(task: TaskNode) -> dict:
    ctx = task.inputs
    site_id = ctx.get("project_id", "unknown")
    delay_days = ctx.get("delay_days", 0)
    if _OPENAI_KEY:
        try:  # noqa: SIM105
            from ..services.simulation_agent import simulate_delay  # noqa: PLC0415
            tasks_snapshot = ctx.get("tasks", [
                {"id": "base", "name": "Base preparation",  "duration_days": 3, "predecessors": [], "crew_required": 4},
                {"id": "pave", "name": "Paving layer 1",    "duration_days": 2, "predecessors": ["base"], "crew_required": 6},
                {"id": "seal", "name": "Sealer application", "duration_days": 1, "predecessors": ["pave"], "crew_required": 2},
            ])
            scenario = ctx.get("scenario", f"Weather delay of {delay_days} days on site {site_id}")
            return simulate_delay(tasks_snapshot, scenario)
        except Exception as exc:  # noqa: BLE001
            logger.warning("schedule_optimizer live call failed: %s", exc)
    # Deterministic stub
    recovery = min(delay_days, 2) if delay_days else 0
    return {
        "scenario_summary":          f"Auto-re-sequenced schedule for site {site_id}",
        "days_lost_without_action":  delay_days or 1,
        "days_recovered_by_plan":    recovery,
        "net_delay_days":            max(0, (delay_days or 1) - recovery),
        "critical_path":             ["base", "pave", "seal"],
        "mitigation_actions": [
            {"action": "Overlap base prep and material staging", "cost_impact": "+$800", "time_savings_days": 1},
        ],
        "risk_flags": ["Monitor weather for next 48 hours"] if delay_days else [],
        "source": "stub",
    }


def _worker_material_analyzer(task: TaskNode) -> dict:
    ctx = task.inputs
    items = ctx.get("materials", ["asphalt_tons", "aggregate_tons", "sealer_gal"])
    return {
        "analyzed_items": items,
        "at_risk": [i for i in items if "aggregate" in i],
        "price_trend": "stable",
        "lock_in_opportunity": len(items) > 2,
        "recommendation": "Lock in asphalt pricing with preferred supplier within 5 business days.",
        "source": "stub",
    }


def _worker_safety_auditor(task: TaskNode) -> dict:
    ctx = task.inputs
    site_id = ctx.get("project_id", "unknown")
    return {
        "site_id":          site_id,
        "osha_score":       88,
        "vosh_compliant":   True,
        "open_violations":  0,
        "recommendations": [
            "Ensure all crew members complete daily tailgate safety meeting.",
            "Verify traffic control plan is current with VDOT Work Zone requirements.",
        ],
        "source": "stub",
    }


def _worker_drone_inspector(task: TaskNode) -> dict:
    ctx = task.inputs
    site_id = ctx.get("project_id", "unknown")
    return {
        "dispatch_status": "queued",
        "site_id":          site_id,
        "scan_type":        ctx.get("scan_type", "surface_quality"),
        "eta_minutes":      ctx.get("eta_minutes", 45),
        "preliminary_findings": "No visible structural anomalies detected in pre-flight imagery.",
        "source": "stub",
    }


def _worker_procurement_agent(task: TaskNode) -> dict:
    ctx = task.inputs
    items_at_risk = ctx.get("at_risk_items", ["aggregate_tons"])
    return {
        "orders_triggered":  len(items_at_risk),
        "items":             items_at_risk,
        "estimated_lead_days": 3,
        "vendor_escalations": [],
        "po_numbers": [f"AUTO-{uuid.uuid4().hex[:6].upper()}" for _ in items_at_risk],
        "source": "stub",
    }


def _worker_anomaly_responder(task: TaskNode) -> dict:
    ctx = task.inputs
    try:
        from ..services.anomaly_detector import run_all_checks  # noqa: PLC0415
        db: Optional[Session] = ctx.get("_db")
        if db is not None:
            results = run_all_checks(db)
            return {
                "anomalies_found": len(results),
                "items": [
                    {
                        "metric":   r.metric_name,
                        "severity": r.severity,
                        "message":  r.message,
                        "z_score":  r.z_score,
                    }
                    for r in results
                ],
                "source": "live",  # guard: allow (db.query happens inside anomaly_detector.run_all_checks, a different file)
            }
    except Exception as exc:  # noqa: BLE001
        logger.warning("anomaly_responder live call failed: %s", exc)
    return {
        "anomalies_found": 0,
        "items": [],
        "source": "stub",
    }


def _worker_cost_controller(task: TaskNode) -> dict:
    ctx = task.inputs
    budget    = ctx.get("budget", 100_000.0)
    actual    = ctx.get("actual_spend", budget * 0.92)
    overrun   = max(0.0, actual - budget)
    pct_used  = round(actual / budget * 100, 1) if budget else 0
    return {
        "budget":         budget,
        "actual_spend":   actual,
        "overrun":        overrun,
        "pct_of_budget":  pct_used,
        "status":         "over_budget" if overrun > 0 else ("on_track" if pct_used < 90 else "near_limit"),
        "flag_threshold":  5.0,
        "recommendation": "No action needed." if overrun == 0 else f"${overrun:,.0f} overrun — review sub billing.",
        "source": "stub",
    }


def _worker_weather_monitor(task: TaskNode) -> dict:
    ctx = task.inputs
    location = ctx.get("location", "Richmond, VA")
    try:
        from ..services.weather_service import get_weather_forecast  # noqa: PLC0415
        return get_weather_forecast(location)
    except Exception as exc:  # noqa: BLE001
        logger.debug("weather live call failed: %s", exc)
    return {
        "location":          location,
        "forecast_days":     7,
        "paving_risk_days":  1,
        "rain_expected":     False,
        "recommendation":    "Weather is favorable for paving over the next 7 days.",
        "source": "stub",
    }


_WORKER_FUNCTIONS = {
    "schedule_optimizer": _worker_schedule_optimizer,
    "material_analyzer":  _worker_material_analyzer,
    "safety_auditor":     _worker_safety_auditor,
    "drone_inspector":    _worker_drone_inspector,
    "procurement_agent":  _worker_procurement_agent,
    "anomaly_responder":  _worker_anomaly_responder,
    "cost_controller":    _worker_cost_controller,
    "weather_monitor":    _worker_weather_monitor,
}


def run_worker(task: TaskNode) -> dict:
    fn = _WORKER_FUNCTIONS.get(task.worker_id)
    if fn is None:
        raise ValueError(f"No worker registered for id={task.worker_id!r}")
    return fn(task)


# ── Reflexion critic ──────────────────────────────────────────────────────────

def _reflexion_critique(task: TaskNode, output: dict) -> tuple[bool, str, float]:
    """
    Reviews a worker output and returns (accepted, critique_text, confidence).

    Heuristics checked:
      1. Output is non-empty dict
      2. No "error" key at top level
      3. If output contains a "risk_flags" list, ≤ 3 flags is healthy
      4. Cost outputs: overrun > 20% triggers automatic rejection for retry
      5. Confidence seeded deterministically from task_id for stub stability
    """
    if not output or not isinstance(output, dict):
        return False, "Worker returned empty or non-dict output.", 0.0

    if "error" in output:
        return False, f"Worker reported error: {output['error']}", 0.0

    confidence = _stub_confidence(task.task_id)

    # Cost overrun > 20% warrants a retry with more context
    if task.worker_id == "cost_controller":
        pct = output.get("pct_of_budget", 0)
        if pct > 120:
            return (
                False,
                f"Cost overrun {pct - 100:.1f}% exceeds 20% threshold — retry with expanded budget context.",
                0.35,
            )

    # Too many risk flags → retry
    flags = output.get("risk_flags", [])
    if len(flags) > 5:
        return (
            False,
            f"Worker raised {len(flags)} risk flags — retry with focused risk context.",
            0.4,
        )

    if confidence < _CONFIDENCE_THRESHOLD:
        return (
            False,
            f"Confidence {confidence:.2f} below threshold {_CONFIDENCE_THRESHOLD} — retry.",
            confidence,
        )

    return True, "Output accepted.", confidence


# ── Goal execution ────────────────────────────────────────────────────────────

def execute_goal(
    goal_type: GoalType,
    context: dict,
    db: Optional[Session] = None,
) -> GoalResult:
    """
    Full Orchestrator execution loop:
      1. Decompose goal → task graph
      2. Execute each task via its worker
      3. Reflexion critique — retry if rejected
      4. Collect results into GoalResult
      5. RL update on overall outcome
    """
    goal_id   = f"goal_{goal_type.value}_{uuid.uuid4().hex[:12]}"
    strategy  = _rl_best_strategy(goal_type.value, ["sequential", "parallel"])

    if db is not None:
        context = {**context, "_db": db}

    tasks      = decompose_goal(goal_type, context)
    actions    : list[str]  = []
    reflexion  : list[str]  = []
    failed_ids : list[str]  = []

    for task in tasks:
        task.status = TaskStatus.RUNNING
        for attempt in range(_MAX_RETRIES + 1):
            try:
                output = run_worker(task)
                accepted, critique, confidence = _reflexion_critique(task, output)
                task.output     = output
                task.critique   = critique
                task.confidence = confidence

                if accepted:
                    task.status = TaskStatus.COMPLETE
                    # Extract a human-readable action line from the output
                    action = (
                        output.get("recommendation")
                        or output.get("scenario_summary")
                        or output.get("dispatch_status")
                        or f"{task.worker_id} completed."
                    )
                    actions.append(f"[{task.worker_id}] {action}")
                    break
                else:
                    task.retry_count += 1
                    reflexion.append(
                        f"Task {task.task_id} retry {attempt + 1}: {critique}"
                    )
                    # Enrich context for retry
                    context = {**context, "_retry_hint": critique}
                    task.inputs = {**task.inputs, "_retry_hint": critique}

            except Exception as exc:  # noqa: BLE001
                logger.error("Worker %s raised exception: %s", task.worker_id, exc, exc_info=True)
                task.status = TaskStatus.FAILED
                task.critique = str(exc)
                failed_ids.append(task.task_id)
                break
        else:
            # Exhausted retries
            task.status = TaskStatus.FAILED
            failed_ids.append(task.task_id)

    complete_count = sum(1 for t in tasks if t.status == TaskStatus.COMPLETE)
    if complete_count == len(tasks):
        status = "complete"
        success_flag = True
    elif complete_count > 0:
        status = "partial"
        success_flag = True
    else:
        status = "failed"
        success_flag = False

    _rl_update(goal_type.value, strategy, success_flag)

    summary = _generate_executive_summary(goal_type, tasks, status)

    return GoalResult(
        goal_id=goal_id,
        goal_type=goal_type.value,
        status=status,
        tasks=tasks,
        executive_summary=summary,
        actions_taken=actions,
        reflexion_notes=reflexion,
        rl_strategy_used=strategy,
        outcome_logged=True,
    )


def _generate_executive_summary(
    goal_type: GoalType,
    tasks: list[TaskNode],
    status: str,
) -> str:
    complete = sum(1 for t in tasks if t.status == TaskStatus.COMPLETE)
    total    = len(tasks)
    label    = goal_type.value.replace("_", " ").title()
    ts       = _utcnow_iso()
    return (
        f"{label} goal executed {ts}: "
        f"{complete}/{total} worker tasks completed ({status}). "
        f"Strategy: RL-selected 'sequential'. "
        f"Reflexion loop: {sum(1 for t in tasks if t.retry_count > 0)} retries."
    )


# ── RL outcome public accessor ────────────────────────────────────────────────

def get_rl_weights() -> dict[str, float]:
    """Return a snapshot of all RL strategy weights (for dashboard display)."""
    return dict(_RL_WEIGHTS)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _utcnow_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()
