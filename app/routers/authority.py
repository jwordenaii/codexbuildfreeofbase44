"""
authority.py — J. Worden | Authority API.

Public endpoint that drives the per-city "Verified Proof" content engine.
Called by the Netlify build-time generator (scripts/ai-authority-factory.mjs)
for every city in the grid, and by the public site at runtime if admin
refresh is triggered.

Endpoint:
  GET /api/v1/authority/local-proof
    ?tenant=jworden            (site-factory profile key; default "jworden")
    &city=Richmond             (required)
    &project_type=commercial parking lot repaving
    &equipment=Mauldin 690,LeeBoy

  → 200 ProofResponse on success
  → 502 if the LLM provider chain fails
  → 400 if the tenant key isn't a registered profile

Each successful generation is logged to the `audit_events` table with
event_type='authority_generation' for per-tenant cost tracking from the
Command Center.
"""

import hashlib
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.limiter import limiter
from ..core.tenant_contract import profiles_by_key
from ..database import get_db
from ..models import AuditEvent
from ..services import ai_foreman

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/authority", tags=["authority"])


# ── Tenant key validation ────────────────────────────────────────────────────
try:
    _VALID_TENANTS = set(profiles_by_key().keys())
except Exception as exc:  # noqa: BLE001
    logger.warning(
        "Could not load tenant contract (%s); defaulting to 'jworden' only", exc
    )
    _VALID_TENANTS = {"jworden"}


# ── Response model ───────────────────────────────────────────────────────────


class ProofResponse(BaseModel):
    tenant: str
    city: str
    verified_content: str
    model: str
    provider: str
    fallback_used: bool
    latency_ms: int


# ── Endpoint ─────────────────────────────────────────────────────────────────


@router.get(
    "/local-proof",
    response_model=ProofResponse,
    summary="Generate Verified Proof content for one city",
)
@limiter.limit("30/minute")
def get_local_proof(
    request: Request,
    city: str = Query(
        ...,
        min_length=2,
        max_length=120,
        description="Target city name (display form), e.g. 'Richmond'",
    ),
    tenant: str = Query(
        "jworden", min_length=2, max_length=60, description="Site-factory profile key"
    ),
    project_type: str = Query("commercial parking lot repaving", max_length=200),
    equipment: str = Query(
        "Mauldin 690, LeeBoy",
        max_length=400,
        description="Comma-separated equipment list",
    ),
    state: str | None = Query(
        None, max_length=2, description="Optional state code override (e.g. 'NC')"
    ),
    db: Session = Depends(get_db),
) -> ProofResponse:
    """
    Generate a hyper-local, equipment-specific Verified Proof statement for a city.

    Routed through llm_client.chat(task='city_authority') — Gemini 2.5 Flash
    primary, GPT-4o fallback. Each successful call writes one row to
    `audit_events` for cost/audit tracking.
    """
    if tenant not in _VALID_TENANTS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown tenant '{tenant}'. Valid keys: {sorted(_VALID_TENANTS)}",
        )

    equipment_list = [eq.strip() for eq in equipment.split(",") if eq.strip()]

    try:
        proof = ai_foreman.generate_city_proof(
            city_name=city,
            equipment_used=equipment_list,
            project_type=project_type,
            tenant=tenant,
            state=state,
        )
    except RuntimeError as exc:
        logger.error(
            "Authority generation failed: tenant=%s city=%s err=%s", tenant, city, exc
        )
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    # ── Audit log (best-effort; never fails the request) ─────────────────────
    try:
        prompt_hash = hashlib.sha256(
            f"{tenant}|{city}|{project_type}|{equipment}".encode("utf-8")
        ).hexdigest()[:16]

        event = AuditEvent(
            event_type="authority_generation",
            actor_type="system",
            entity_type="city",
            entity_id=city,
            tenant_id=tenant,
            summary=f"Generated {len(proof.text)} chars for {city} via {proof.model}",
            detail_json=json.dumps(
                {
                    "tenant": tenant,
                    "city": city,
                    "project_type": project_type,
                    "equipment": equipment_list,
                    "model": proof.model,
                    "provider": proof.provider,
                    "fallback_used": proof.fallback_used,
                    "latency_ms": proof.latency_ms,
                    "prompt_hash": prompt_hash,
                    "content_length": len(proof.text),
                }
            ),
        )
        db.add(event)
        db.commit()
    except Exception as exc:  # noqa: BLE001
        logger.warning("AuditEvent write failed (non-fatal): %s", exc)
        db.rollback()

    return ProofResponse(
        tenant=proof.tenant,
        city=proof.city,
        verified_content=proof.text,
        model=proof.model,
        provider=proof.provider,
        fallback_used=proof.fallback_used,
        latency_ms=proof.latency_ms,
    )
