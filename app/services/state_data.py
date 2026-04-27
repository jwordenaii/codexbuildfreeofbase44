"""
state_data.py — Python mirror of src/lib/states50.js

Single source of truth for 50-state data inside the Python backend.
Mirrors the laborIndex, materialPremium, compliance flags, and
helper functions from the JS module so the AI engine can inject
state context into prompts without crossing the JS/Python boundary.

Data kept in sync with states50.js — update both when figures change.
lastVerified: 2026-04-25
"""

from __future__ import annotations
from typing import Optional

# (abbr, name, region, laborIdx, matPrem, aspMonths,
#  prevWage, stateLic, stateOsha, swpppAcres, qsrDensity)
_RAW: list[tuple] = [
    ("AL","Alabama",       "Southeast", 0.82,1.40,9, False,True, False,1.0,"medium"),
    ("AK","Alaska",        "West",      1.40,1.35,4, False,False,True, 1.0,"low"),
    ("AZ","Arizona",       "Southwest", 0.92,0.96,10,False,True, True, 1.0,"medium"),
    ("AR","Arkansas",      "Southeast", 0.80,0.91,8, False,True, False,1.0,"medium"),
    ("CA","California",    "West",      1.35,1.10,9, True, True, True, 1.0,"high"),
    ("CO","Colorado",      "West",      1.07,1.00,6, False,False,True, 1.0,"medium"),
    ("CT","Connecticut",   "Northeast", 1.28,1.12,7, True, True, True, 1.0,"medium"),
    ("DE","Delaware",      "Northeast", 1.03,1.02,8, True, True, True, 1.0,"low"),
    ("FL","Florida",       "Southeast", 0.90,0.95,11,False,True, False,1.0,"high"),
    ("GA","Georgia",       "Southeast", 0.87,0.93,9, False,True, False,1.0,"high"),
    ("HI","Hawaii",        "West",      1.45,1.40,12,True, True, True, 1.0,"low"),
    ("ID","Idaho",         "West",      0.88,0.97,6, False,True, False,1.0,"low"),
    ("IL","Illinois",      "Midwest",   1.15,1.00,7, True, False,True, 1.0,"high"),
    ("IN","Indiana",       "Midwest",   0.88,0.97,7, False,False,False,1.0,"medium"),
    ("IA","Iowa",          "Midwest",   0.86,0.97,6, False,False,False,1.0,"medium"),
    ("KS","Kansas",        "Midwest",   0.87,0.95,7, False,False,False,1.0,"medium"),
    ("KY","Kentucky",      "Southeast", 0.86,0.95,8, False,True, True, 1.0,"medium"),
    ("LA","Louisiana",     "Southeast", 0.84,0.91,10,False,True, True, 1.0,"medium"),
    ("ME","Maine",         "Northeast", 0.88,1.05,6, False,True, False,1.0,"low"),
    ("MD","Maryland",      "Northeast", 1.12,1.02,8, True, True, True, 1.0,"high"),
    ("MA","Massachusetts", "Northeast", 1.30,1.15,7, True, True, True, 1.0,"high"),
    ("MI","Michigan",      "Midwest",   0.95,0.97,6, False,True, True, 1.0,"high"),
    ("MN","Minnesota",     "Midwest",   1.08,0.97,5, True, False,True, 1.0,"medium"),
    ("MS","Mississippi",   "Southeast", 0.78,0.90,9, False,True, False,1.0,"medium"),
    ("MO","Missouri",      "Midwest",   0.87,0.95,7, False,False,False,1.0,"medium"),
    ("MT","Montana",       "West",      0.85,0.97,5, False,True, False,1.0,"low"),
    ("NE","Nebraska",      "Midwest",   0.86,0.95,7, False,True, False,1.0,"medium"),
    ("NV","Nevada",        "West",      0.93,0.98,9, False,True, True, 0.25,"medium"),
    ("NH","New Hampshire", "Northeast", 1.00,1.03,6, False,True, False,1.0,"low"),
    ("NJ","New Jersey",    "Northeast", 1.25,1.12,7, True, True, True, 1.0,"high"),
    ("NM","New Mexico",    "Southwest", 0.83,0.95,9, False,True, True, 1.0,"low"),
    ("NY","New York",      "Northeast", 1.38,1.18,7, True, False,True, 1.0,"high"),
    ("NC","North Carolina","Southeast", 0.88,0.93,8, False,True, False,1.0,"high"),
    ("ND","North Dakota",  "Midwest",   0.88,0.97,5, False,True, False,1.0,"low"),
    ("OH","Ohio",          "Midwest",   0.95,0.97,7, False,False,True, 1.0,"high"),
    ("OK","Oklahoma",      "South",     0.83,0.91,8, False,True, False,1.0,"medium"),
    ("OR","Oregon",        "West",      1.10,1.06,8, True, True, True, 1.0,"medium"),
    ("PA","Pennsylvania",  "Northeast", 1.05,1.01,7, True, False,True, 1.0,"high"),
    ("RI","Rhode Island",  "Northeast", 1.03,1.06,7, True, True, True, 0.5,"low"),
    ("SC","South Carolina","Southeast", 0.85,0.92,9, False,True, True, 1.0,"medium"),
    ("SD","South Dakota",  "Midwest",   0.83,0.95,5, False,True, False,1.0,"low"),
    ("TN","Tennessee",     "Southeast", 0.85,0.93,8, False,True, True, 1.0,"medium"),
    ("TX","Texas",         "South",     0.92,0.93,10,False,False,False,1.0,"high"),
    ("UT","Utah",          "West",      0.92,0.96,7, False,True, True, 1.0,"medium"),
    ("VT","Vermont",       "Northeast", 0.90,1.05,6, True, True, True, 0.5,"low"),
    ("VA","Virginia",      "Southeast", 0.97,0.95,8, True, True, True, 1.0,"high"),
    ("WA","Washington",    "West",      1.22,1.08,7, True, True, True, 0.2,"medium"),
    ("WV","West Virginia", "Southeast", 0.82,0.93,7, False,True, True, 1.0,"low"),
    ("WI","Wisconsin",     "Midwest",   0.93,0.97,6, False,False,True, 1.0,"medium"),
    ("WY","Wyoming",       "West",      0.88,0.97,5, False,True, False,1.0,"low"),
    ("DC","Washington DC", "Northeast", 1.35,1.05,8, True, True, True, 1.0,"high"),
]

