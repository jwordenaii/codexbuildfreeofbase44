"""
math_ai.py — Mathematical AI REST router for JWordenAI.

Routes
──────
  POST /api/v1/math-ai/pavement-score      — Score pavement condition (public)
  POST /api/v1/math-ai/cost-estimate       — Estimate project cost (public)
  POST /api/v1/math-ai/lead-quality        — Predict lead quality (admin only)
  POST /api/v1/math-ai/maintenance-forecast — Forecast maintenance schedule (public)

Auth
────
  pavement-score, cost-estimate, maintenance-forecast — no auth required
  lead-quality — requires bearer token (verify_premium_security)

Rate limits
───────────
  Public endpoints  : 30/minute
  Protected endpoint: 20/minute
"""

from __future__ import annotations

import logging
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from ..core.limiter import limiter
from ..core.security import verify_premium_security
from ..services.math_ai_service import math_ai

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/math-ai", tags=["math-ai"])


# ── Request / Response schemas ────────────────────────────────────────────────

class PavementScoreRequest(BaseModel):
    """Input for pavement condition scoring."""

    age: float = Field(
        ...,
        ge=0,
        le=100,
        description="Pavement age in years",
        examples=[8],
    )
    cracks: float = Field(
        ...,
        ge=0,
        le=100,
        description="Percentage of surface area showing cracking (0-100)",
        examples=[15.0],
    )
    potholes: int = Field(
        ...,
        ge=0,
        le=500,
        description="Number of potholes per 1,000 sq ft",
        examples=[2],
    )
    traffic: Literal["low", "medium", "high", "very_high"] = Field(
        default="medium",
        description="Traffic load category",
        examples=["medium"],
    )


class CostEstimateRequest(BaseModel):
    """Input for project cost estimation."""

    sqft: float = Field(
        ...,
        gt=0,
        le=10_000_000,
        description="Project area in square feet",
        examples=[5000],
    )
    service_type: str = Field(
        ...,
        min_length=2,
        max_length=64,
        description=(
            "Service type: paving | sealcoating | crackfill | parking_lot | "
            "driveway | maintenance | overlay | reconstruction | striping | patching"
        ),
        examples=["paving"],
    )
    state: str = Field(
        default="US",
        min_length=2,
        max_length=2,
        description="2-letter US state abbreviation (or 'US' for national average)",
        examples=["VA"],
    )

    @field_validator("state")
    @classmethod
    def _upper_state(cls, v: str) -> str:
        return v.upper().strip()


class LeadQualityRequest(BaseModel):
    """Input for lead quality prediction."""

    project_size_sqft: Optional[float] = Field(
        default=None,
        ge=0,
        description="Project area in square feet",
        examples=[8500],
    )
    property_type: Optional[Literal["residential", "commercial"]] = Field(
        default="residential",
        description="Property type",
        examples=["commercial"],
    )
    urgency: Optional[Literal["asap", "within_1_week", "within_1_month", "flexible"]] = Field(
        default="flexible",
        description="Project urgency",
        examples=["within_1_week"],
    )
    service_type: Optional[str] = Field(
        default=None,
        max_length=64,
        description="Requested service type",
        examples=["parking_lot"],
    )
    state_code: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=2,
        description="2-letter US state abbreviation",
        examples=["TX"],
    )

    @field_validator("state_code")
    @classmethod
    def _upper_state(cls, v: Optional[str]) -> Optional[str]:
        return v.upper().strip() if v else v


