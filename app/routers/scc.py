"""
scc.py — Virginia SCC business entity verification router.

Routes:
  GET  /api/v1/scc/verify         — verify a single entity by ID or name
  POST /api/v1/scc/verify-batch   — verify up to 50 entities in one call
  GET  /api/v1/scc/status         — health/config status

All endpoints require premium auth.
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from ..core.security import verify_premium_security
from ..services.scc_service import batch_verify, verify_scc_entity

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/scc",
    tags=["SCC Compliance"],
    dependencies=[Depends(verify_premium_security)],
)


# ── Schemas ───────────────────────────────────────────────────────────────────

class SccEntityResult(BaseModel):
    entity_id:        Optional[str]
    entity_name:      Optional[str]
    entity_type:      Optional[str]
    status:           str
    is_good_standing: bool
    registered_agent: Optional[str]
    principal_office: Optional[str]
    date_formed:      Optional[str]
    source:           str
    checked_at:       str


class SccBatchVerifyRequest(BaseModel):
    entities: List[dict] = Field(..., min_length=1, max_length=50,
                                 description="List of {entity_id?, entity_name?} dicts")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/status")
def scc_status():
    """Health and configuration check for the SCC verifier."""
    import os  # noqa: PLC0415
    return {
        "ok": True,
        "provider": "scc_api" if os.getenv("SCC_API_KEY") else "stub",
        "scc_key_set": bool(os.getenv("SCC_API_KEY")),
        "endpoints": {
            "verify":       "GET /api/v1/scc/verify?entity_id=S1234567",
            "verify_batch": "POST /api/v1/scc/verify-batch",
        },
    }


@router.get("/verify", response_model=SccEntityResult)
def verify_entity(
    entity_id:   Optional[str] = Query(None, description="SCC entity ID, e.g. S1234567"),
    entity_name: Optional[str] = Query(None, description="Registered business name"),
):
    """
    Verify a single Virginia SCC business entity by ID or name.
    Returns current standing, registered agent, and formation date.
    """
    if not entity_id and not entity_name:
        raise HTTPException(status_code=422, detail="Provide entity_id or entity_name query param")

    try:
        result = verify_scc_entity(entity_id=entity_id, entity_name=entity_name)
    except Exception as exc:  # noqa: BLE001
        logger.exception("SCC verify failed")
        raise HTTPException(status_code=502, detail=f"SCC lookup error: {exc}") from exc

    return result


@router.post("/verify-batch")
def verify_batch(body: SccBatchVerifyRequest):
    """
    Verify up to 50 Virginia SCC entities in a single call.
    Each entity must have entity_id or entity_name (or both).
    """
    try:
        results = batch_verify(body.entities)
    except Exception as exc:  # noqa: BLE001
        logger.exception("SCC batch verify failed")
        raise HTTPException(status_code=502, detail=f"SCC batch error: {exc}") from exc

    compliant     = sum(1 for r in results if r.get("is_good_standing"))
    non_compliant = len(results) - compliant

    return {
        "total":         len(results),
        "compliant":     compliant,
        "non_compliant": non_compliant,
        "results":       results,
    }
