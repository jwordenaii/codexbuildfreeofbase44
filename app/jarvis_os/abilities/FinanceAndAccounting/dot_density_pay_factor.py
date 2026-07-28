import logging
import random

logger = logging.getLogger(__name__)

class DotDensityPayFactorEngine:
    """
    Financial QC Engine.
    Ingests nuclear density gauge readings from the asphalt mat. Mathematically calculates 
    if compaction hits DOT thresholds to trigger a financial Bonus (e.g., 105% pay) or a severe Penalty.
    """
    def __init__(self):
        self.module_id = "dot_density_pay_factor"
        
    def execute(self, params: dict = None) -> dict:
        lot_id = params.get("lot_id", f"LOT-{random.randint(100, 999)}") if params else f"LOT-{random.randint(100, 999)}"
        base_pay = random.uniform(25000.0, 150000.0)
        
        # Simulate Nuclear Density Gauge readings (Theoretical Maximum Specific Gravity % - Gmm)
        # Target for DOT is usually 92.0% - 94.0%
        average_density_pct = random.uniform(89.5, 96.5)
        
        # Calculate Pay Factor
        if 92.5 <= average_density_pct <= 93.5:
            pay_factor = 1.05 # 105% Bonus
            status = "DOT_BONUS_ACHIEVED"
            directive = f"Density perfectly optimized ({average_density_pct:.1f}%). Issuing 105% payout invoice to DOT."
        elif 91.0 <= average_density_pct < 92.5 or 93.5 < average_density_pct <= 95.0:
            pay_factor = 1.00 # 100% Base Pay
            status = "DENSITY_NOMINAL"
            directive = f"Density acceptable ({average_density_pct:.1f}%). Generating standard 100% pay invoice."
        elif average_density_pct < 91.0:
            pay_factor = random.uniform(0.70, 0.95) # Severe penalty
            status = "UNDER_COMPACTED_PENALTY"
            directive = f"DANGER: Density failed minimums ({average_density_pct:.1f}%). Applying {pay_factor*100:.0f}% penalty deduction."
        else:
            pay_factor = 0.50 # Extreme over-compaction (crushing the rock)
            status = "OVER_COMPACTED_FAILURE"
            directive = f"DANGER: Mat over-compacted ({average_density_pct:.1f}%). Aggregate crushed. Remove and Replace ordered."
            
        final_payout = base_pay * pay_factor
        delta = final_payout - base_pay
        
        assessment = (
            f"/// FINANCIAL QC: DOT DENSITY PAY-FACTOR ///\\n"
            f"-> Auditing Compaction Lot: {lot_id}\\n"
            f"-> Lot Base Value: ${base_pay:,.2f}\\n\\n"
            f"NUCLEAR DENSITY MATRIX:\\n"
            f"-> Average Mat Density (Gmm): {average_density_pct:.2f}%\\n"
            f"-> Calculated Pay-Factor Multiplier: {(pay_factor*100):.1f}%\\n\\n"
            f"-> Final DOT Payout: ${final_payout:,.2f} (Delta: ${delta:,.2f})\\n\\n"
            f"STATUS: {status}\\n"
            f"DIRECTIVE: {directive}"
        )
        
        return {
            "status": status,
            "engine": "DotDensityPayFactorEngine",
            "assessment": assessment,
            "metrics": {
                "density_pct": round(average_density_pct, 2),
                "pay_factor": pay_factor,
                "final_payout": round(final_payout, 2)
            }
        }
