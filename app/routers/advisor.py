"""
Advisor API endpoints for J. Worden & Sons.

Exposes:
  POST /api/v1/advisor/legal-strategy     — negotiation/lawyer recommender
  POST /api/v1/advisor/rank-contractors   — contractor bid ranking
  GET  /api/v1/advisor/top-states         — strongest states for a dispute type
  GET  /api/v1/advisor/license-optimizer  — best states for base license
  POST /api/v1/advisor/utility-risk       — Virginia 811 private-utility risk advisory
"""

from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..services.ai_brain import SupremeCourtAI
from ..services.contractor_ranker import (
    ContractorBid,
    optimize_license_states,
    rank_contractor_bids,
)
from ..services.lawyer_recommender import (
    DISPUTE_TYPES,
    ROLE_LABELS,
    find_strongest_states,
    rank_states_by_reciprocity,
    recommend_legal_strategy,
)
from ..services.state_data import get_state_summary, normalize_state_code

router = APIRouter(prefix="/api/v1/advisor", tags=["advisor"])


# ── Legal strategy ────────────────────────────────────────────────────────────


class LegalStrategyRequest(BaseModel):
    state: str = Field(
        ..., min_length=2, max_length=2, description="2-letter state abbreviation"
    )
    dispute_type: str = Field(
        ..., description="lien | payment | contract_breach | general"
    )
    role: str = Field(default="gc", description="gc | sub | supplier | owner")


class LegalQuestionRequest(BaseModel):
    state: str = Field(
        ..., min_length=2, max_length=2, description="2-letter state abbreviation"
    )
    question: str = Field(
        ...,
        min_length=8,
        max_length=1200,
        description="Freeform legal/compliance question",
    )
    role: str = Field(default="gc", description="gc | sub | supplier | owner")


class ProjectLegalScoreRequest(BaseModel):
    project_name: str = Field(..., min_length=2, max_length=200)
    state: str = Field(
        ..., min_length=2, max_length=2, description="2-letter state abbreviation"
    )
    status: str = Field(default="bid", description="bid | awarded")
    scope_summary: str = Field(..., min_length=5, max_length=1200)
    contract_value_usd: float = Field(default=0, ge=0)
    has_public_funding: bool = Field(default=False)


@router.post(
    "/legal-strategy",
    summary="Negotiation strength analysis and legal strategy recommendation",
)
def legal_strategy(req: LegalStrategyRequest):
    """
    Analyze the legal environment for a specific state + dispute type and return
    a negotiation strategy recommendation including strength scores, key actions,
    role-specific leverage points, and the top 5 most favorable alternative states.
    """
    rec = recommend_legal_strategy(
        state=req.state,
        dispute_type=req.dispute_type,
        role=req.role,
    )
    return {
        "status": "success",
        "state": rec.state,
        "state_name": rec.state_name,
        "dispute_type": rec.dispute_type,
        "role": rec.role,
        "scores": {
            "lien": rec.lien_score,
            "payment": rec.payment_score,
            "contract": rec.contract_score,
            "composite": rec.composite_score,
            "label": rec.strength_label,
            "color": rec.strength_color,
        },
        "strategy": {
            "title": rec.strategy_title,
            "description": rec.strategy_description,
            "key_actions": rec.key_actions,
            "role_leverage": rec.role_leverage,
            "state_specific_note": rec.state_specific_note,
            "weak_position_advice": rec.weak_position_advice,
            "citation_note": rec.citation_note,
        },
        "top_states_for_dispute": rec.top_states,
    }


