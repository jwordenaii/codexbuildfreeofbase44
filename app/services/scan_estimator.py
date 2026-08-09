"""Estimate generator for scan campaign properties.

Adapted from NewRepo's Worden Standard prototype
(apps/api/app/services/scan_estimator.py). NewRepo's version mapped
recommended services onto a standalone `pricing_engine.estimate_price()`
module that does not exist in this backend. This backend already has an
equivalent, more sophisticated pricing engine —
`app/services/math_ai_service.py`'s `math_ai.estimate_project_cost()`
(SciPy-derived confidence interval, state-cost-multiplier table) — which is
already used by the driveway-growth router (see app/routers/driveway_growth.py).
This module reuses that engine instead of duplicating pricing logic.
"""
from __future__ import annotations

from dataclasses import dataclass

from .math_ai_service import math_ai

# Map GPT-4o Vision's recommended service label -> (math_ai_service service_type, driveway_fraction)
# driveway_fraction: portion of lot_size_sqft assumed to be the target surface,
# matching NewRepo's scan_estimator.py fractions.
_SERVICE_MAP: dict[str, tuple[str, float]] = {
    'driveway resurfacing':    ('driveway',      0.30),
    'crack filling':           ('crackfill',     0.30),
    'sealcoating':             ('sealcoating',   0.30),
    'parking lot paving':      ('parking_lot',   0.60),
    'milling and overlay':     ('overlay',       0.50),
    'concrete repair':         ('concrete',      0.25),
    'drainage correction':     ('civil_site_work', 0.35),
    'maintenance inspection':  ('maintenance',   0.30),
    'chip seal':               ('sealcoating',   0.30),  # no dedicated chip-seal rate; closest analog
    'line striping':           ('striping',      0.60),
}

_DEFAULT_SERVICE = ('sealcoating', 0.30)
_MIN_SQFT = 400.0


@dataclass
class PropertyEstimate:
    service_label: str
    service_type: str
    sqft: float
    estimate_low: float
    estimate_high: float
    state_code: str
    multiplier: float


def estimate_for_property(
    services_recommended: list[str],
    lot_size_sqft: float,
    state_code: str,
) -> PropertyEstimate:
    """Generate a price estimate for the top recommended service on a parcel."""
    # Pick first recognisable service from recommendations
    service_label = ''
    mapping = _DEFAULT_SERVICE
    for svc in services_recommended:
        key = svc.lower().strip()
        if key in _SERVICE_MAP:
            service_label = svc
            mapping = _SERVICE_MAP[key]
            break

    if not service_label:
        service_label = services_recommended[0] if services_recommended else 'sealcoating'
        mapping = _SERVICE_MAP.get(service_label.lower(), _DEFAULT_SERVICE)

    service_type, fraction = mapping
    sqft = max(lot_size_sqft * fraction, _MIN_SQFT)

    result = math_ai.estimate_project_cost(
        sqft=sqft,
        service_type=service_type,
        state=state_code or 'VA',
    )

    return PropertyEstimate(
        service_label=service_label,
        service_type=service_type,
        sqft=sqft,
        estimate_low=float(result.get('low_usd', 300.0)),
        estimate_high=float(result.get('high_usd', 600.0)),
        state_code=state_code or 'VA',
        multiplier=float(result.get('state_multiplier', 1.0)),
    )
