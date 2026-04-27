"""
Ballpark pricing estimator for J. Worden & Sons quote requests.

Math basis (industry-standard cost ranges):
  Residential paving          $3.50 – $8.00 / sq ft
  Commercial paving           $2.50 – $6.00 / sq ft  (volume & mobilization efficiencies)
  Sealcoating                 $0.15 – $0.35 / sq ft
  Crack filling               $0.40 – $1.00 / sq ft  (average crack density assumption)
  Parking lot                 $3.00 – $7.00 / sq ft
  Driveway                    $3.50 – $7.50 / sq ft
  Maintenance plan            $0.20 – $0.45 / sq ft / year
  General contracting         $75 – $250 / sq ft  (managed construction cost)
  Interior design             $5 – $25 / sq ft  (design fee; FF&E costs excluded)
  Cobblestone / brick pavers  $15 – $60 / sq ft  (installed)
  Stone masonry               $30 – $100 / sq ft  (installed wall/patio surface)

All estimates include a $300 mobilization floor — no job dispatches for less.
Returned figures are rounded to the nearest $50 for realistic quoting.

Verification:
  1 000 sq ft residential paving  → $3 500 – $8 000  ✓
  5 000 sq ft commercial paving   → $12 500 – $30 000 ✓
  2 000 sq ft sealcoating         → $300 – $700       ✓ (above mobilization floor)
  500 sq ft cobblestone patio     → $7 500 – $27 500  ✓
  200 sq ft stone masonry wall    → $6 000 – $17 000  ✓
"""

# ── Rate table: service → property_type → (low, high) $/sq ft ────────────────

_RATES: dict[str, dict[str, tuple[float, float]]] = {
    "paving":               {"residential": (3.50, 8.00),   "commercial": (2.50, 6.00)},
    "sealcoating":          {"residential": (0.15, 0.35),   "commercial": (0.12, 0.30)},
    "crackfill":            {"residential": (0.40, 1.00),   "commercial": (0.35, 0.90)},
    "parking_lot":          {"residential": (3.00, 7.00),   "commercial": (3.00, 7.00)},
    "driveway":             {"residential": (3.50, 7.50),   "commercial": (3.00, 6.50)},
    "maintenance":          {"residential": (0.20, 0.40),   "commercial": (0.18, 0.40)},
    # General Contracting — managed construction cost per sq ft (all-in build)
    "general_contracting":  {"residential": (85.00, 250.00), "commercial": (75.00, 200.00)},
    # Interior Design — design/coordination fee per sq ft of designed space
    "interior_design":      {"residential": (5.00, 18.00),  "commercial": (8.00, 25.00)},
    # Cobblestone & Brick Paver Patios — fully installed sq ft
    "cobblestone_pavers":   {"residential": (15.00, 55.00), "commercial": (18.00, 60.00)},
    # Stone Masonry — installed surface sq ft (wall face or patio)
    "stone_masonry":        {"residential": (30.00, 85.00), "commercial": (35.00, 100.00)},
    # ── 3D Visualizer build types ─────────────────────────────────────────────
    # New Construction — full turnkey build cost per sq ft
    "new_construction_residential": {"residential": (120.00, 320.00), "commercial": (110.00, 280.00)},
    # Addition / Remodel — per sq ft of added/renovated space
    "addition":             {"residential": (90.00, 250.00),  "commercial": (100.00, 275.00)},
    # ADU — detached or attached accessory dwelling unit, turnkey
    "adu":                  {"residential": (150.00, 400.00), "commercial": (140.00, 350.00)},
    # Commercial New Build — shell + tenant improvements per sq ft
    "commercial_build":     {"residential": (100.00, 260.00), "commercial": (90.00, 240.00)},
}

_MOBILISATION_FLOOR_LOW  = 300.0   # minimum low-end job cost
_MOBILISATION_FLOOR_HIGH = 600.0   # minimum high-end job cost
_ROUND_TO = 50                     # round to nearest $50


def _round_to_nearest(value: float, nearest: int) -> int:
    return int(round(value / nearest) * nearest)


def estimate_price(
    service_type: str,
    property_type: str,
    project_size_sqft: float,
    state_code: str | None = None,
    include_material_adjustment: bool = True,
) -> dict | None:
    """
    Return a ballpark cost range or None if the service is not recognised.

    Parameters
    ----------
    service_type               : one of the keys in _RATES
    property_type              : 'residential' | 'commercial'
    project_size_sqft          : positive float
    state_code                 : optional 2-letter state abbreviation for regional adjustment
    include_material_adjustment: when True, applies live EIA asphalt price multiplier (Feature 7)

    Returns
    -------
    {
        "low_usd":       int,
        "high_usd":      int,
        "low_fmt":       str,
        "high_fmt":      str,
        "multiplier":    float,   # state adjustment applied (1.0 = national average)
        "material_note": str,     # live material price note (Feature 7)
        "disclaimer":    str,
    }
    """
    from .state_data import get_price_multiplier  # noqa: PLC0415

    service   = (service_type  or "").lower().strip()
    property_ = (property_type or "residential").lower().strip()
    sqft      = float(project_size_sqft or 0)

    if service not in _RATES or sqft <= 0:
        return None

    rates = _RATES[service].get(property_) or _RATES[service].get("residential")
    if not rates:
        return None

    multiplier = get_price_multiplier(state_code) if state_code else 1.0

    # Feature 7: Apply live material price multiplier
    material_note = ""
    material_multiplier = 1.0
    if include_material_adjustment:
        try:
            from .material_prices import get_price_multiplier_with_materials  # noqa: PLC0415
            mat_result = get_price_multiplier_with_materials(state_code or "US", service)
            material_multiplier = mat_result.get("multiplier", 1.0)
            material_note = mat_result.get("note", "")
        except Exception:  # noqa: BLE001
            pass

    combined = multiplier * material_multiplier
    low_raw  = rates[0] * sqft * combined
    high_raw = rates[1] * sqft * combined

    low  = max(_round_to_nearest(low_raw,  _ROUND_TO), int(_MOBILISATION_FLOOR_LOW))
    high = max(_round_to_nearest(high_raw, _ROUND_TO), int(_MOBILISATION_FLOOR_HIGH))

    def fmt(n: int) -> str:
        return f"${n:,}"

    return {
        "low_usd":        low,
        "high_usd":       high,
        "low_fmt":        fmt(low),
        "high_fmt":       fmt(high),
        "multiplier":     round(multiplier, 3),
        "material_note":  material_note,
        "disclaimer": (
            "Ballpark estimate only — final price depends on site conditions, "
            "material costs, and access. A free on-site quote is always included."
        ),
    }
