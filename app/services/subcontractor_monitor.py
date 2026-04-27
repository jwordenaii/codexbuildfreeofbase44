"""
subcontractor_monitor.py — Insurance and bond compliance monitor for JWordenAI.

Tracks subcontractor certifications and sends alerts for expiring documents.

Public API
──────────
  get_expiring_certs(db, days_ahead=30) → list[dict]
  send_expiry_alerts(db) → int
  get_compliance_summary(db) → dict
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger(__name__)


def get_expiring_certs(db, days_ahead: int = 30) -> list[dict]:
    """
    Return subcontractors with any certificate expiring within days_ahead.
    Includes license, insurance, and bond expiry dates.
    """
    try:
        from ..models import SubcontractorRoster  # noqa: PLC0415

        now = datetime.now(timezone.utc)
        cutoff = now + timedelta(days=days_ahead)

        subs = (
            db.query(SubcontractorRoster)
            .filter(SubcontractorRoster.is_active == 1)
            .all()
        )

        expiring = []
        for sub in subs:
            expiring_items = []

            if sub.license_expiry and sub.license_expiry <= cutoff:
                days_left = (sub.license_expiry - now).days
                expiring_items.append({
                    "cert_type": "license",
                    "expiry_date": sub.license_expiry.isoformat(),
                    "days_until_expiry": days_left,
                    "is_expired": days_left < 0,
                })

            if sub.insurance_expiry and sub.insurance_expiry <= cutoff:
                days_left = (sub.insurance_expiry - now).days
                expiring_items.append({
                    "cert_type": "insurance",
                    "expiry_date": sub.insurance_expiry.isoformat(),
                    "days_until_expiry": days_left,
                    "is_expired": days_left < 0,
                })

            if sub.bond_expiry and sub.bond_expiry <= cutoff:
                days_left = (sub.bond_expiry - now).days
                expiring_items.append({
                    "cert_type": "bond",
                    "expiry_date": sub.bond_expiry.isoformat(),
                    "days_until_expiry": days_left,
                    "is_expired": days_left < 0,
                })

            if expiring_items:
                expiring.append({
                    "id": sub.id,
                    "name": sub.name,
                    "company": sub.company,
                    "email": sub.email,
                    "phone": sub.phone,
                    "state_code": sub.state_code,
                    "expiring_certs": expiring_items,
                    "most_urgent_days": min(i["days_until_expiry"] for i in expiring_items),
                })

        expiring.sort(key=lambda x: x["most_urgent_days"])
        return expiring
    except Exception as exc:  # noqa: BLE001
        logger.error("get_expiring_certs error: %s", exc)
        return []


def send_expiry_alerts(db) -> int:
    """Send notification for any certs expiring within 7 days. Returns count sent."""
    try:
        from ..services.notifications import send_lead_notification  # noqa: PLC0415

        expiring = get_expiring_certs(db, days_ahead=7)
        sent = 0

        for sub in expiring:
            for cert in sub["expiring_certs"]:
                if cert["days_until_expiry"] <= 7:
                    urgency = "EXPIRED" if cert["is_expired"] else f"{cert['days_until_expiry']}d remaining"
                    send_lead_notification({
                        "type": "CERT_EXPIRY_ALERT",
                        "name": sub["name"],
                        "company": sub["company"],
                        "cert_type": cert["cert_type"].upper(),
                        "expiry_date": cert["expiry_date"],
                        "urgency_note": urgency,
                        "score": {"label": "ALERT", "priority": 1},
                        "note": f"⚠️ {sub['name']} ({sub['company']}) {cert['cert_type']} expires: {urgency}",
                    })
                    sent += 1

        return sent
    except Exception as exc:  # noqa: BLE001
        logger.error("send_expiry_alerts error: %s", exc)
        return 0


def get_compliance_summary(db) -> dict:
    """Return overall compliance status overview."""
    try:
        from ..models import SubcontractorRoster  # noqa: PLC0415

        now = datetime.now(timezone.utc)
        total = db.query(SubcontractorRoster).filter(SubcontractorRoster.is_active == 1).count()
        inactive = db.query(SubcontractorRoster).filter(SubcontractorRoster.is_active == 0).count()

        expiring_30 = len(get_expiring_certs(db, days_ahead=30))
        expiring_7 = len(get_expiring_certs(db, days_ahead=7))

        # Count expired (past due)
        expired = 0
        subs = db.query(SubcontractorRoster).filter(SubcontractorRoster.is_active == 1).all()
        for sub in subs:
            if (
                (sub.license_expiry and sub.license_expiry < now) or
                (sub.insurance_expiry and sub.insurance_expiry < now) or
                (sub.bond_expiry and sub.bond_expiry < now)
            ):
                expired += 1

        compliant = total - expiring_30

        return {
            "total_active": total,
            "total_inactive": inactive,
            "fully_compliant": max(0, compliant),
            "expiring_within_30_days": expiring_30,
            "expiring_within_7_days": expiring_7,
            "expired": expired,
            "compliance_rate_pct": round(compliant / total * 100, 1) if total > 0 else 100.0,
        }
    except Exception as exc:  # noqa: BLE001
        logger.error("get_compliance_summary error: %s", exc)
        return {"error": "An internal error occurred. Please try again."}