@router.post(
    "/legal-qa",
    summary="Answer legal/compliance advisory questions for a jurisdiction",
)
def legal_qa(req: LegalQuestionRequest):
    """
    Deterministic legal/compliance Q&A for dashboard use.

    Returns structured advisory guidance using state strategy data plus
    compliance code analysis. This endpoint is advisory-only and does not
    replace licensed legal counsel.
    """
    state_code = normalize_state_code(req.state)
    if not state_code:
        return {
            "status": "error",
            "detail": f"Unknown state code '{req.state}'.",
            "advisory_notice": "Operational advisory only. Not legal advice.",
        }

    dispute_type = _infer_dispute_type(req.question)
    strategy = recommend_legal_strategy(
        state=state_code, dispute_type=dispute_type, role=req.role
    )
    compliance = SupremeCourtAI.analyze_codes(state_code, req.question)
    state_summary = get_state_summary(state_code) or {}

    answer_lines = [
        f"For {state_summary.get('name', state_code)}, strongest leverage is '{strategy.strategy_title}'.",
        f"Composite strategy strength is {strategy.composite_score}/100 ({strategy.strength_label}).",
    ]
    if compliance.get("liability_risk") == "HIGH":
        answer_lines.append(
            "Risk is HIGH for this scope. Require legal review before releasing bid terms."
        )
    elif compliance.get("liability_risk") == "MEDIUM":
        answer_lines.append(
            "Risk is MEDIUM. Add compliance and notice controls into your bid packet."
        )
    else:
        answer_lines.append(
            "Risk is LOW based on current scope, but keep standard legal controls in place."
        )

    return {
        "status": "success",
        "state": state_code,
        "question": req.question,
        "interpreted_dispute_type": dispute_type,
        "answer": " ".join(answer_lines),
        "scores": {
            "lien": strategy.lien_score,
            "payment": strategy.payment_score,
            "contract": strategy.contract_score,
            "composite": strategy.composite_score,
            "label": strategy.strength_label,
        },
        "strategy": {
            "title": strategy.strategy_title,
            "description": strategy.strategy_description,
            "key_actions": strategy.key_actions,
            "role_leverage": strategy.role_leverage,
        },
        "compliance": {
            "liability_risk": compliance.get("liability_risk"),
            "is_compliant": compliance.get("is_compliant"),
            "issues": compliance.get("issues", []),
            "recommendations": compliance.get("recommendations", []),
        },
        "citations": [
            "constructionLicensing",
            "mechanicsLienLaws",
            "promptPaymentLaws",
            "contractLaw",
            "workersSafety",
            "roadsAndPavingRegulations",
        ],
        "advisory_notice": "Operational advisory only. Not legal advice.",
    }


@router.post(
    "/project-legal-score",
    summary="Score legal/compliance posture for bid or awarded project",
)
def project_legal_score(req: ProjectLegalScoreRequest):
    """
    Project-level legal readiness score for bids and awarded jobs.
    """
    state_code = normalize_state_code(req.state)
    if not state_code:
        return {
            "status": "error",
            "detail": f"Unknown state code '{req.state}'.",
            "advisory_notice": "Operational advisory only. Not legal advice.",
        }

    status = _normalize_project_status(req.status)
    dispute_type = _infer_dispute_type(req.scope_summary)
    strategy = recommend_legal_strategy(
        state=state_code, dispute_type=dispute_type, role="gc"
    )
    compliance = SupremeCourtAI.analyze_codes(state_code, req.scope_summary)

    score = float(strategy.composite_score)
    adjustments = []

    if status == "awarded":
        score -= 4
        adjustments.append(
            {"reason": "awarded projects carry active execution liability", "delta": -4}
        )

    liability = compliance.get("liability_risk")
    if liability == "HIGH":
        score -= 25
        adjustments.append({"reason": "high liability risk from scope", "delta": -25})
    elif liability == "MEDIUM":
        score -= 10
        adjustments.append({"reason": "medium liability risk from scope", "delta": -10})
    else:
        score += 5
        adjustments.append({"reason": "low liability risk", "delta": 5})

    if req.has_public_funding and strategy.payment_score < 70:
        score -= 8
        adjustments.append(
            {"reason": "public funding with weaker payment posture", "delta": -8}
        )

    if req.contract_value_usd >= 500_000:
        score -= 6
        adjustments.append(
            {"reason": "high contract value increases legal exposure", "delta": -6}
        )

    final_score = max(0, min(100, round(score, 2)))
    risk_band = (
        "low" if final_score >= 80 else "medium" if final_score >= 60 else "high"
    )

    return {
        "status": "success",
        "project": {
            "name": req.project_name,
            "state": state_code,
            "status": status,
            "scope_summary": req.scope_summary,
            "contract_value_usd": req.contract_value_usd,
            "has_public_funding": req.has_public_funding,
        },
        "legal_score": {
            "value": final_score,
            "risk_band": risk_band,
            "strategy_composite": strategy.composite_score,
            "liability_risk": liability,
            "adjustments": adjustments,
        },
        "checklist": [
            "Confirm state licensing class alignment for contracted scope.",
            "Validate lien, notice, and payment clause terms before release.",
            "Attach utility/permit obligations and safety controls in award packet.",
            "Run attorney review for high-risk or high-value projects.",
        ],
        "advisory_notice": "Operational advisory only. Not legal advice.",
    }


