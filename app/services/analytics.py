"""
analytics.py — Business intelligence and analytics service for JWordenAI.

Provides aggregated metrics for the Command Center dashboard:
  - Lead funnel by stage/source/state/service
  - Revenue forecast from HOT leads
  - Permit-to-lead conversion rate
  - Review approval rates
  - Monthly lead volume trends

Public API
──────────
  get_lead_funnel(db) → dict
  get_revenue_forecast(db) → dict
  get_permit_to_lead_rate(db) → dict
  get_review_approval_rate(db) → dict
  get_monthly_lead_volume(db) → list
  get_full_dashboard(db) → dict
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# Average win rates and job values by service type (industry estimates)
_WIN_RATES = {
    "paving": 0.35,
    "sealcoating": 0.45,
    "crackfill": 0.50,
    "parking_lot": 0.30,
    "driveway": 0.40,
    "maintenance": 0.55,
}
_AVG_JOB_VALUES = {
    "paving": 18000,
    "sealcoating": 3500,
    "crackfill": 1200,
    "parking_lot": 25000,
    "driveway": 8000,
    "maintenance": 4500,
}
_DEFAULT_WIN_RATE = 0.35
_DEFAULT_JOB_VALUE = 12000


def get_lead_funnel(db) -> dict:
    """Return lead counts by stage, source (urgency), state, and service type."""
    try:
        from ..models import Lead  # noqa: PLC0415
        from sqlalchemy import func  # noqa: PLC0415

        # By pipeline stage
        stage_rows = (
            db.query(Lead.pipeline_stage, func.count(Lead.id))
            .group_by(Lead.pipeline_stage)
            .all()
        )
        by_stage = {row[0] or "new": row[1] for row in stage_rows}

        # By score label
        label_rows = (
            db.query(Lead.score_label, func.count(Lead.id))
            .group_by(Lead.score_label)
            .all()
        )
        by_label = {(row[0] or "unknown"): row[1] for row in label_rows}

        # By state
        state_rows = (
            db.query(Lead.address, func.count(Lead.id))
            .filter(Lead.address.isnot(None))
            .group_by(Lead.address)
            .limit(10)
            .all()
        )

        # By service type
        service_rows = (
            db.query(Lead.service_type, func.count(Lead.id))
            .group_by(Lead.service_type)
            .all()
        )
        by_service = {row[0]: row[1] for row in service_rows}

        # By urgency
        urgency_rows = (
            db.query(Lead.urgency, func.count(Lead.id))
            .group_by(Lead.urgency)
            .all()
        )
        by_urgency = {row[0]: row[1] for row in urgency_rows}

        total = db.query(Lead).count()

        return {
            "total_leads": total,
            "by_stage": by_stage,
            "by_score_label": by_label,
            "by_service": by_service,
            "by_urgency": by_urgency,
        }
    except Exception as exc:  # noqa: BLE001
        logger.error("get_lead_funnel error: %s", exc)
        return {"error": "An internal error occurred. Please try again."}


def get_revenue_forecast(db) -> dict:
    """Forecast revenue from HOT leads × win_rate × avg_job_value by service type."""
    try:
        from ..models import Lead  # noqa: PLC0415
        from sqlalchemy import func  # noqa: PLC0415

        hot_leads = (
            db.query(Lead.service_type, func.count(Lead.id))
            .filter(Lead.score_label == "HOT")
            .group_by(Lead.service_type)
            .all()
        )

        forecasts = []
        total_low = 0
        total_high = 0

        for service_type, count in hot_leads:
            win_rate = _WIN_RATES.get(service_type, _DEFAULT_WIN_RATE)
            avg_value = _AVG_JOB_VALUES.get(service_type, _DEFAULT_JOB_VALUE)
            expected_wins = count * win_rate
            forecast_low = int(expected_wins * avg_value * 0.8)
            forecast_high = int(expected_wins * avg_value * 1.2)
            total_low += forecast_low
            total_high += forecast_high

            forecasts.append({
                "service_type": service_type,
                "hot_lead_count": count,
                "win_rate": win_rate,
                "avg_job_value": avg_value,
                "expected_wins": round(expected_wins, 1),
                "forecast_low_usd": forecast_low,
                "forecast_high_usd": forecast_high,
            })

        return {
            "forecasts_by_service": forecasts,
            "total_forecast_low_usd": total_low,
            "total_forecast_high_usd": total_high,
            "assumptions": "Win rates and job values based on industry averages",
        }
    except Exception as exc:  # noqa: BLE001
        logger.error("get_revenue_forecast error: %s", exc)
        return {"error": "An internal error occurred. Please try again."}


def get_permit_to_lead_rate(db) -> dict:
    """Compare permit lead count vs. quote submissions."""
    try:
        from ..models import Lead  # noqa: PLC0415

        total_leads = db.query(Lead).count()
        # Permit leads are identified by having an address but no phone
        # (scraped leads vs. submitted leads)
        quote_leads = db.query(Lead).filter(Lead.phone.isnot(None)).count()

        permit_leads = max(0, total_leads - quote_leads)
        rate = round(quote_leads / permit_leads * 100, 1) if permit_leads > 0 else 0.0

        return {
            "total_leads": total_leads,
            "quote_submissions": quote_leads,
            "permit_leads_estimate": permit_leads,
            "quote_conversion_rate_pct": rate,
        }
    except Exception as exc:  # noqa: BLE001
        logger.error("get_permit_to_lead_rate error: %s", exc)
        return {"error": "An internal error occurred. Please try again."}


def get_review_approval_rate(db) -> dict:
    """Return approval/rejection rate by decision_type."""
    try:
        from ..models import HumanReviewQueue  # noqa: PLC0415
        from sqlalchemy import func  # noqa: PLC0415

        rows = (
            db.query(
                HumanReviewQueue.decision_type,
                HumanReviewQueue.status,
                func.count(HumanReviewQueue.id),
            )
            .group_by(HumanReviewQueue.decision_type, HumanReviewQueue.status)
            .all()
        )

        summary: dict = {}
        for decision_type, status, count in rows:
            if decision_type not in summary:
                summary[decision_type] = {"pending": 0, "approved": 0, "rejected": 0}
            summary[decision_type][status] = count

        results = []
        for dt, counts in summary.items():
            total = sum(counts.values())
            reviewed = counts["approved"] + counts["rejected"]
            approval_rate = round(counts["approved"] / reviewed * 100, 1) if reviewed > 0 else 0.0
            results.append({
                "decision_type": dt,
                "total": total,
                "pending": counts["pending"],
                "approved": counts["approved"],
                "rejected": counts["rejected"],
                "approval_rate_pct": approval_rate,
            })

        return {"by_decision_type": results}
    except Exception as exc:  # noqa: BLE001
        logger.error("get_review_approval_rate error: %s", exc)
        return {"error": "An internal error occurred. Please try again."}


def get_monthly_lead_volume(db) -> list:
    """Return monthly lead counts for the last 12 months.

    Uses a single aggregated SQL query instead of 24 individual COUNT queries.
    """
    try:
        from ..models import Lead  # noqa: PLC0415

        now = datetime.now(timezone.utc)
        # Build the 12 month-bucket boundaries (oldest first)
        buckets: list[tuple[datetime, datetime, str, str]] = []
        for i in range(11, -1, -1):
            month_start = (now - timedelta(days=i * 30)).replace(
                day=1, hour=0, minute=0, second=0, microsecond=0
            )
            if i > 0:
                month_end = (now - timedelta(days=(i - 1) * 30)).replace(
                    day=1, hour=0, minute=0, second=0, microsecond=0
                )
            else:
                month_end = now
            buckets.append((
                month_start,
                month_end,
                month_start.strftime("%Y-%m"),
                month_start.strftime("%b %Y"),
            ))

        window_start = buckets[0][0]

        # Single query: count all leads and HOT leads per month bucket in one pass.
        rows = (
            db.query(
                Lead.created_at,
                Lead.score_label,
            )
            .filter(Lead.created_at >= window_start, Lead.created_at < now)
            .all()
        )

        # Aggregate in Python — one pass over the result set.
        totals: dict[str, int] = {}
        hots: dict[str, int] = {}
        for created_at, score_label in rows:
            # Find which bucket this row belongs to
            for start, end, month_key, _ in buckets:
                if start <= created_at < end:
                    totals[month_key] = totals.get(month_key, 0) + 1
                    if score_label == "HOT":
                        hots[month_key] = hots.get(month_key, 0) + 1
                    break

        results = []
        for start, _end, month_key, label in buckets:
            results.append({
                "month": month_key,
                "label": label,
                "total_leads": totals.get(month_key, 0),
                "hot_leads": hots.get(month_key, 0),
            })
        return results
    except Exception as exc:  # noqa: BLE001
        logger.error("get_monthly_lead_volume error: %s", exc)
        return []


def get_full_dashboard(db) -> dict:
    """Aggregate all BI metrics into a single dashboard payload."""
    return {
        "lead_funnel": get_lead_funnel(db),
        "revenue_forecast": get_revenue_forecast(db),
        "permit_to_lead_rate": get_permit_to_lead_rate(db),
        "review_approval_rate": get_review_approval_rate(db),
        "monthly_lead_volume": get_monthly_lead_volume(db),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
