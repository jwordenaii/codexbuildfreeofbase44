"""
property_timeline.py — dated condition history for a commercial asset.

The honest "Google timeline" for pavement. Google's imagery APIs return only
*current* imagery, so a real multi-year degradation record is built from OUR
own dated captures: each time a lot is scanned — from current aerial imagery
(Solar/Aerial + vision), a drone flight, or a field visit — its condition is
date-stamped and stored. This module turns that series into a measured decay
trend and feeds the latest reading into the commercial assessment engine.

Two payoffs over a generic decay table:
  1. When two or more captures exist, the *observed* annual PCI loss replaces
     the table estimate — the projection is grounded in this lot's real
     history, not an industry average.
  2. The dated series is proprietary evidence (the "cost of waiting" made
     visible on the client's own property) that no competitor can reproduce.

Pure computation. Condition inputs come from whatever source captured them and
are never fabricated; imagery acquisition + vision scoring live in the takeoff
and property_vision services and are separately key-gated.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Optional

from .commercial_assessment import Lot, assess_property

_VALID_SOURCES = {"imagery", "drone", "field", "vision"}


@dataclass
class ConditionSnapshot:
    captured_at: str          # ISO date "YYYY-MM-DD"
    pci: float                # 0-100 condition at capture
    source: str = "field"     # imagery | drone | field | vision
    area_sqft: Optional[float] = None
    notes: Optional[str] = None

    def as_date(self) -> date:
        return datetime.strptime(self.captured_at[:10], "%Y-%m-%d").date()


def pci_from_vision_score(overall_score: float) -> float:
    """property_vision returns 0-100 where higher = worse condition (more
    opportunity). PCI is the inverse: higher = better pavement."""
    return round(max(0.0, min(100.0, 100.0 - float(overall_score))), 1)


def _years_between(a: date, b: date) -> float:
    return (b - a).days / 365.25


def compute_trend(snapshots: list[ConditionSnapshot]) -> dict[str, Any]:
    """Observed decay across a dated series (chronological)."""
    if not snapshots:
        return {"observed": False, "reason": "no snapshots"}
    ordered = sorted(snapshots, key=lambda s: s.as_date())
    if len(ordered) == 1:
        return {
            "observed": False,
            "reason": "single snapshot — no interval to measure",
            "latest_pci": ordered[0].pci,
            "latest_date": ordered[0].captured_at,
        }
    first, last = ordered[0], ordered[-1]
    span_years = _years_between(first.as_date(), last.as_date())
    if span_years <= 0:
        return {
            "observed": False,
            "reason": "captures share a date",
            "latest_pci": last.pci,
            "latest_date": last.captured_at,
        }
    total_drop = first.pci - last.pci
    annual = total_drop / span_years
    # Segment-by-segment rates to detect acceleration.
    segments = []
    for a, b in zip(ordered, ordered[1:]):
        yrs = _years_between(a.as_date(), b.as_date())
        rate = round((a.pci - b.pci) / yrs, 2) if yrs > 0 else None
        segments.append({
            "from": a.captured_at, "to": b.captured_at,
            "pci_from": a.pci, "pci_to": b.pci, "annual_pci_loss": rate,
        })
    rates = [s["annual_pci_loss"] for s in segments if s["annual_pci_loss"] is not None]
    accelerating = len(rates) >= 2 and rates[-1] > rates[0] * 1.15
    return {
        "observed": True,
        "captures": len(ordered),
        "span_years": round(span_years, 2),
        "first_date": first.captured_at,
        "first_pci": first.pci,
        "latest_date": last.captured_at,
        "latest_pci": last.pci,
        "total_pci_lost": round(total_drop, 1),
        "observed_annual_pci_loss": round(annual, 2),
        "segments": segments,
        "accelerating": accelerating,
    }


def assess_with_history(
    snapshots: list[ConditionSnapshot],
    label: str,
    pavement_type: str = "commercial_parking_lot",
    traffic_level: str = "medium",
    drainage_quality: str = "fair",
    crack_severity: str = "low",
    area_sqft: Optional[float] = None,
    site_id: Optional[str] = None,
) -> dict[str, Any]:
    """Fold a dated capture history into a full commercial assessment.

    The latest capture sets current PCI. When the history shows a measured
    decay rate, that rate overrides the generic table projection so the
    'cost of waiting' reflects THIS lot's real trajectory.
    """
    trend = compute_trend(snapshots)
    ordered = sorted(snapshots, key=lambda s: s.as_date()) if snapshots else []
    latest = ordered[-1] if ordered else None
    area = area_sqft or (latest.area_sqft if latest else None)
    if area is None:
        raise ValueError("area_sqft required (none on latest snapshot)")

    lot = Lot(
        label=label,
        area_sqft=area,
        pavement_type=pavement_type,
        current_pci=latest.pci if latest else None,
        traffic_level=traffic_level,
        drainage_quality=drainage_quality,
        crack_severity=crack_severity,
        site_id=site_id,
    )
    assessment = assess_property(lot)

    # If we measured a real decay rate, re-project the decay curve and the
    # years-until-reconstruct-only using the observed rate.
    observed_rate = trend.get("observed_annual_pci_loss") if trend.get("observed") else None
    if observed_rate and observed_rate > 0 and latest:
        base = latest.pci
        assessment["decay_projection_5yr"] = [
            {"year": y, "pci": round(max(5.0, base - observed_rate * y), 1)}
            for y in range(0, 6)
        ]
        yrs = None
        for y in range(0, 41):
            if base - observed_rate * y < 45.0:
                yrs = y
                break
        assessment["years_until_reconstruct_only"] = yrs
        assessment["projection_basis"] = "observed_history"
    else:
        assessment["projection_basis"] = "decay_model"

    return {
        "timeline": trend,
        "assessment": assessment,
    }