def _infer_dispute_type(text: str) -> str:
    lower = (text or "").lower()
    if any(token in lower for token in ("lien", "notice of lien", "bond claim")):
        return "lien"
    if any(token in lower for token in ("pay", "payment", "retainage", "invoice")):
        return "payment"
    if any(
        token in lower for token in ("contract", "msa", "breach", "indemnity", "terms")
    ):
        return "contract_breach"
    return "general"


def _normalize_project_status(value: str) -> str:
    lower = (value or "").strip().lower()
    return "awarded" if lower == "awarded" else "bid"


@router.get(
    "/top-states",
    summary="Top states by contractor-favorability for a dispute type",
)
def top_states(dispute_type: str = "general", top_n: int = 10):
    """Return the most contractor-favorable states for the given dispute type."""
    results = find_strongest_states(dispute_type, top_n=min(top_n, 51))
    return {"status": "success", "dispute_type": dispute_type, "states": results}


@router.get(
    "/reciprocity-ranking",
    summary="Rank states by reciprocity breadth relative to a home state",
)
def reciprocity_ranking(home_state: str = "AL", top_n: int = 10):
    """Identify states with the broadest reciprocity networks from a home state."""
    results = rank_states_by_reciprocity(home_state, top_n=min(top_n, 51))
    return {"status": "success", "home_state": home_state.upper(), "states": results}


# ── Contractor ranking ────────────────────────────────────────────────────────


class ContractorBidInput(BaseModel):
    name: str = Field(..., description="Contractor name or company")
    bid_amount: float = Field(..., gt=0, description="Total bid in dollars")
    license_state: str = Field(
        default="", max_length=2, description="License state abbreviation"
    )
    license_classes: list[str] = Field(
        default_factory=list, description="List of license class labels"
    )
    bond_amount: float = Field(
        default=0.0, ge=0, description="Surety bond amount in dollars"
    )
    years_experience: int = Field(default=0, ge=0, description="Years in business")
    has_insurance: bool = Field(
        default=True, description="General liability insurance confirmed"
    )
    workers_comp: bool = Field(default=True, description="Workers comp confirmed")
    reciprocity_states: list[str] = Field(
        default_factory=list, description="States covered by reciprocity"
    )
    notes: str = Field(default="", max_length=500)


class RankContractorsRequest(BaseModel):
    bids: list[ContractorBidInput] = Field(..., min_length=1, max_length=20)
    estimate_low: Optional[float] = Field(default=None, ge=0)
    estimate_high: Optional[float] = Field(default=None, ge=0)


