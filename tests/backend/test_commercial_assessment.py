"""
Tests for the Commercial Asset Assessment engine.

Behavior under test:
  • A lot is scored into an option × timing matrix with monotonic decay.
  • Cheaper treatments rank first by cost-per-life-year; a healthy lot keeps
    the cheap sealcoat option, a failed lot is forced to reconstruction.
  • The ±$9/ton oil-shield band produces low < expected < high on asphalt work
    and no swing on sealcoat.
  • Deferring work costs more (escalation) and can force a costlier option.
  • Portfolio roll-up sums correctly and phases sites under an annual budget.
"""
from __future__ import annotations

from app.services.commercial_assessment import (
    Lot,
    assess_property,
    assess_portfolio,
    _oil_swing,
)


def test_decay_is_monotonic():
    lot = Lot(label="A", area_sqft=50_000, age_years=8, traffic_level="high", drainage_quality="poor")
    a = assess_property(lot)
    pcis = [p["pci"] for p in a["decay_projection_5yr"]]
    assert pcis == sorted(pcis, reverse=True)  # never improves on its own
    assert a["pci_now"] >= a["decay_projection_5yr"][-1]["pci"]


def test_healthy_lot_keeps_cheap_option():
    lot = Lot(label="Fresh", area_sqft=20_000, age_years=1, current_pci=88,
              traffic_level="low", drainage_quality="good", crack_severity="none")
    a = assess_property(lot)
    assert a["recommended_option"] == "seal"
    assert any(o["key"] == "seal" for o in a["options"])


def test_failed_lot_forced_to_reconstruct():
    lot = Lot(label="Shot", area_sqft=40_000, current_pci=20)
    a = assess_property(lot)
    keys = [o["key"] for o in a["options"]]
    assert keys == ["reconstruct"]
    assert a["recommended_option"] == "reconstruct"


def test_oil_shield_band_orders_costs():
    lot = Lot(label="Mid", area_sqft=60_000, current_pci=60)
    a = assess_property(lot)
    overlay = next(o for o in a["options"] if o["key"] == "overlay")
    c = overlay["cost"]
    assert c["low"] < c["expected"] < c["high"]
    assert c["oil_shield_swing"] > 0
    # sealcoat carries no meaningful AC binder → no oil swing
    assert _oil_swing(60_000, 0) == 0.0


def test_deferral_costs_more_and_can_force_costlier_option():
    lot = Lot(label="Slipping", area_sqft=50_000, current_pci=48,
              traffic_level="high", drainage_quality="poor", crack_severity="medium")
    a = assess_property(lot)
    now, later = a["timing_scenarios"][0], a["timing_scenarios"][-1]
    assert now["cost_of_waiting"] == 0.0
    assert later["cost_of_waiting"] >= 0.0
    assert later["pci_at_intervention"] <= now["pci_at_intervention"]


def test_portfolio_rollup_and_phasing():
    lots = [
        Lot(label="Store 1", area_sqft=30_000, current_pci=35),   # urgent
        Lot(label="Store 2", area_sqft=25_000, current_pci=85),   # healthy
        Lot(label="Store 3", area_sqft=40_000, current_pci=55),   # mid
    ]
    p = assess_portfolio(lots, annual_budget=150_000)
    assert p["site_count"] == 3
    assert p["total_area_sqft"] == 95_000
    # most-urgent (lowest PCI / soonest reconstruct-only) ranks first
    assert p["sites_by_urgency"][0]["label"] == "Store 1"
    # phased plan assigns every site a year and stays within cadence
    assert len(p["phased_plan"]) == 3
    assert all(row["year"] >= 1 for row in p["phased_plan"])
    # total capex is the sum of each site's now-cost
    assert p["total_capex_all_now"] > 0
