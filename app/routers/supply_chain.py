from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
import json
import logging
from typing import Optional

from app.services import llm_client
from app.services import runtime_config as _cfg

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/supply-chain", tags=["Supply Chain"])

class ArbitrageRequest(BaseModel):
    service: str  # e.g., "Asphalt Paving", "Sealcoating", "Concrete"
    zip_code: Optional[str] = None
    sqft: Optional[float] = None
    condition: Optional[str] = None

class ArbitrageResponse(BaseModel):
    recommended_multiplier: float
    market_condition: str
    rationale: str
    simulated_index_price: float

@router.post("/arbitrage", response_model=ArbitrageResponse, summary="Live Material Cost Arbitrage")
async def calculate_arbitrage(payload: ArbitrageRequest):
    """
    Analyzes the requested service in the context of simulated live supply chain 
    indices (e.g. oil barrel price, local aggregate scarcity) and calculates an 
    optimized margin multiplier (e.g. 1.25 -> 1.32 or 1.18) to maximize profit 
    while remaining competitive.
    """
    
    # In a real production system, this would call a real commodities API or scraping service.
    # We will simulate the live "index" data based on the service requested.
    base_index = 85.50 if "Asphalt" in payload.service else 120.00
    
    prompt = f"""
    You are the Supply Chain Arbitrage Engine for J. Worden Standard OS.
    Your goal is to optimize profit margins for a construction contractor.
    
    Data:
    - Service: {payload.service}
    - Square Footage: {payload.sqft or 'Unknown'}
    - Surface Condition: {payload.condition or 'Unknown'}
    - Zip Code: {payload.zip_code or 'Unknown'}
    - Current Market Material Index Price: ${base_index}
    
    Standard margin is usually 1.25 (25% markup). 
    However, you must dynamically calculate a better multiplier based on the above data.
    If the index price suggests a dip in material costs, you can afford to lower the multiplier to undercut competitors while still taking home massive net profit. If materials are scarce, raise the multiplier.
    
    Return your response strictly as JSON with the following keys:
    {{
        "recommended_multiplier": float (e.g., 1.28),
        "market_condition": "String describing the current simulated market constraint (e.g., 'Asphalt prices down 4% locally')",
        "rationale": "One sentence explaining why you chose this multiplier to maximize profit."
    }}
    """
    
    try:
        resp = await llm_client.chat(
            messages=[{"role": "user", "content": prompt}],
            task="analytics",  # Will route to gpt-4o based on our updated llm_client
            json_mode=True
        )
        
        if resp.get("error"):
            raise HTTPException(status_code=500, detail="AI Arbitrage Engine Failed")
            
        result = json.loads(resp.get("text", "{}"))
        
        return ArbitrageResponse(
            recommended_multiplier=result.get("recommended_multiplier", 1.25),
            market_condition=result.get("market_condition", "Stable"),
            rationale=result.get("rationale", "Standard baseline pricing applied."),
            simulated_index_price=base_index
        )
        
    except Exception as e:
        logger.error(f"Error in arbitrage engine: {e}")
        # Fallback to standard 1.25 margin
        return ArbitrageResponse(
            recommended_multiplier=1.25,
            market_condition="Unknown - API Error",
            rationale="Fallback to standard 25% margin due to AI engine timeout.",
            simulated_index_price=base_index
        )