@router.post(
    "/rank-contractors",
    summary="Score and rank contractor bids by quality, licensing, bonding, and value",
)
def rank_contractors(req: RankContractorsRequest):
    """
    Score and rank a list of contractor bids.
    Returns ranked results with composite scores, individual dimension scores,
    warning flags, and actionable recommendations.
    """
    bids = [
        ContractorBid(
            name=b.name,
            bid_amount=b.bid_amount,
            license_state=b.license_state,
            license_classes=b.license_classes,
            bond_amount=b.bond_amount,
            years_experience=b.years_experience,
            has_insurance=b.has_insurance,
            workers_comp=b.workers_comp,
            reciprocity_states=b.reciprocity_states,
            notes=b.notes,
        )
        for b in req.bids
    ]
    est_low = req.estimate_low or 0.0
    est_high = req.estimate_high or 0.0

    ranked = rank_contractor_bids(bids, est_low, est_high)

    return {
        "status": "success",
        "estimate_range": {"low": est_low, "high": est_high}
        if est_low or est_high
        else None,
        "ranked": [
            {
                "rank": r.rank,
                "name": r.contractor.name,
                "bid_amount": r.contractor.bid_amount,
                "scores": {
                    "bid": r.bid_score,
                    "license": r.license_score,
                    "bond": r.bond_score,
                    "experience": r.experience_score,
                    "compliance": r.compliance_score,
                    "composite": r.composite_score,
                },
                "rank_label": r.rank_label,
                "recommendation": r.recommendation,
                "flags": r.flags,
            }
            for r in ranked
        ],
    }


@router.get(
    "/license-optimizer",
    summary="Rank states by optimal base license for multi-state contractor work",
)
def license_optimizer(top_n: int = 10):
    """
    Rank states by how beneficial a contractor license there is — weighing
    reciprocity breadth, license class scope, and bond requirements.
    """
    results = optimize_license_states(top_n=min(top_n, 51))
    return {
        "status": "success",
        "results": [
            {
                "rank": i + 1,
                "abbr": s.abbr,
                "state": s.state_name,
                "reciprocity_count": s.reciprocity_count,
                "class_scope_score": s.class_scope_score,
                "bond_min_commercial": s.bond_min_commercial,
                "optimizer_score": s.optimizer_score,
                "optimizer_label": s.optimizer_label,
                "notes": s.notes,
            }
            for i, s in enumerate(results)
        ],
    }


# ── Virginia 811 private-utility risk advisory ────────────────────────────────


class UtilityCheckRequest(BaseModel):
    has_septic: bool
    has_well: bool
    has_detached_structures: bool
    has_pool: bool


class LaunchCompliancePlanRequest(BaseModel):
    avg_deal_size_usd: float = Field(
        default=12000,
        gt=0,
        description="Average signed deal value in USD",
    )
    monthly_qualified_leads: int = Field(
        default=40,
        ge=1,
        description="Qualified inbound leads expected each month",
    )
    close_rate_percent: float = Field(
        default=22,
        ge=0,
        le=100,
        description="Expected close rate percentage",
    )
    team_capacity_jobs_per_month: int = Field(
        default=18,
        ge=1,
        description="Maximum jobs your team can execute monthly",
    )
    include_compliance_advisory: bool = Field(
        default=True,
        description="Include compliance advisory offer lane in output",
    )


@router.post(
    "/utility-risk",
    summary="Virginia 811 private-utility risk advisory",
)
def evaluate_utility_risk(req: UtilityCheckRequest):
    """
    Advisory scoring for sites with private utilities that VA 811 (Miss Utility)
    will NOT mark.  Returns a risk level, actionable recommendations, and the
    legal notice reminder about per-person excavation ticket requirements.

    No PII is collected.  Response is purely advisory.
    """
    has_private = (
        req.has_septic or req.has_well or req.has_detached_structures or req.has_pool
    )

    recommendations = [
        "\u2705 Contact VA 811 (Miss Utility) at least 3 business days before digging."
    ]

    if has_private:
        recommendations += [
            "\u26a0\ufe0f HIGH RISK: Private lines detected. VA 811 will NOT mark these.",
            "\U0001f4a1 Recommendation: Hire a private utility locating service.",
        ]

    recommendations.append(
        "\u2139\ufe0f Tip: Use \u2018White Lining\u2019 (white paint/flags) to outline the "
        "work area before locators arrive."
    )

    return {
        "risk_level": "High" if has_private else "Low",
        "advisory_notes": recommendations,
        "legal_notice": (
            "Every \u2018person\u2019 must provide their own notice of excavation. "
            "Subcontractors cannot work under another\u2019s ticket."
        ),
    }


