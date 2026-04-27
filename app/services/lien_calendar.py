"""
lien_calendar.py — Mechanics lien deadline calculator for JWordenAI.

Provides state-specific lien law deadline calculations for 12+ states.
Tracks projects in the LienCalendarEntry table and sends reminders.

Public API
──────────
  calculate_deadlines(state_code, project_start_date, last_furnishing_date) → dict
  get_upcoming_deadlines(db, days_ahead=30) → list
  send_lien_reminders(db) → int
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# State lien law data
# preliminary_notice_days: days from project start to file prelim notice (None = not required)
# lien_filing_days: days from last furnishing to file lien
# foreclosure_days: days from filing to foreclose
_LIEN_LAWS: dict[str, dict] = {
    "VA": {
        "preliminary_notice_days": None,
        "lien_filing_days": 90,
        "foreclosure_days": 180,
        "notes": "File lien within 90 days of last furnishing. No prelim notice required.",
    },
    "TX": {
        "preliminary_notice_days": 15,
        "lien_filing_days": 15,  # 15th day of 3rd month after month of last furnishing
        "foreclosure_days": 180,
        "notes": "Monthly notices required. File lien by 15th of 3rd month after last furnishing.",
    },
    "FL": {
        "preliminary_notice_days": 45,
        "lien_filing_days": 90,
        "foreclosure_days": 365,
        "notes": "Notice to Owner required within 45 days of first furnishing.",
    },
    "NC": {
        "preliminary_notice_days": None,
        "lien_filing_days": 120,
        "foreclosure_days": 180,
        "notes": "File lien within 120 days of last furnishing.",
    },
    "GA": {
        "preliminary_notice_days": None,
        "lien_filing_days": 90,
        "foreclosure_days": 365,
        "notes": "File lien within 90 days of last furnishing.",
    },
    "NY": {
        "preliminary_notice_days": None,
        "lien_filing_days": 8 * 30,  # 8 months
        "foreclosure_days": 365,
        "notes": "File lien within 8 months of last furnishing (public improvement: 30 days).",
    },
    "NJ": {
        "preliminary_notice_days": None,
        "lien_filing_days": 90,
        "foreclosure_days": 365,
        "notes": "File lien within 90 days of last furnishing.",
    },
    "MI": {
        "preliminary_notice_days": 20,
        "lien_filing_days": 90,
        "foreclosure_days": 365,
        "notes": "Notice of commencement required. File lien within 90 days.",
    },
    "CA": {
        "preliminary_notice_days": 20,
        "lien_filing_days": 90,
        "foreclosure_days": 90,
        "notes": "Preliminary notice required within 20 days. File lien within 90 days.",
    },
    "MD": {
        "preliminary_notice_days": None,
        "lien_filing_days": 180,
        "foreclosure_days": 365,
        "notes": "File lien within 180 days of last furnishing.",
    },
    "OH": {
        "preliminary_notice_days": None,
        "lien_filing_days": 75,
        "foreclosure_days": 365,
        "notes": "File lien within 75 days of last furnishing.",
    },
    "PA": {
        "preliminary_notice_days": None,
        "lien_filing_days": 6 * 30,  # 6 months
        "foreclosure_days": 365,
        "notes": "File lien within 6 months of last furnishing.",
    },
    "IL": {
        "preliminary_notice_days": None,
        "lien_filing_days": 4 * 30,  # 4 months
        "foreclosure_days": 730,
        "notes": "File lien within 4 months of last furnishing.",
    },
}

_DEFAULT_LAW = {
    "preliminary_notice_days": None,
    "lien_filing_days": 90,
    "foreclosure_days": 180,
    "notes": "Default rules — verify with a licensed attorney in your state.",
}


def calculate_deadlines(
    state_code: str,
    project_start_date: datetime,
    last_furnishing_date: datetime,
) -> dict:
    """
    Calculate lien filing deadlines for a project.

    Returns:
      {
        state_code, preliminary_notice_deadline, lien_filing_deadline,
        foreclosure_deadline, state_notes, days_to_file_lien,
        days_to_foreclose, law_source
      }
    """
    law = _LIEN_LAWS.get(state_code.upper(), _DEFAULT_LAW)
    used_default = state_code.upper() not in _LIEN_LAWS

    prelim_deadline: Optional[datetime] = None
    if law["preliminary_notice_days"] is not None:
        prelim_deadline = project_start_date + timedelta(days=law["preliminary_notice_days"])

    lien_deadline = last_furnishing_date + timedelta(days=law["lien_filing_days"])
    foreclosure_deadline = lien_deadline + timedelta(days=law["foreclosure_days"])

    now = datetime.now(timezone.utc)
    days_to_lien = (lien_deadline - now).days
    days_to_foreclose = (foreclosure_deadline - now).days

    return {
        "state_code": state_code.upper(),
        "preliminary_notice_deadline": prelim_deadline.isoformat() if prelim_deadline else None,
        "lien_filing_deadline": lien_deadline.isoformat(),
        "foreclosure_deadline": foreclosure_deadline.isoformat(),
        "days_until_lien_deadline": days_to_lien,
        "days_until_foreclosure_deadline": days_to_foreclose,
        "state_notes": law["notes"],
        "used_default_rules": used_default,
        "disclaimer": "Verify all deadlines with a licensed attorney — laws change.",
    }


def get_upcoming_deadlines(db, days_ahead: int = 30) -> list[dict]:
    """Return LienCalendarEntry records with deadlines within days_ahead."""
    try:
        from ..models import LienCalendarEntry  # noqa: PLC0415

        now = datetime.now(timezone.utc)
        cutoff = now + timedelta(days=days_ahead)

        entries = (
            db.query(LienCalendarEntry)
            .filter(
                (LienCalendarEntry.lien_filing_deadline <= cutoff) |
                (LienCalendarEntry.preliminary_notice_deadline <= cutoff)
            )
            .order_by(LienCalendarEntry.lien_filing_deadline.asc())
            .all()
        )

        results = []
        for e in entries:
            lien_days = (
                (e.lien_filing_deadline - now).days
                if e.lien_filing_deadline
                else None
            )
            prelim_days = (
                (e.preliminary_notice_deadline - now).days
                if e.preliminary_notice_deadline
                else None
            )
            results.append({
                "id": e.id,
                "customer_name": e.customer_name,
                "project_address": e.project_address,
                "state_code": e.state_code,
                "lien_filing_deadline": e.lien_filing_deadline.isoformat() if e.lien_filing_deadline else None,
                "preliminary_notice_deadline": e.preliminary_notice_deadline.isoformat() if e.preliminary_notice_deadline else None,
                "foreclosure_deadline": e.foreclosure_deadline.isoformat() if e.foreclosure_deadline else None,
                "days_until_lien": lien_days,
                "days_until_prelim": prelim_days,
                "is_urgent": (lien_days is not None and lien_days <= 7) or (prelim_days is not None and prelim_days <= 7),
            })

        return results
    except Exception as exc:  # noqa: BLE001
        logger.error("get_upcoming_deadlines error: %s", exc)
        return []


def send_lien_reminders(db) -> int:
    """Send notifications for entries with deadlines within 7 days. Returns count sent."""
    try:
        from ..services.notifications import send_lead_notification  # noqa: PLC0415
        from ..models import LienCalendarEntry  # noqa: PLC0415

        upcoming = get_upcoming_deadlines(db, days_ahead=7)
        sent = 0

        for entry in upcoming:
            if not entry.get("is_urgent"):
                continue

            # Check if reminder already sent
            db_entry = db.get(LienCalendarEntry, entry["id"])
            if db_entry and db_entry.reminder_sent_at:
                continue

            send_lead_notification({
                "type": "LIEN_DEADLINE_REMINDER",
                "name": entry["customer_name"],
                "project_address": entry["project_address"],
                "state_code": entry["state_code"],
                "lien_filing_deadline": entry["lien_filing_deadline"],
                "days_until_lien": entry["days_until_lien"],
                "score": {"label": "URGENT", "priority": 1},
                "note": f"⚠️ Mechanics lien deadline in {entry['days_until_lien']} days!",
            })

            if db_entry:
                db_entry.reminder_sent_at = datetime.now(timezone.utc)
                db.commit()

            sent += 1

        return sent
    except Exception as exc:  # noqa: BLE001
        logger.error("send_lien_reminders error: %s", exc)
        return 0
