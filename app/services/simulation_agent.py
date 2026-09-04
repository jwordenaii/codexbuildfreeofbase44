"""
simulation_agent.py — Agentic "What-If" schedule simulator for JWordenAI.

Uses GPT-4o to simulate delay scenarios and recommend schedule adjustments.
No langgraph or pydantic-ai required — runs directly against the OpenAI API.

The agent:
  1. Receives a project snapshot (tasks, durations, dependencies)
  2. Accepts a disruption scenario (weather, supply delay, crew shortage, etc.)
  3. Runs a multi-step reasoning loop to re-sequence and compress the schedule
  4. Returns: revised timeline, critical path warnings, and mitigation actions

Falls back to a deterministic rule-based rescheduler when OPENAI_API_KEY is unset.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Optional

logger = logging.getLogger(__name__)

_OPENAI_KEY = os.getenv("OPENAI_API_KEY", "")

_SYSTEM_PROMPT = """\
You are ScheduleAI, an expert construction project scheduler and risk analyst for J. Worden & Sons Paving.

You receive a project schedule (JSON list of tasks with id, name, duration_days, predecessors, crew_required) \
and a disruption scenario.

Your job:
1. Identify all tasks impacted by the disruption (direct and downstream via dependency chain).
2. Propose the optimal re-sequence to recover the most schedule days.
3. Identify the new critical path.
4. List concrete mitigation actions (crew additions, overtime, material pre-ordering, etc.).
5. Calculate the new projected completion date.

Respond ONLY with valid JSON in this exact shape:
{
  "scenario_summary": "string",
  "days_lost_without_action": number,
  "days_recovered_by_plan": number,
  "net_delay_days": number,
  "new_completion_estimate": "YYYY-MM-DD",
  "critical_path": ["task_id_1", "task_id_2"],
  "impacted_tasks": [{"id": "...", "original_end": "...", "revised_end": "...", "reason": "..."}],
  "mitigation_actions": [{"action": "...", "cost_impact": "...", "time_savings_days": number}],
  "risk_flags": ["string"]
}
"""


def simulate_delay(
    tasks: list[dict[str, Any]],
    scenario: str,
    project_start: Optional[str] = None,
) -> dict:
    """
    Run a what-if delay simulation.

    Args:
        tasks:          List of task dicts with keys: id, name, duration_days,
                        predecessors (list of task ids), crew_required (int).
        scenario:       Plain-English disruption description, e.g.
                        "3-day rain delay starting Day 5 affecting all outdoor work".
        project_start:  ISO date string for Day 0 (defaults to today).

    Returns:
        Structured simulation result dict (see _SYSTEM_PROMPT for shape).
    """
    if not project_start:
        from datetime import date
        project_start = date.today().isoformat()

    user_content = json.dumps({
        "project_start": project_start,
        "tasks": tasks,
        "disruption_scenario": scenario,
    }, indent=2)

    if _OPENAI_KEY:
        return _run_ai_simulation(user_content)
    return _rule_based_simulation(tasks, scenario, project_start)


def _run_ai_simulation(user_content: str) -> dict:
    """Call GPT-4o for intelligent what-if analysis."""
    try:
        from .llm_client import chat as llm_chat  # noqa: PLC0415

        response = llm_chat(
            task="reasoning",
            system=_SYSTEM_PROMPT + "\nReturn ONLY the raw JSON object — no markdown fences.",
            user=user_content,
            temperature=0.2,
            max_tokens=1200,
        )
        if response.error:
            raise RuntimeError(response.error_detail or "no LLM provider available")
        raw = (response.text or "").strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        result = json.loads(raw)
        result["_source"] = f"{response.provider}:{response.model}"
        return result
    except Exception as exc:
        logger.error("AI simulation failed: %s", exc)
        # Parse tasks back for fallback
        try:
            payload = json.loads(user_content)
            return _rule_based_simulation(
                payload.get("tasks", []),
                payload.get("disruption_scenario", ""),
                payload.get("project_start", ""),
            )
        except Exception:
            return {"error": str(exc), "_source": "error"}


def _rule_based_simulation(
    tasks: list[dict],
    scenario: str,
    project_start: str,
) -> dict:
    """
    Deterministic rule-based fallback when no OpenAI key is available.

    Logic: estimate delay days from keywords in scenario string, shift all
    tasks forward by that amount, flag outdoor tasks as impacted.
    """
    from datetime import date, timedelta

    delay_days = 0
    scenario_lower = scenario.lower()
    if any(w in scenario_lower for w in ["week", "7 day"]):
        delay_days = 7
    elif any(w in scenario_lower for w in ["day", "24 hour"]):
        # extract first number
        import re
        nums = re.findall(r"\d+", scenario)
        delay_days = int(nums[0]) if nums else 3
    else:
        delay_days = 3

    try:
        start = date.fromisoformat(project_start)
    except ValueError:
        start = date.today()

    total_duration = sum(t.get("duration_days", 0) for t in tasks)
    original_end = start + timedelta(days=total_duration)
    new_end = original_end + timedelta(days=delay_days)

    impacted = [
        {
            "id": t.get("id", str(i)),
            "original_end": (start + timedelta(days=sum(tt.get("duration_days", 0) for tt in tasks[:i+1]))).isoformat(),
            "revised_end": (start + timedelta(days=sum(tt.get("duration_days", 0) for tt in tasks[:i+1]) + delay_days)).isoformat(),
            "reason": "Downstream shift from disruption",
        }
        for i, t in enumerate(tasks)
    ]

    return {
        "scenario_summary": scenario,
        "days_lost_without_action": delay_days,
        "days_recovered_by_plan": 0,
        "net_delay_days": delay_days,
        "new_completion_estimate": new_end.isoformat(),
        "critical_path": [t.get("id", str(i)) for i, t in enumerate(tasks)],
        "impacted_tasks": impacted,
        "mitigation_actions": [
            {
                "action": "Add overtime shifts to critical-path crews",
                "cost_impact": "Est. +10-15% labor cost",
                "time_savings_days": max(1, delay_days // 2),
            }
        ],
        "risk_flags": [
            "Rule-based estimate only — set OPENAI_API_KEY for AI-powered analysis.",
            f"Scenario: {scenario}",
        ],
        "_source": "rule-based",
    }