class MaintenanceForecastRequest(BaseModel):
    """Input for maintenance schedule forecasting."""

    pavement_age: float = Field(
        ...,
        ge=0,
        le=80,
        description="Current pavement age in years",
        examples=[6],
    )
    condition: float = Field(
        ...,
        ge=0,
        le=100,
        description="Current PCI score (0-100). Use pavement-score endpoint to compute this.",
        examples=[72],
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "/pavement-score",
    summary="Score pavement condition",
    response_description="PCI score (0-100) with condition label and recommended action",
)
@limiter.limit("30/minute")
async def pavement_score(
    request: Request,
    req: PavementScoreRequest,
) -> dict[str, Any]:
    """
    Compute a Pavement Condition Index (PCI) score on a 0-100 scale using a
    physics-informed weighted decay model calibrated against ASTM D6433.

    **No authentication required** — suitable for customer-facing tools.

    | Score | Condition  | Typical action                        |
    |-------|------------|---------------------------------------|
    | 85-100 | Excellent | Routine inspection                   |
    | 70-84  | Good      | Preventive sealcoating                |
    | 55-69  | Fair      | Crack filling + sealcoating           |
    | 40-54  | Poor      | Mill-and-overlay / structural patching|
    | 25-39  | Very Poor | Full-depth reclamation                |
    | 0-24   | Failed    | Immediate reconstruction              |
    """
    try:
        result = math_ai.score_pavement_condition(
            age=req.age,
            cracks=req.cracks,
            potholes=req.potholes,
            traffic=req.traffic,
        )
        return {"status": "ok", **result}
    except Exception as exc:
        logger.error("pavement_score error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Pavement scoring failed") from exc


@router.post(
    "/cost-estimate",
    summary="Estimate project cost",
    response_description="Low / mid / high cost range with 95% confidence interval",
)
@limiter.limit("30/minute")
async def cost_estimate(
    request: Request,
    req: CostEstimateRequest,
) -> dict[str, Any]:
    """
    Estimate project cost with a SciPy-derived 95 % confidence interval.
    Regional multipliers are applied for all 50 US states.

    **No authentication required** — suitable for customer-facing quote tools.

    Supported service types: `paving`, `sealcoating`, `crackfill`,
    `parking_lot`, `driveway`, `maintenance`, `overlay`, `reconstruction`,
    `striping`, `patching`.
    """
    try:
        result = math_ai.estimate_project_cost(
            sqft=req.sqft,
            service_type=req.service_type,
            state=req.state,
        )
        return {"status": "ok", **result}
    except Exception as exc:
        logger.error("cost_estimate error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Cost estimation failed") from exc


@router.post(
    "/lead-quality",
    summary="Predict lead quality (admin only)",
    response_description="HOT / WARM / COOL classification with probability vector",
)
@limiter.limit("20/minute")
async def lead_quality(
    request: Request,
    req: LeadQualityRequest,
    _: dict = Depends(verify_premium_security),
) -> dict[str, Any]:
    """
    Predict lead quality using a pre-trained Gradient Boosting Classifier.
    Returns a HOT / WARM / COOL label with per-class probabilities and a
    follow-up SLA recommendation.

    **Requires bearer token** — internal use only.

    | Label | Priority | Follow-up SLA          |
    |-------|----------|------------------------|
    | HOT   | 1        | Call within 1 hour     |
    | WARM  | 2        | Call same business day |
    | COOL  | 3        | Call within 48 hours   |
    """
    try:
        result = math_ai.predict_lead_quality(req.model_dump())
        return {"status": "ok", **result}
    except Exception as exc:
        logger.error("lead_quality error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Lead quality prediction failed") from exc


@router.post(
    "/maintenance-forecast",
    summary="Forecast maintenance schedule",
    response_description="Projected PCI trajectory and next service dates",
)
@limiter.limit("30/minute")
async def maintenance_forecast(
    request: Request,
    req: MaintenanceForecastRequest,
) -> dict[str, Any]:
    """
    Forecast the next maintenance milestones using an exponential decay model
    of pavement deterioration: **PCI(t) = 100 × e^(−k·t)**.

    The decay constant *k* is fitted from the current pavement age and PCI
    score.  The model projects PCI at 1, 3, and 5 years and calculates the
    date at which the PCI crosses each service threshold.

    **No authentication required** — suitable for customer-facing tools.

    Tip: use the `/pavement-score` endpoint first to obtain the current PCI,
    then pass it here as `condition`.
    """
    try:
        result = math_ai.forecast_maintenance_schedule(
            pavement_age=req.pavement_age,
            condition=req.condition,
        )
        return {"status": "ok", **result}
    except Exception as exc:
        logger.error("maintenance_forecast error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Maintenance forecasting failed") from exc
