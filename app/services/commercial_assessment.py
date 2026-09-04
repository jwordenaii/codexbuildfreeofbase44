"""
commercial_assessment.py — Commercial Asset Assessment engine.

Turns a corporate client's pavement assets into a decision matrix: for each
lot, every viable treatment OPTION crossed with every TIMING scenario
(act now / defer 1yr / defer 3yr), priced with the Worden oil-shield band,
plus a portfolio roll-up that phases capital across many sites.

This module is pure computation — no network, no API keys. It composes the
same pavement-decay physics and unit rates already used by the takeoff and
plan-estimator pipelines, so a lot assessed here prices the same way a plan
priced elsewhere does. Live aerial/satellite imagery and Google historical
"timeline" imagery are a separate, billing-gated data source that feeds this
engine its condition inputs; this engine runs on whatever inputs it is given
(field survey, drone scan, or imagery-derived), and never invents them.

Worden Standards honored:
  - 96% Marshall compaction floor is assumed for every new/overlay lift.
  - VDOT Section 315 structural stone base underpins reconstruction.
  - ±$9/ton liquid-asphalt oil-shield band on every asphalt-tonnage cost,
    so each option carries an honest low/expected/high driven by AC price.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any, Optional

# --- Pavement decay model (annual PCI points lost) ----------------------------
# Mirrors the decay tables in routers/takeoff.py so a lot degrades identically
# wherever it is scored. Base decay is the healthy-surface loss; the modifiers
# add the punishment of traffic, poor drainage and existing cracking.
_BASE_ANNUAL_DECAY = {
    "residential_driveway": 2.0,
    "commercial_parking_lot": 3.2,
    "road": 4.0,
}
_TRAFFIC_DECAY = {"low": 0.0, "medium": 1.0, "high": 2.2, "heavy_truck": 4.0}
_DRAINAGE_DECAY = {"good": 0.0, "fair": 1.0, "poor": 3.0}
_CRACK_DECAY = {"none": 0.0, "low": 0.8, "medium": 2.0, "high": 4.0}

# --- Unit rates (USD) ---------------------------------------------------------
# Kept in lockstep with plan_estimator._FALLBACK_RATES. These are the
# conservative LOW-end catalog rates; the oil-shield band widens asphalt work
# up and down from here.
RATE_SEALCOAT = 0.22        # sqft, 2 coats
RATE_CRACKFILL = 0.85       # lf equivalent, applied as a per-sqft loading below
RATE_MILL = 1.20            # sqft, 2" mill
RATE_OVERLAY = 2.80         # sqft, 1.5" overlay
RATE_STONE_BASE = 2.10      # sqft, 6" crusher-run (VDOT 315)
RATE_FULL_ASPHALT = 4.50    # sqft, 3" HMA on prepared base

# Oil-shield band: ±$9 per ton of liquid asphalt cement in the mix.
OIL_SHIELD_PER_TON = 9.0
# HMA tonnage: area(sqyd) * thickness(in) * 0.0575 tons/(sqyd-in) — industry
# rule of thumb at ~145 pcf compacted HMA.
_TONS_PER_SQYD_IN = 0.0575
# AC binder is ~5.8% of HMA mix weight by the Worden standard mix.
_AC_FRACTION = 0.058

# Contingency applied on top of direct cost for commercial mobilization,
# MOT, and the 96% compaction QC that the Worden Standard requires.
CONTINGENCY_PCT = 0.10

# Annual non-oil cost escalation used when a scenario defers work.
_ANNUAL_ESCALATION = 0.05

_PCI_FLOOR = 5.0
_PCI_NEW = 98.0


def _hma_tons(area_sqft: float, thickness_in: float) -> float:
    return (area_sqft / 9.0) * thickness_in * _TONS_PER_SQYD_IN


def _oil_swing(area_sqft: float, thickness_in: float) -> float:
    """Dollar swing (±) on a lift from the $9/ton AC band."""
    ac_tons = _hma_tons(area_sqft, thickness_in) * _AC_FRACTION
    return round(ac_tons * OIL_SHIELD_PER_TON, 2)


@dataclass
class Lot:
    label: str
    area_sqft: float
    pavement_type: str = "commercial_parking_lot"
    age_years: float = 10.0
    current_pci: Optional[float] = None  # 0-100; derived from age if absent
    traffic_level: str = "medium"
    drainage_quality: str = "fair"
    crack_severity: str = "low"
    site_id: Optional[str] = None

    def annual_decay(self) -> float:
        base = _BASE_ANNUAL_DECAY.get(self.pavement_type, 3.2)
        return (
            base
            + _TRAFFIC_DECAY.get(self.traffic_level, 1.0)
            + _DRAINAGE_DECAY.get(self.drainage_quality, 1.0)
            + _CRACK_DECAY.get(self.crack_severity, 0.8)
        )

    def pci_now(self) -> float:
        if self.current_pci is not None:
            return max(_PCI_FLOOR, min(100.0, float(self.current_pci)))
        # Derive from age when no measured PCI is supplied.
        projected = _PCI_NEW - self.annual_decay() * self.age_years
        return max(_PCI_FLOOR, min(100.0, projected))

    def pci_after(self, years: float) -> float:
        projected = self.pci_now() - self.annual_decay() * years
        return max(_PCI_FLOOR, min(100.0, projected))


# --- Treatment options --------------------------------------------------------
# Each option: which PCI band it is appropriate for, how many years of life it
# restores, its resulting PCI, and its direct cost + oil-shield swing.
@dataclass
class Option:
    key: str
    name: str
    min_pci: float          # lowest PCI at which this treatment is still sound
    life_years: int         # service life the treatment restores
    resulting_pci: float    # PCI immediately after treatment


TREATMENTS = [
    Option("seal", "Crack seal + sealcoat", min_pci=70.0, life_years=3, resulting_pci=82.0),
    Option("overlay", "Mill 2\" + 1.5\" overlay", min_pci=45.0, life_years=12, resulting_pci=95.0),
    Option("reconstruct", "Full-depth reclamation + 3\" HMA on VDOT 315 base", min_pci=0.0, life_years=22, resulting_pci=98.0),
]


def _option_cost(lot: Lot, opt: Option) -> dict[str, float]:
    """Direct cost with oil-shield low/expected/high for one option on one lot."""
    a = lot.area_sqft
    if opt.key == "seal":
        direct = a * (RATE_SEALCOAT + RATE_CRACKFILL * 0.05)  # crackfill loaded per sqft
        swing = 0.0  # negligible AC binder in sealer
    elif opt.key == "overlay":
        direct = a * (RATE_MILL + RATE_OVERLAY)
        swing = _oil_swing(a, 1.5)
    else:  # reconstruct
        direct = a * (RATE_STONE_BASE + RATE_FULL_ASPHALT)
        swing = _oil_swing(a, 3.0)
    expected = direct * (1 + CONTINGENCY_PCT)
    return {
        "direct": round(direct, 2),
        "low": round(expected - swing, 2),
        "expected": round(expected, 2),
        "high": round(expected + swing, 2),
        "oil_shield_swing": round(swing, 2),
    }


def _viable_options(pci: float) -> list[Option]:
    """Options sound at this PCI, cheapest first."""
    return [o for o in TREATMENTS if pci >= o.min_pci]


# --- Timing scenarios ---------------------------------------------------------
_TIMINGS = [("now", 0), ("defer_1yr", 1), ("defer_3yr", 3)]


def _timing_row(lot: Lot, defer_years: int) -> dict[str, Any]:
    pci_at = lot.pci_after(defer_years)
    viable = _viable_options(pci_at)
    # If deferral drops the lot below the cheap treatments' window, the
    # cheapest still-viable option is what waiting actually costs you.
    best = viable[0] if viable else TREATMENTS[-1]
    cost = _option_cost(lot, best)
    escalation = (1 + _ANNUAL_ESCALATION) ** defer_years
    escalated = {
        k: round(v * escalation, 2) if k in ("direct", "low", "expected", "high") else v
        for k, v in cost.items()
    }
    return {
        "timing": None,  # filled by caller
        "defer_years": defer_years,
        "pci_at_intervention": round(pci_at, 1),
        "forced_option": best.key,
        "forced_option_name": best.name,
        "options_still_viable": [o.key for o in viable],
        "cost": escalated,
    }


def assess_property(lot: Lot) -> dict[str, Any]:
    """Full option × timing matrix + recommendation for one lot."""
    pci = lot.pci_now()

    # Option matrix at "now": every viable treatment, priced, ranked by
    # lifecycle value (expected cost per year of life restored — lower is better).
    option_rows = []
    for opt in _viable_options(pci) or [TREATMENTS[-1]]:
        cost = _option_cost(lot, opt)
        value = round(cost["expected"] / max(opt.life_years, 1), 2)
        option_rows.append({
            "key": opt.key,
            "name": opt.name,
            "life_years": opt.life_years,
            "resulting_pci": opt.resulting_pci,
            "cost": cost,
            "cost_per_life_year": value,
        })
    option_rows.sort(key=lambda r: r["cost_per_life_year"])
    recommended = option_rows[0] if option_rows else None

    # Timing scenarios.
    timing_rows = []
    for name, years in _TIMINGS:
        row = _timing_row(lot, years)
        row["timing"] = name
        timing_rows.append(row)
    now_cost = timing_rows[0]["cost"]["expected"]
    for row in timing_rows:
        row["cost_of_waiting"] = round(row["cost"]["expected"] - now_cost, 2)

    # Do-nothing decay projection over 5 years.
    decay_curve = [
        {"year": y, "pci": round(lot.pci_after(y), 1)} for y in range(0, 6)
    ]

    # Urgency: how soon the lot falls below the overlay window (PCI 45).
    years_to_reconstruct_only = None
    for y in range(0, 21):
        if lot.pci_after(y) < 45.0:
            years_to_reconstruct_only = y
            break

    return {
        "lot": asdict(lot),
        "pci_now": round(pci, 1),
        "annual_decay_points": round(lot.annual_decay(), 2),
        "recommended_option": recommended["key"] if recommended else None,
        "options": option_rows,
        "timing_scenarios": timing_rows,
        "decay_projection_5yr": decay_curve,
        "years_until_reconstruct_only": years_to_reconstruct_only,
    }


def assess_portfolio(lots: list[Lot], annual_budget: Optional[float] = None) -> dict[str, Any]:
    """Assess many sites for one corporate client and phase the capital plan.

    Each site is scored, then ranked by urgency (soonest to fall out of its
    cheap-treatment window). If an annual_budget is given, sites are phased
    across years to stay under budget while doing the most-urgent first.
    """
    assessments = [assess_property(lot) for lot in lots]

    def urgency_key(a: dict[str, Any]) -> tuple:
        y = a["years_until_reconstruct_only"]
        return (999 if y is None else y, -a["annual_decay_points"])

    ranked = sorted(assessments, key=urgency_key)

    total_now = round(sum(a["timing_scenarios"][0]["cost"]["expected"] for a in ranked), 2)
    total_area = round(sum(a["lot"]["area_sqft"] for a in ranked), 2)

    # Phase into years under the budget cap (recommended option cost each).
    phased: list[dict[str, Any]] = []
    if annual_budget and annual_budget > 0:
        year = 1
        spent = 0.0
        for a in ranked:
            rec = next((o for o in a["options"] if o["key"] == a["recommended_option"]), None)
            cost = rec["cost"]["expected"] if rec else a["timing_scenarios"][0]["cost"]["expected"]
            if spent + cost > annual_budget and spent > 0:
                year += 1
                spent = 0.0
            spent += cost
            phased.append({
                "site": a["lot"]["label"],
                "year": year,
                "option": a["recommended_option"],
                "cost": round(cost, 2),
            })

    return {
        "site_count": len(lots),
        "total_area_sqft": total_area,
        "total_capex_all_now": total_now,
        "annual_budget": annual_budget,
        "sites_by_urgency": [
            {
                "label": a["lot"]["label"],
                "pci_now": a["pci_now"],
                "recommended_option": a["recommended_option"],
                "years_until_reconstruct_only": a["years_until_reconstruct_only"],
                "cost_now_expected": a["timing_scenarios"][0]["cost"]["expected"],
            }
            for a in ranked
        ],
        "phased_plan": phased,
        "assessments": assessments,
    }
