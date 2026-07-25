"""
predictive_capital.py — Shadow-mode predictive capital intelligence endpoints.
"""

from typing import Any

from fastapi import APIRouter, Depends, Query, Request

from ..core.limiter import limiter
from ..core.security import verify_premium_security
from ..services.math_ai_service import math_ai

router = APIRouter(prefix="/api/v1/predictive-capital", tags=["predictive-capital"])


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


@router.get("/shadow-forecast", summary="Predictive capital shadow forecast")
@limiter.limit("60/minute")
async def shadow_forecast(
    request: Request,
    planned_budget_usd: float = Query(..., gt=0),
    planned_duration_days: int = Query(..., ge=1, le=5000),
    project_sqft: float = Query(default=5000, gt=100, le=200000000),
    service_type: str = Query(default="paving"),
    state: str = Query(default="US", min_length=2, max_length=2),
    labor_tightness: float = Query(default=0.5, ge=0.0, le=1.0),
    weather_risk: float = Query(default=0.4, ge=0.0, le=1.0),
    supply_chain_risk: float = Query(default=0.4, ge=0.0, le=1.0),
    _: dict = Depends(verify_premium_security),
) -> dict[str, Any]:
    """
    Return a shadow-mode risk-adjusted forecast for budget and duration.

    This endpoint is advisory-only and does not auto-commit spending actions.
    """
    baseline = math_ai.estimate_project_cost(
        sqft=project_sqft,
        service_type=service_type,
        state=state.upper(),
    )

    l = _clamp01(labor_tightness)
    w = _clamp01(weather_risk)
    s = _clamp01(supply_chain_risk)

    budget_risk_factor = 1.0 + (0.18 * l) + (0.12 * w) + (0.15 * s)
    duration_risk_factor = 1.0 + (0.25 * l) + (0.20 * w) + (0.18 * s)

    baseline_mid = float(baseline.get("mid_usd") or planned_budget_usd)
    baseline_anchor = max(planned_budget_usd, baseline_mid)

    risk_adjusted_budget = int(round(baseline_anchor * budget_risk_factor))
    risk_adjusted_duration_days = int(
        round(planned_duration_days * duration_risk_factor)
    )

    budget_delta = risk_adjusted_budget - int(round(planned_budget_usd))
    duration_delta_days = risk_adjusted_duration_days - int(planned_duration_days)

    confidence = round(max(0.55, 0.86 - (0.12 * (l + w + s) / 3.0)), 3)
    confidence_band = {
        "budget_low_usd": int(round(risk_adjusted_budget * 0.92)),
        "budget_high_usd": int(round(risk_adjusted_budget * 1.08)),
        "duration_low_days": int(round(risk_adjusted_duration_days * 0.90)),
        "duration_high_days": int(round(risk_adjusted_duration_days * 1.12)),
    }

    recommendations: list[dict[str, Any]] = []
    if s >= 0.6:
        recommendations.append(
            {
                "action": "Activate alternate supplier lane",
                "impact": "Reduces schedule slip risk from materials",
                "priority": "high",
            }
        )
    if l >= 0.6:
        recommendations.append(
            {
                "action": "Pre-book cross-state labor contingency",
                "impact": "Reduces crew shortage delay exposure",
                "priority": "high",
            }
        )
    if w >= 0.6:
        recommendations.append(
            {
                "action": "Weather-buffer critical path sequencing",
                "impact": "Reduces storm-driven idle days",
                "priority": "medium",
            }
        )
    if not recommendations:
        recommendations.append(
            {
                "action": "Proceed with current baseline plan",
                "impact": "Risk profile is currently moderate",
                "priority": "medium",
            }
        )

    return {
        "status": "ok",
        "mode": "shadow",
        "inputs": {
            "planned_budget_usd": planned_budget_usd,
            "planned_duration_days": planned_duration_days,
            "project_sqft": project_sqft,
            "service_type": service_type,
            "state": state.upper(),
            "labor_tightness": l,
            "weather_risk": w,
            "supply_chain_risk": s,
        },
        "baseline": {
            "cost_mid_usd": int(round(baseline_mid)),
            "cost_low_usd": int(baseline.get("low_usd") or baseline_mid),
            "cost_high_usd": int(baseline.get("high_usd") or baseline_mid),
        },
        "risk_adjusted": {
            "budget_usd": risk_adjusted_budget,
            "duration_days": risk_adjusted_duration_days,
            "budget_delta_usd": budget_delta,
            "duration_delta_days": duration_delta_days,
        },
        "confidence": confidence,
        "confidence_band": confidence_band,
        "recommendations": recommendations,
    }
