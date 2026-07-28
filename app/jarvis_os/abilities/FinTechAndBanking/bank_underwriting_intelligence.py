import logging
import math

logger = logging.getLogger(__name__)

class BankUnderwritingIntelligenceEngine:
    """
    Autonomous Premium Engine for Real Estate Bank Underwriting.
    Calculates LTC, DSCR, Cash-on-Cash Return, and Amortization Schedules.
    """
    def __init__(self):
        self.module_id = "bank_underwriting_intelligence"
        logger.info(f"[BankUnderwritingIntelligenceEngine] ONLINE. Bootstrapped financial execution matrix.")

    def execute(self, params: dict = None) -> dict:
        """
        Executes the core tactical underwriting loop.
        Expects:
        - construction_cost (float)
        - projected_noi (float)
        """
        params = params or {}
        construction_cost = float(params.get('construction_cost', 15000000.0))
        projected_noi = float(params.get('projected_noi', 1200000.0))
        
        # Real world assumptions
        ltc_ratio = 0.75  # 75% Loan-to-Cost
        interest_rate = 0.065  # 6.5% Annual Interest Rate
        amortization_years = 30
        
        loan_amount = construction_cost * ltc_ratio
        equity_required = construction_cost - loan_amount
        
        # Monthly payment calculation: P = L[c(1 + c)^n]/[(1 + c)^n - 1]
        monthly_interest = interest_rate / 12
        total_payments = amortization_years * 12
        
        if monthly_interest > 0:
            monthly_debt_service = loan_amount * (monthly_interest * math.pow(1 + monthly_interest, total_payments)) / (math.pow(1 + monthly_interest, total_payments) - 1)
        else:
            monthly_debt_service = loan_amount / total_payments
            
        annual_debt_service = monthly_debt_service * 12
        
        # Cash Flow & Returns
        net_cash_flow = projected_noi - annual_debt_service
        dscr = projected_noi / annual_debt_service if annual_debt_service > 0 else 999.9
        cash_on_cash_return = (net_cash_flow / equity_required) * 100 if equity_required > 0 else 0
        
        # Underwriting Status
        is_approved = dscr >= 1.25 and cash_on_cash_return >= 10.0
        status = "APPROVED" if is_approved else "DENIED"
        
        assessment = (
            f"/// BANK UNDERWRITING INTELLIGENCE ///\n"
            f"-> Status: {status}\n"
            f"-> Loan Amount requested: ${loan_amount:,.2f} (75% LTC)\n"
            f"-> DSCR (Debt Service Coverage Ratio): {dscr:.2f}x\n"
            f"-> Cash-on-Cash Return: {cash_on_cash_return:.2f}%\n"
        )
        if is_approved:
            assessment += "-> DIRECTIVE: Deal metrics exceed minimum bank requirements. Cleared for financing."
        else:
            assessment += "-> DIRECTIVE: Deal fails bank stress test. Either inject more equity or renegotiate costs."

        metrics = {
            "loan_amount": loan_amount,
            "equity_required": equity_required,
            "annual_debt_service": annual_debt_service,
            "net_cash_flow": net_cash_flow,
            "dscr": round(dscr, 2),
            "cash_on_cash_return": round(cash_on_cash_return, 2),
            "interest_rate_assumed": f"{interest_rate*100}%",
            "is_approved": is_approved
        }

        return {
            "status": status,
            "engine": "BankUnderwritingIntelligenceEngine",
            "assessment": assessment,
            "metrics": metrics
        }

if __name__ == "__main__":
    import json
    engine = BankUnderwritingIntelligenceEngine()
    print(json.dumps(engine.execute({"construction_cost": 28500000, "projected_noi": 4200000}), indent=2))
