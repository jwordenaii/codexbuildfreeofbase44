"""
Lead scoring logic for J. Worden & Sons quote requests.

Score bands:
  HOT  (70-100) — large commercial, urgent → call within 1 hour
  WARM (45-69)  — mid-size or soon → call same business day
  COOL (0-44)   — small residential, flexible → call within 48 hours

State-awareness:
  QSR-dense states (VA, TX, FL, NC, GA, NY, NJ, MI, OH, IL, CA, PA) get +5
  High-labor markets get +3 (larger average job value)
"""

from .state_data import STATE_MAP

_QSR_HIGH_STATES = {
    "VA","TX","FL","NC","GA","NY","NJ","MI","OH","IL","CA","PA","MD","TN","MO","IN","WA",
}
_HIGH_LABOR_STATES = {
    "NY","CA","HI","AK","MA","CT","NJ","WA","IL","MD","OR","MN",
}


def score_lead(data: dict) -> dict:
    score = 0

    # ── Project size ──────────────────────────────────────────────────────────
    sqft = float(data.get("project_size_sqft") or 0)
    if sqft >= 10_000:
        score += 40
    elif sqft >= 5_000:
        score += 30
    elif sqft >= 1_000:
        score += 20
    else:
        score += 10

    # ── Property type ─────────────────────────────────────────────────────────
    if data.get("property_type", "").lower() == "commercial":
        score += 20
    else:
        score += 10

    # ── Urgency ───────────────────────────────────────────────────────────────
    urgency_scores = {
        "asap": 30,
        "within_1_week": 20,
        "within_1_month": 10,
        "flexible": 5,
    }
    score += urgency_scores.get(data.get("urgency", "flexible"), 5)

    # ── Service type bonus (high-value services) ──────────────────────────────
    high_value = {"parking_lot", "commercial_paving", "paving"}
    if data.get("service_type", "").lower() in high_value:
        score += 10

    # ── State-aware bonuses ───────────────────────────────────────────────────
    state = (data.get("state_code") or "").upper().strip()
    if state in _QSR_HIGH_STATES:
        score += 5   # QSR-dense market — higher franchise opportunity
    if state in _HIGH_LABOR_STATES:
        score += 3   # High-labor market — larger average job value

    # ── Classify ──────────────────────────────────────────────────────────────
    if score >= 70:
        label, priority, follow_up = "HOT", 1, "Call within 1 hour"
    elif score >= 45:
        label, priority, follow_up = "WARM", 2, "Call same business day"
    else:
        label, priority, follow_up = "COOL", 3, "Call within 48 hours"

    return {
        "score": score,
        "label": label,
        "priority": priority,
        "follow_up_sla": follow_up,
    }
