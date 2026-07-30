"""
appointment_service.py — scheduling Jarvis can actually perform.

"Book me an estimate at the Chester property Thursday at 9" needs to become a
real row someone can look at later, not a sentence in a chat log. These helpers
create and read appointments, and optionally email a confirmation.

Time handling is deliberately explicit: callers pass an ISO timestamp, and a
naive timestamp is interpreted in the company's operating timezone (America/
New_York) rather than UTC. Silently treating "9am" as UTC would book every
site visit five hours early.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

logger = logging.getLogger(__name__)

# The company operates in Virginia. A naive local time means Eastern.
try:  # Python 3.9+
    from zoneinfo import ZoneInfo

    _LOCAL = ZoneInfo("America/New_York")
except Exception:  # pragma: no cover - fallback if tzdata is unavailable
    _LOCAL = timezone(timedelta(hours=-5))

_VALID_TYPES = {"estimate", "site_visit", "crew_start", "meeting", "other"}


def _parse_when(raw: str) -> datetime:
    """Parse an ISO timestamp, treating a naive value as company-local time."""
    s = (raw or "").strip().replace("Z", "+00:00")
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=_LOCAL)
    return dt.astimezone(timezone.utc)


def _as_dict(a: Any) -> dict[str, Any]:
    local = a.starts_at.astimezone(_LOCAL) if a.starts_at else None
    return {
        "id": a.id,
        "title": a.title,
        "starts_at_utc": a.starts_at.isoformat() if a.starts_at else None,
        "starts_at_local": local.strftime("%a %b %d, %Y at %-I:%M %p") if local else None,
        "duration_minutes": a.duration_minutes,
        "location": a.location,
        "customer_name": a.customer_name,
        "customer_phone": a.customer_phone,
        "customer_email": a.customer_email,
        "type": a.appointment_type,
        "status": a.status,
        "notes": a.notes,
    }


def create_appointment(
    title: str,
    starts_at: str,
    duration_minutes: int = 60,
    location: str | None = None,
    customer_name: str | None = None,
    customer_phone: str | None = None,
    customer_email: str | None = None,
    appointment_type: str = "estimate",
    notes: str | None = None,
    notify: bool = False,
) -> dict[str, Any]:
    """Book an appointment. Set ``notify`` to email the operator a confirmation."""
    if not (title or "").strip():
        return {"status": "error", "detail": "An appointment needs a title."}
    try:
        when = _parse_when(starts_at)
    except Exception:
        return {
            "status": "error",
            "detail": f"Could not read '{starts_at}' as a date/time. Use ISO form, e.g. 2026-08-04T09:00.",
        }

    kind = appointment_type if appointment_type in _VALID_TYPES else "other"

    try:
        from ..database import SessionLocal  # noqa: PLC0415
        from ..models import Appointment  # noqa: PLC0415

        db = SessionLocal()
        try:
            appt = Appointment(
                title=title.strip(),
                starts_at=when,
                duration_minutes=max(15, int(duration_minutes or 60)),
                location=(location or None),
                customer_name=(customer_name or None),
                customer_phone=(customer_phone or None),
                customer_email=(customer_email or None),
                appointment_type=kind,
                notes=(notes or None),
                created_by="jarvis",
            )
            db.add(appt)
            db.commit()
            db.refresh(appt)
            payload = _as_dict(appt)
        finally:
            db.close()
    except Exception as exc:  # noqa: BLE001
        logger.warning("create_appointment failed: %s", exc)
        return {"status": "error", "detail": f"Could not save the appointment: {type(exc).__name__}"}

    emailed = False
    if notify:
        emailed = _email_confirmation(payload)

    return {
        "status": "ok",
        "appointment": payload,
        "notified": emailed,
        "detail": f"Booked: {payload['title']} — {payload['starts_at_local']}.",
    }


def list_appointments(days_ahead: int = 14, include_past: bool = False) -> dict[str, Any]:
    """Upcoming appointments, soonest first."""
    try:
        from ..database import SessionLocal  # noqa: PLC0415
        from ..models import Appointment  # noqa: PLC0415

        now = datetime.now(timezone.utc)
        horizon = now + timedelta(days=max(1, int(days_ahead or 14)))
        db = SessionLocal()
        try:
            q = db.query(Appointment).filter(Appointment.status != "cancelled")
            if not include_past:
                q = q.filter(Appointment.starts_at >= now)
            q = q.filter(Appointment.starts_at <= horizon)
            rows = q.order_by(Appointment.starts_at.asc()).limit(50).all()
            items = [_as_dict(r) for r in rows]
        finally:
            db.close()
    except Exception as exc:  # noqa: BLE001
        logger.warning("list_appointments failed: %s", exc)
        return {"status": "error", "detail": f"Could not read appointments: {type(exc).__name__}", "appointments": []}

    return {
        "status": "ok",
        "window_days": days_ahead,
        "count": len(items),
        "appointments": items,
    }


def _email_confirmation(appt: dict[str, Any]) -> bool:
    """Best-effort confirmation email. Never raises — a failed email must not
    invalidate a booking that is already saved."""
    try:
        from .notifications import send_transactional_email  # noqa: PLC0415

        lines = [
            f"<h2>{appt['title']}</h2>",
            f"<p><strong>When:</strong> {appt['starts_at_local']} ({appt['duration_minutes']} min)</p>",
        ]
        if appt.get("location"):
            lines.append(f"<p><strong>Where:</strong> {appt['location']}</p>")
        if appt.get("customer_name"):
            lines.append(f"<p><strong>Customer:</strong> {appt['customer_name']}</p>")
        if appt.get("customer_phone"):
            lines.append(f"<p><strong>Phone:</strong> {appt['customer_phone']}</p>")
        if appt.get("notes"):
            lines.append(f"<p><strong>Notes:</strong> {appt['notes']}</p>")
        lines.append("<p style='color:#888'>Booked by JARVIS.</p>")

        return bool(
            send_transactional_email(
                subject=f"Appointment: {appt['title']} — {appt['starts_at_local']}",
                html_body="".join(lines),
            )
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("appointment confirmation email failed: %s", exc)
        return False
