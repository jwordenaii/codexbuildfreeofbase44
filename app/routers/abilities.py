from fastapi import APIRouter, Body, Depends, HTTPException, Query
from typing import Any, Dict

from ..core.security import verify_premium_security
from ..services.os_ability_service import (
    execute_os_ability,
    list_ability_categories,
    search_os_abilities,
)

# /execute dynamically imports and runs arbitrary modules from the abilities
# tree by module_id. That is the whole point of the endpoint, and it is also
# why it must not be reachable unauthenticated — it previously was.
#
# Enforced at router level (matching autonomy.py) so routes added later inherit
# the guard rather than relying on someone remembering.
router = APIRouter(
    prefix="/api/v1/abilities",
    tags=["abilities"],
    dependencies=[Depends(verify_premium_security)],
)


@router.get("/search")
def search_abilities(
    q: str = Query("", description="Search query for OS abilities"),
    top_k: int = Query(6, ge=1, le=50),
):
    """
    Search registered Jarvis OS abilities by keyword or category.

    Each result carries `implemented`. Entries with `implemented: false` are
    generated scaffolds that report host CPU/memory instead of doing domain
    work — they cannot be executed. See os_ability_service for details.
    """
    return search_os_abilities(q, top_k=top_k)


@router.get("/categories")
def ability_categories():
    """Group every registered ability by domain, with implemented/scaffold counts."""
    return list_ability_categories()


@router.post("/execute")
def execute_ability(payload: Dict[str, Any] = Body(...)):
    """
    Execute a registered Jarvis OS ability by module_id.

    {
      "module_id": "VisionAndIntelligence.age_decay_simulator",
      "params": { "trade": "asphalt", "sqft": 50000 },
      "strict": true
    }

    `strict` defaults to true: a missing required parameter returns an error
    instead of a fabricated value. Pass strict=false to run with placeholders —
    the response then carries "synthesised": true and lists every invented
    parameter under "defaulted_params", so a synthetic result can never be
    mistaken for a computed one.
    """
    module_id = payload.get("module_id")
    if not module_id:
        raise HTTPException(status_code=400, detail="Missing 'module_id' in request payload.")

    result = execute_os_ability(
        module_id,
        payload.get("params") or {},
        strict=bool(payload.get("strict", True)),
    )

    if not result.get("ok"):
        # 501 = registered but never built; 400 = bad request against a real ability.
        status = 501 if result.get("implemented") is False else 400
        raise HTTPException(status_code=status, detail=result.get("error", "Execution failed"))

    return result
