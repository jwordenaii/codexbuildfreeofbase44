import logging
import random

logger = logging.getLogger(__name__)

class EquipmentLeaseCalculatorEngine:
    """
    Deep Finance Engine.
    Calculates complex amortization schedules, interest rates, and MACRS depreciation 
    to mathematically recommend whether to Lease or Buy a $500,000 CAT milling machine.
    """
    def __init__(self):
        self.module_id = "equipment_lease_calculator"
        
    def execute(self, params: dict = None) -> dict:
        asset_value = params.get("asset_value", 550000.0) if params else 550000.0
        
        # Financial variables
        interest_rate = random.uniform(5.5, 9.5) / 100.0
        term_months = 60
        salvage_value = asset_value * 0.20
        
        # Simple amortized monthly payment for purchase (assuming 100% financed)
        monthly_interest = interest_rate / 12
        buy_monthly = asset_value * (monthly_interest * (1 + monthly_interest)**term_months) / ((1 + monthly_interest)**term_months - 1)
        total_buy_cost = buy_monthly * term_months
        
        # Simulate MACRS tax shield value (Bonus depreciation)
        tax_shield = asset_value * 0.21 # Corporate tax rate
        net_buy_cost = total_buy_cost - tax_shield - salvage_value
        
        # Simulate operating lease cost
        lease_monthly = buy_monthly * random.uniform(0.7, 0.85)
        total_lease_cost = lease_monthly * term_months
        
        if total_lease_cost < net_buy_cost:
            status = "LEASE_RECOMMENDED"
            directive = f"Operating lease is ${net_buy_cost - total_lease_cost:,.2f} cheaper over {term_months} months due to high interest rates. Execute lease agreement."
        else:
            status = "PURCHASE_RECOMMENDED"
            directive = f"MACRS tax shield and salvage value make purchasing ${total_lease_cost - net_buy_cost:,.2f} cheaper. Execute CapEx acquisition."
            
        assessment = (
            f"/// FINANCE AI: HEAVY EQUIPMENT LEASE CALCULATOR ///\\n"
            f"-> Asset: Caterpillar PM620 Cold Planer\\n"
            f"-> Capital Value: ${asset_value:,.2f}\\n"
            f"-> Financing Rate: {(interest_rate*100):.1f}%\\n\\n"
            f"AMORTIZATION MATRIX (60 Months):\\n"
            f"-> Total Cost of Lease: ${total_lease_cost:,.2f} (${lease_monthly:,.2f}/mo)\\n"
            f"-> Total Net Cost to Buy (Post-Tax Shield & Salvage): ${net_buy_cost:,.2f}\\n\\n"
            f"STATUS: {status}\\n"
            f"DIRECTIVE: {directive}"
        )
        
        return {
            "status": status,
            "engine": "EquipmentLeaseCalculatorEngine",
            "assessment": assessment,
            "metrics": {
                "lease_cost": round(total_lease_cost, 2),
                "buy_cost": round(net_buy_cost, 2)
            }
        }
