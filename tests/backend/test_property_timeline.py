"""
Tests for the property condition timeline engine.

Behavior under test:
  • A single snapshot yields no observed trend but still assesses.
  • Two+ dated snapshots produce a measured annual PCI loss.
  • Accelerating decline is flagged.
  • When history is observed, the assessment projection is grounded in the
    observed rate (projection_basis == 'observed_history'), not the table.
  • Vision score (higher = worse) inverts correctly to PCI.
"""
from __future__ import annotations

import pytest

from app.services.property_timeline import (
    ConditionSnapshot,
    compute_trend,
    assess_with_history,
    pci_from_vision_score,
)


def test_vision_score_inverts_to_pci():
    assert pci_from_vision_score(75) == 25.0   # high opportunity => low PCI
    assert pci_from_vision_score(10) == 90.0
    assert pci_from_vision_score(120) == 0.0   # clamped
    assert pci_from_vision_score(-5) == 100.0  # clamped


def test_single_snapshot_no_trend():
    t = compute_trend([ConditionSnapshot("2026-01-01", 80.0)])
    assert t["observed"] is False
    assert t["latest_pci"] == 80.0


def test_measured_decay_rate():
    snaps = [
        ConditionSnapshot("2022-06-01", 90.0, source="imagery"),
        ConditionSnapshot("2026-06-01", 62.0, source="drone", area_sqft=40_000),
    ]
    t = compute_trend(snaps)
    assert t["observed"] is True
    assert t["captures"] == 2
    assert t["total_pci_lost"] == 28.0
    # ~28 points over ~4.0 years => ~7 pts/yr
    assert 6.5 <= t["observed_annual_pci_loss"] <= 7.5


def test_acceleration_flag():
    snaps = [
        ConditionSnapshot("2020-01-01", 95.0),
        ConditionSnapshot("2023-01-01", 88.0),   # ~2.3/yr
        ConditionSnapshot("2026-01-01", 60.0, area_sqft=30_000),  # ~9.3/yr
    ]
    t = compute_trend(snaps)
    assert t["accelerating"] is True


def test_assessment_uses_observed_history():
    snaps = [
        ConditionSnapshot("2022-06-01", 90.0, source="imagery"),
        ConditionSnapshot("2026-06-01", 62.0, source="drone", area_sqft=40_000),
    ]
    out = assess_with_history(snaps, label="Store 42")
    assert out["assessment"]["projection_basis"] == "observed_history"
    # latest PCI drives current condition
    assert out["assessment"]["pci_now"] == 62.0
    # projection uses the steep observed rate -> reconstruct-only sooner than
    # the gentle default table would predict
    assert out["assessment"]["years_until_reconstruct_only"] is not None


def test_area_required_when_absent():
    with pytest.raises(ValueError):
        assess_with_history([ConditionSnapshot("2026-01-01", 70.0)], label="No Area")
