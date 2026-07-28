from fastapi import APIRouter, HTTPException, Query, Body
from typing import Dict, Any, Optional
from ..services.os_ability_service import search_os_abilities, execute_os_ability

router = APIRouter(prefix="/api/v1/abilities", tags=["abilities"])

@router.get("/search")
def search_abilities(q: str = Query("", description="Search query for OS abilities")):
    """Search registered Jarvis OS abilities by keyword or category."""
    return {"query": q, "abilities": search_os_abilities(q)}

@router.post("/execute")
def execute_ability(payload: Dict[str, Any] = Body(...)):
    """
    Execute any of the 162 Jarvis OS abilities.
    Payload format:
    {
      "module_id": "VisionAndIntelligence.age_decay_simulator",
      "params": { "trade": "asphalt", "sqft": 50000 }
    }
    """
    module_id = payload.get("module_id")
    if not module_id:
        raise HTTPException(status_code=400, detail="Missing 'module_id' in request payload.")
    
    params = payload.get("params") or {}
    result = execute_os_ability(module_id, params)
    
    if result.get("status") == "ERROR":
        raise HTTPException(status_code=500, detail=result.get("error", "Execution failed"))
        
    return result