_FIELDS = (
    "abbr","name","region","laborIndex","materialPremium","asphaltMonths",
    "hasPrevailingWage","hasStateLicensing","hasStateOsha","swpppAcres","qsrDensity",
)

# Build lookup dict
STATE_MAP: dict[str, dict] = {
    row[0]: dict(zip(_FIELDS, row)) for row in _RAW
}

WORDEN_ACTIVE_STATES = [
    "VA","NC","GA","FL","MI","TX","KS","MO","IA","MN","NY","NJ",
]


def get_price_multiplier(abbr: str) -> float:
    """Returns state-adjusted pricing multiplier (labor 65% + material 35%)."""
    s = STATE_MAP.get(abbr.upper())
    if not s:
        return 1.0
    return round((s["laborIndex"] * 0.65) + (s["materialPremium"] * 0.35), 3)


def get_state_summary(abbr: str) -> Optional[dict]:
    """Returns enriched state summary with compliance notes and pricing context."""
    s = STATE_MAP.get(abbr.upper())
    if not s:
        return None
    notes = []
    if s["hasStateLicensing"]:  notes.append("State contractor license required")
    if s["hasPrevailingWage"]:  notes.append("Prevailing wage applies to public work")
    if s["hasStateOsha"]:       notes.append("State OSHA plan (may exceed federal)")
    if s["swpppAcres"] < 1.0:   notes.append(f"SWPPP for disturbances ≥{s['swpppAcres']} ac")
    m = get_price_multiplier(abbr)
    return {
        **s,
        "priceMultiplier": m,
        "complianceNotes": notes,
        "pricingNote": (
            f"Labor and material costs in {s['name']} run above the national average."
            if m > 1.05 else
            f"{s['name']} has below-average labor costs — favorable for project budgets."
            if m < 0.90 else
            f"{s['name']} is near the national average for paving costs."
        ),
    }


def get_state_prompt_fragment(abbr: str) -> str:
    """Returns a compact state context string for AI system prompt injection."""
    s = get_state_summary(abbr)
    if not s:
        return ""
    return (
        f"[{abbr} context: "
        f"License required: {'YES' if s['hasStateLicensing'] else 'NO'}, "
        f"Prevailing wage: {'YES (public work)' if s['hasPrevailingWage'] else 'NO'}, "
        f"State OSHA: {'YES' if s['hasStateOsha'] else 'NO'}, "
        f"SWPPP threshold: {s['swpppAcres']} ac, "
        f"Price index: {s['priceMultiplier']:.2f}x national avg, "
        f"Season: {s['asphaltMonths']} months, "
        f"QSR density: {s['qsrDensity']}]"
    )
