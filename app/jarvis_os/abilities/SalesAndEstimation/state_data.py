import logging

logger = logging.getLogger(__name__)

# State-by-State Construction Cost Index Multipliers
# Baseline 1.0 represents the national average.
STATE_MULTIPLIERS = {
    "AL": 0.88, "AK": 1.25, "AZ": 0.98, "AR": 0.87, "CA": 1.35,
    "CO": 1.05, "CT": 1.15, "DE": 1.08, "FL": 0.95, "GA": 0.92,
    "HI": 1.40, "ID": 0.96, "IL": 1.12, "IN": 0.94, "IA": 0.93,
    "KS": 0.91, "KY": 0.89, "LA": 0.92, "ME": 1.02, "MD": 1.09,
    "MA": 1.22, "MI": 1.03, "MN": 1.06, "MS": 0.86, "MO": 0.95,
    "MT": 0.97, "NE": 0.93, "NV": 1.04, "NH": 1.07, "NJ": 1.20,
    "NM": 0.95, "NY": 1.30, "NC": 0.91, "ND": 0.96, "OH": 0.98,
    "OK": 0.89, "OR": 1.10, "PA": 1.08, "RI": 1.14, "SC": 0.90,
    "SD": 0.92, "TN": 0.91, "TX": 0.96, "UT": 1.01, "VT": 1.05,
    "VA": 1.02, "WA": 1.15, "WV": 0.90, "WI": 1.02, "WY": 0.98,
}

def get_price_multiplier(state_code: str) -> float:
    """
    Returns the localized pricing multiplier for a given US state code.
    Defaults to 1.0 (national average) if state is unknown.
    """
    if not state_code:
        return 1.0
    return STATE_MULTIPLIERS.get(state_code.upper(), 1.0)

class StateDataEngine:
    """
    Provides real-time, state-level pricing indices and cost adjustments.
    """
    def __init__(self):
        self.module_id = "state_data"
        
    def execute(self, params: dict = None) -> dict:
        state_code = params.get("state", "US-AVG") if params else "US-AVG"
        multiplier = get_price_multiplier(state_code)
        
        return {
            "status": "success",
            "state_code": state_code.upper(),
            "price_multiplier": multiplier,
            "description": f"Cost of construction in {state_code.upper()} is {multiplier*100}% of the national average."
        }
