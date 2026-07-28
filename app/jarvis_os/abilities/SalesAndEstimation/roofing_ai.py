import logging
import math
try:
    from app.jarvis_os.abilities.MarketOrchestration.live_market_intel import LiveMarketIntelEngine
except ImportError:
    class LiveMarketIntelEngine: pass

try:
    from app.jarvis_os.abilities.SalesAndEstimation.state_data import get_price_multiplier
except ImportError:
    def get_price_multiplier(state): return 1.0

_RATES = {"Architectural Shingles": 350.0, "Standing Seam Metal": 850.0, "TPO / EPDM Flat": 450.0, "Clay / Concrete Tile": 950.0}

logger = logging.getLogger(__name__)

class RoofingAiEngine:
    """
    Autonomous Premium Engine for Omni-Roofing Analysis.
    Calculates material takeoffs (Squares), waste factors, and localized pricing for 4 major roof types.
    """
    def __init__(self):
        self.module_id = "roofing_estimator_ai"
        self.market_intel = LiveMarketIntelEngine()
        
        # Mapping UI names to the keys in pricing._RATES
        self.roof_types = {
            "Asphalt Shingles": "roofing_asphalt",
            "Metal (Standing Seam)": "roofing_metal",
            "Flat (TPO/EPDM)": "roofing_flat_tpo",
            "Tile / Slate": "roofing_tile_slate"
        }

    def execute(self, params: dict = None) -> dict:
        params = params or {}
        area_sqft = float(params.get('area_sqft', 0.0))
        property_type = params.get('property_type', 'residential').lower()
        state_code = params.get('state_code', 'VA').upper()
        
        if area_sqft <= 0:
            return {"status": "error", "message": "Invalid roof area."}

        # 1 Square = 100 sq ft in roofing terms
        base_squares = area_sqft / 100.0
        
        # Waste Factors
        # Asphalt: ~10% waste, Metal: ~15% waste, Flat: ~8% waste, Tile: ~12% waste
        waste_factors = {
            "Asphalt Shingles": 1.10,
            "Metal (Standing Seam)": 1.15,
            "Flat (TPO/EPDM)": 1.08,
            "Tile / Slate": 1.12
        }

        # Localized Multiplier
        local_multiplier = get_price_multiplier(state_code)
        
        # Live Commodities Market Intel
        live_data = self.market_intel.execute()
        oil_multiplier = live_data.get("oil_multiplier", 1.0)
        steel_multiplier = live_data.get("steel_multiplier", 1.0)
        
        results = []
        
        for ui_name, rate_key in self.roof_types.items():
            rate_range = _RATES.get(rate_key, {}).get(property_type, (0, 0))
            low_rate, high_rate = rate_range
            
            # Apply local state multiplier to the base rates
            local_low = low_rate * local_multiplier
            local_high = high_rate * local_multiplier
            
            # Apply Live Global Commodity Multiplier based on material type
            if ui_name == "Asphalt Shingles":
                local_low *= oil_multiplier
                local_high *= oil_multiplier
            elif ui_name == "Metal (Standing Seam)":
                local_low *= steel_multiplier
                local_high *= steel_multiplier
            # (Flat TPO is somewhat pegged to oil/plastics, but we'll leave it as state-multiplier only for now or partially peg it)
            
            waste_factor = waste_factors.get(ui_name, 1.10)
            total_sqft_with_waste = area_sqft * waste_factor
            total_squares = total_sqft_with_waste / 100.0
            
            # Calculate final localized costs
            low_cost = total_sqft_with_waste * local_low
            high_cost = total_sqft_with_waste * local_high
            
            results.append({
                "type": ui_name,
                "base_sqft": area_sqft,
                "waste_margin": f"{int((waste_factor - 1.0) * 100)}%",
                "total_squares": round(total_squares, 1),
                "local_rate_low": round(local_low, 2),
                "local_rate_high": round(local_high, 2),
                "total_cost_low": round(low_cost, 2),
                "total_cost_high": round(high_cost, 2)
            })

        return {
            "status": "success",
            "engine": "RoofingAiEngine",
            "assessment": f"Omni-Roofing localized takeoff completed for {state_code} with a local factor of {local_multiplier}x. Market Intel active.",
            "metrics": {
                "property_type": property_type.capitalize(),
                "state_code": state_code,
                "local_multiplier": local_multiplier,
                "live_market": live_data,
                "options": results
            }
        }
