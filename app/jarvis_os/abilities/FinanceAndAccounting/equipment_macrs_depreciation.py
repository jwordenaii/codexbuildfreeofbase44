import logging
import random

logger = logging.getLogger(__name__)

class EquipmentMacrsDepreciationEngine:
    """
    Corporate IRS Finance.
    Calculates strict IRS MACRS (Modified Accelerated Cost Recovery System) depreciation 
    schedules for heavy yellow iron to maximize multi-year corporate tax shields.
    """
    def __init__(self):
        self.module_id = "equipment_macrs_depreciation"
        
    def execute(self, params: dict = None) -> dict:
        asset_value = params.get("asset_value", random.uniform(250000.0, 850000.0)) if params else random.uniform(250000.0, 850000.0)
        
        # Heavy construction equipment is typically MACRS 5-Year Property (Half-Year Convention)
        # 5-Year MACRS Percentages: 20%, 32%, 19.2%, 11.52%, 11.52%, 5.76%
        macrs_rates = [0.20, 0.32, 0.192, 0.1152, 0.1152, 0.0576]
        
        corporate_tax_rate = 0.21
        
        year_1_depreciation = asset_value * macrs_rates[0]
        year_2_depreciation = asset_value * macrs_rates[1]
        
        # Tax shield value is the depreciation * tax rate
        year_1_tax_shield = year_1_depreciation * corporate_tax_rate
        
        status = "MACRS_SCHEDULE_LOCKED"
        directive = f"Accelerated depreciation schedule generated. Shielding ${year_1_tax_shield:,.2f} in corporate taxes for Year 1."
            
        assessment = (
            f"/// IRS FINANCE: MACRS DEPRECIATION ENGINE ///\\n"
            f"-> Capitalized Asset Value: ${asset_value:,.2f}\\n"
            f"-> Recovery Period: 5-Year Property (Heavy Iron)\\n\\n"
            f"DEPRECIATION MATRIX:\\n"
            f"-> Year 1 Deduction (20%): ${year_1_depreciation:,.2f}\\n"
            f"-> Year 1 Corporate Tax Shield: ${year_1_tax_shield:,.2f}\\n"
            f"-> Year 2 Deduction (32%): ${year_2_depreciation:,.2f}\\n\\n"
            f"STATUS: {status}\\n"
            f"DIRECTIVE: {directive}"
        )
        
        return {
            "status": status,
            "engine": "EquipmentMacrsDepreciationEngine",
            "assessment": assessment,
            "metrics": {
                "year_1_depreciation": round(year_1_depreciation, 2),
                "tax_shield": round(year_1_tax_shield, 2)
            }
        }
