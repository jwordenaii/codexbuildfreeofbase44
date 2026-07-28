import logging
import random

logger = logging.getLogger(__name__)

class AssetCapitalizationEngine:
    """
    CPA Accounting Engine.
    Mathematically determines whether to expense a massive equipment repair 
    (e.g., a $30,000 CAT engine rebuild) directly against a job's P&L, 
    or capitalize it as a depreciable asset over 5 years based on IRS guidelines.
    """
    def __init__(self):
        self.module_id = "asset_capitalization_engine"
        
    def execute(self, params: dict = None) -> dict:
        repair_cost = params.get("repair_cost", random.uniform(5000.0, 65000.0)) if params else random.uniform(5000.0, 65000.0)
        
        # IRS Capitalization Threshold (e.g., Routine maintenance is expensed, Betterments are capitalized)
        # Simplified logic: >$10k and extends life > 1 year = Capitalize
        extends_useful_life = repair_cost > 15000.0 and random.random() > 0.2
        
        if repair_cost > 10000.0 and extends_useful_life:
            status = "CAPITALIZED_ASSET"
            accounting_action = "Moved to Balance Sheet (Fixed Assets)."
            directive = f"Repair exceeds capitalization threshold and extends asset life. Depreciate ${repair_cost:,.2f} over 5 years via MACRS."
        else:
            status = "EXPENSED_REPAIR"
            accounting_action = "Hit directly against Job P&L (Maintenance Expense)."
            directive = f"Repair (${repair_cost:,.2f}) classified as routine maintenance. Expensing directly against current project margins."
            
        assessment = (
            f"/// CPA ACCOUNTING: ASSET CAPITALIZATION ENGINE ///\\n"
            f"-> Processing Shop Work Order...\\n"
            f"-> Total Repair Invoice: ${repair_cost:,.2f}\\n\\n"
            f"IRS CLASSIFICATION MATRIX:\\n"
            f"-> Extends Useful Life / Betterment: {str(extends_useful_life).upper()}\\n"
            f"-> Accounting Treatment: {accounting_action}\\n\\n"
            f"STATUS: {status}\\n"
            f"DIRECTIVE: {directive}"
        )
        
        return {
            "status": status,
            "engine": "AssetCapitalizationEngine",
            "assessment": assessment,
            "metrics": {
                "repair_cost": round(repair_cost, 2),
                "capitalized": status == "CAPITALIZED_ASSET"
            }
        }
