"""
takeoff.py - Paving Tonnage and Takeoff Calculator for J. Worden & Sons.
Calculates required tonnage for asphalt paving and aggregate stone bases,
incorporating compaction weights, regional price adjustments, and the $9/ton oil price shield.
"""

def calculate_takeoff(
    area_sqft: float,
    asphalt_thickness_inches: float = 3.0,
    base_thickness_inches: float = 6.0,
    asphalt_compaction: float = 96.0, # Target compaction (floor: 96% per Worden Standard)
    cost_per_ton_asphalt: float = 75.00,
    cost_per_ton_stone: float = 28.00,
    state_code: str = "VA"
) -> dict:
    # 1. Enforce standards (Compaction floor: 96%)
    compaction = max(asphalt_compaction, 96.0)
    
    # 2. Asphalt Tonnage Calculation
    # Volume (cubic feet) = Area * (Thickness / 12)
    asphalt_volume_cuft = area_sqft * (asphalt_thickness_inches / 12.0)
    # Density of Hot-Mix Asphalt: 145 lbs/cuft
    asphalt_weight_lbs = asphalt_volume_cuft * 145.0 * (compaction / 100.0)
    asphalt_tonnage = asphalt_weight_lbs / 2000.0
    
    # 3. Aggregate Base Tonnage Calculation (VDOT Section 315 aggregate stone base)
    base_volume_cuft = area_sqft * (base_thickness_inches / 12.0)
    # Density of compacted base stone: 135 lbs/cuft
    base_weight_lbs = base_volume_cuft * 135.0
    base_tonnage = base_weight_lbs / 2000.0
    
    # 4. Regional Multiplier
    try:
        from .state_data import get_price_multiplier
        multiplier = get_price_multiplier(state_code)
    except Exception:
        multiplier = 1.0 # fallback
        
    # 5. Live oil price shield: Add ±$9/ton liquid asphalt price buffer (binder content ~5.5% of HMA weight)
    liquid_binder_tonnage = asphalt_tonnage * 0.055
    oil_shield_buffer_usd = liquid_binder_tonnage * 9.00
    
    # 6. Costs
    base_asphalt_cost = (asphalt_tonnage * cost_per_ton_asphalt) * multiplier
    base_stone_cost = (base_tonnage * cost_per_ton_stone) * multiplier
    
    total_materials_cost = base_asphalt_cost + base_stone_cost + oil_shield_buffer_usd
    
    return {
        "area_sqft": round(area_sqft, 2),
        "asphalt": {
            "thickness_inches": round(asphalt_thickness_inches, 2),
            "compaction_pct": round(compaction, 2),
            "tonnage": round(asphalt_tonnage, 2),
            "cost_usd": round(base_asphalt_cost, 2)
        },
        "aggregate_base": {
            "thickness_inches": round(base_thickness_inches, 2),
            "tonnage": round(base_tonnage, 2),
            "cost_usd": round(base_stone_cost, 2)
        },
        "oil_price_shield": {
            "liquid_binder_tonnage": round(liquid_binder_tonnage, 3),
            "buffer_usd": round(oil_shield_buffer_usd, 2)
        },
        "regional_multiplier": multiplier,
        "total_materials_cost_usd": round(total_materials_cost, 2)
    }

if __name__ == "__main__":
    # Test execution
    res = calculate_takeoff(10000, 3.0, 6.0, 96.0)
    print("Takeoff Calculation Results (10,000 sq ft, 3\" Asphalt, 6\" Base):")
    print(f"  Asphalt Tonnage: {res['asphalt']['tonnage']} tons (Cost: ${res['asphalt']['cost_usd']})")
    print(f"  Aggregate Stone Tonnage: {res['aggregate_base']['tonnage']} tons (Cost: ${res['aggregate_base']['cost_usd']})")
    print(f"  Oil Price Shield Buffer: ${res['oil_price_shield']['buffer_usd']}")
    print(f"  Total Materials Budget: ${res['total_materials_cost_usd']} (Multiplier: {res['regional_multiplier']}x)")