@router.post(
    "/launch-compliance-plan",
    summary="Launch advisory plan for monetization + compliance rollout",
)
def launch_compliance_plan(req: LaunchCompliancePlanRequest):
    """
    Build a realistic, operations-first launch plan from current assumptions.

    This is an advisory planning endpoint for launch sequencing and revenue
    lanes. It is not legal, tax, or investment advice.
    """
    close_rate = req.close_rate_percent / 100.0
    projected_wins = int(round(req.monthly_qualified_leads * close_rate))
    executable_wins = min(projected_wins, req.team_capacity_jobs_per_month)

    # Base construction revenue forecast band using capacity-capped wins.
    monthly_floor = round(executable_wins * req.avg_deal_size_usd * 0.85, 2)
    monthly_mid = round(executable_wins * req.avg_deal_size_usd, 2)
    monthly_ceiling = round(executable_wins * req.avg_deal_size_usd * 1.15, 2)

    lanes = [
        {
            "lane": "core-operations",
            "description": "Lead intake + quote + close + deposit flow",
            "monthly_revenue_range_usd": {
                "low": monthly_floor,
                "mid": monthly_mid,
                "high": monthly_ceiling,
            },
            "dependencies": [
                "lead capture",
                "crm pipeline",
                "math-ai cost estimate",
                "payments checkout-session",
            ],
        },
        {
            "lane": "ads-intelligence-managed-service",
            "description": "URL exclusions + CRM export + anomaly monitoring for paid media",
            "monthly_revenue_range_usd": {"low": 4500, "mid": 12000, "high": 30000},
            "dependencies": [
                "ads/status",
                "ads/url-exclusions",
                "ads/crm-export",
                "ads/anomaly-scan",
            ],
        },
        {
            "lane": "maintenance-plan-recurring",
            "description": "Recurring maintenance packages using forecast-based follow-ups",
            "monthly_revenue_range_usd": {"low": 3000, "mid": 8500, "high": 20000},
            "dependencies": [
                "math-ai maintenance-forecast",
                "follow-up automation",
                "customer history",
            ],
        },
    ]

    if req.include_compliance_advisory:
        lanes.append(
            {
                "lane": "compliance-advisory",
                "description": "51-jurisdiction compliance verification + advisory retainers",
                "monthly_revenue_range_usd": {"low": 1000, "mid": 5000, "high": 12000},
                "dependencies": [
                    "compliance/matrix",
                    "compliance/verify-batch",
                    "advisor/legal-strategy",
                    "advisor/license-optimizer",
                ],
                "notice": "Advisory operations guidance only; not legal advice.",
            }
        )

    launch_sequence = [
        "Stabilize core funnel: quote -> proposal -> deposit conversion.",
        "Turn on weekly ads anomaly scans and CRM export loops.",
        "Launch compliance advisory package with batch verification deliverables.",
        "Expand recurring maintenance plans once execution capacity is stable.",
    ]

    return {
        "status": "success",
        "inputs": req.model_dump(),
        "forecast": {
            "projected_wins_per_month": projected_wins,
            "capacity_capped_wins_per_month": executable_wins,
            "capacity_utilization_percent": round(
                min(
                    100.0, (executable_wins / req.team_capacity_jobs_per_month) * 100.0
                ),
                1,
            ),
        },
        "revenue_lanes": lanes,
        "launch_sequence": launch_sequence,
        "compliance_checklist": [
            "Confirm 51-jurisdiction matrix parity before publishing advisory outputs.",
            "Record verification history for every compliance run.",
            "Include advisory-only notice in every compliance client deliverable.",
        ],
        "advisory_notice": "Planning guidance only. Confirm legal and tax implications with licensed professionals.",
    }
