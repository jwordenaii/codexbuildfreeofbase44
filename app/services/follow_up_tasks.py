"""
follow_up_tasks.py — Automated follow-up sequences via Celery beat.

Three follow-up tiers based on lead temperature:
  hot_1h   — HOT leads not contacted within 60 minutes
  warm_3d  — WARM leads with no activity for 3 days
  cool_7d  — COOL leads with no activity for 7 days

Celery beat schedule runs each check every 15 minutes.

Public API
──────────
  schedule_follow_up(lead_id, task_type, delay_seconds) → None
  cancel_follow_up(task_id, db) → bool
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

_BROKER_URL = os.getenv("CELERY_BROKER_URL") or os.getenv("REDIS_URL", "")

# ── Celery app ────────────────────────────────────────────────────────────────

try:
    from celery import Celery  # type: ignore
    from celery.schedules import crontab  # type: ignore

    if not _BROKER_URL:
        raise RuntimeError("CELERY_BROKER_URL / REDIS_URL not configured")

    celery_app = Celery("jworden_followups", broker=_BROKER_URL, backend=_BROKER_URL)
    celery_app.conf.update(
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        timezone="UTC",
        enable_utc=True,
        beat_schedule={
            "check-hot-leads": {
                "task": "app.services.follow_up_tasks.check_hot_leads",
                "schedule": crontab(minute="*/15"),
            },
            "check-warm-leads": {
                "task": "app.services.follow_up_tasks.check_warm_leads",
                "schedule": crontab(minute="*/15"),
            },
            "check-cool-leads": {
                "task": "app.services.follow_up_tasks.check_cool_leads",
                "schedule": crontab(minute="*/15"),
            },
        },
    )
    _CELERY_AVAILABLE = True
except (ImportError, RuntimeError) as _e:
    celery_app = None  # type: ignore
    _CELERY_AVAILABLE = False
    logger.warning("Follow-up tasks disabled: %s", _e)


# ── Celery tasks ──────────────────────────────────────────────────────────────

def _run_hot_check():
    """Find HOT leads not followed up within 60 minutes and send notifications."""
    try:
        from ..database import SessionLocal  # noqa: PLC0415
        from ..models import Lead, FollowUpTask  # noqa: PLC0415
        from ..services.notifications import send_lead_notification  # noqa: PLC0415

        db = SessionLocal()
        try:
            cutoff = datetime.now(timezone.utc) - timedelta(hours=1)
            hot_leads = (
                db.query(Lead)
                .filter(
                    Lead.score_label == "HOT",
                    Lead.pipeline_stage == "new",
                    Lead.created_at <= cutoff,
                )
                .all()
            )
            sent = 0
            for lead in hot_leads:
                existing = (
                    db.query(FollowUpTask)
                    .filter(
                        FollowUpTask.lead_id == lead.id,
                        FollowUpTask.task_type == "hot_1h",
                        FollowUpTask.status.in_(["sent", "pending"]),
                    )
                    .first()
                )
                if existing:
                    continue

                task = FollowUpTask(
                    lead_id=lead.id,
                    task_type="hot_1h",
                    scheduled_at=datetime.now(timezone.utc),
                    sent_at=datetime.now(timezone.utc),
                    status="sent",
                )
                db.add(task)
                db.commit()

                send_lead_notification({
                    "type": "HOT_FOLLOWUP",
                    "name": lead.name,
                    "email": lead.email,
                    "phone": lead.phone,
                    "service_type": lead.service_type,
                    "score": {"label": "HOT", "priority": lead.score_priority},
                    "note": "Automated 1-hour follow-up: lead not yet contacted",
                })
                sent += 1
            logger.info("Hot lead check: sent %d follow-ups", sent)
        finally:
            db.close()
    except Exception as exc:  # noqa: BLE001
        logger.error("check_hot_leads error: %s", exc)


def _run_warm_check():
    """Find WARM leads with no activity for 3 days."""
    try:
        from ..database import SessionLocal  # noqa: PLC0415
        from ..models import Lead, FollowUpTask  # noqa: PLC0415
        from ..services.notifications import send_lead_notification  # noqa: PLC0415

        db = SessionLocal()
        try:
            cutoff = datetime.now(timezone.utc) - timedelta(days=3)
            warm_leads = (
                db.query(Lead)
                .filter(
                    Lead.score_label == "WARM",
                    Lead.pipeline_stage == "new",
                    Lead.created_at <= cutoff,
                )
                .all()
            )
            sent = 0
            for lead in warm_leads:
                existing = (
                    db.query(FollowUpTask)
                    .filter(
                        FollowUpTask.lead_id == lead.id,
                        FollowUpTask.task_type == "warm_3d",
                        FollowUpTask.status.in_(["sent", "pending"]),
                    )
                    .first()
                )
                if existing:
                    continue

                task = FollowUpTask(
                    lead_id=lead.id,
                    task_type="warm_3d",
                    scheduled_at=datetime.now(timezone.utc),
                    sent_at=datetime.now(timezone.utc),
                    status="sent",
                )
                db.add(task)
                db.commit()

                send_lead_notification({
                    "type": "WARM_REENGAGEMENT",
                    "name": lead.name,
                    "email": lead.email,
                    "phone": lead.phone,
                    "service_type": lead.service_type,
                    "score": {"label": "WARM", "priority": lead.score_priority},
                    "note": "3-day re-engagement: lead still in 'new' stage",
                })
                sent += 1
            logger.info("Warm lead check: sent %d follow-ups", sent)
        finally:
            db.close()
    except Exception as exc:  # noqa: BLE001
        logger.error("check_warm_leads error: %s", exc)


def _run_cool_check():
    """Find COOL leads with no activity for 7 days."""
    try:
        from ..database import SessionLocal  # noqa: PLC0415
        from ..models import Lead, FollowUpTask  # noqa: PLC0415
        from ..services.notifications import send_lead_notification  # noqa: PLC0415

        db = SessionLocal()
        try:
            cutoff = datetime.now(timezone.utc) - timedelta(days=7)
            cool_leads = (
                db.query(Lead)
                .filter(
                    Lead.score_label == "COOL",
                    Lead.pipeline_stage == "new",
                    Lead.created_at <= cutoff,
                )
                .all()
            )
            sent = 0
            for lead in cool_leads:
                existing = (
                    db.query(FollowUpTask)
                    .filter(
                        FollowUpTask.lead_id == lead.id,
                        FollowUpTask.task_type == "cool_7d",
                        FollowUpTask.status.in_(["sent", "pending"]),
                    )
                    .first()
                )
                if existing:
                    continue

                task = FollowUpTask(
                    lead_id=lead.id,
                    task_type="cool_7d",
                    scheduled_at=datetime.now(timezone.utc),
                    sent_at=datetime.now(timezone.utc),
                    status="sent",
                )
                db.add(task)
                db.commit()

                send_lead_notification({
                    "type": "COOL_EARN_BUSINESS",
                    "name": lead.name,
                    "email": lead.email,
                    "phone": lead.phone,
                    "service_type": lead.service_type,
                    "score": {"label": "COOL", "priority": lead.score_priority},
                    "note": "7-day earn-your-business: lead still cold after a week",
                })
                sent += 1
            logger.info("Cool lead check: sent %d follow-ups", sent)
        finally:
            db.close()
    except Exception as exc:  # noqa: BLE001
        logger.error("check_cool_leads error: %s", exc)


if _CELERY_AVAILABLE and celery_app:
    @celery_app.task(name="app.services.follow_up_tasks.check_hot_leads")
    def check_hot_leads():
        _run_hot_check()

    @celery_app.task(name="app.services.follow_up_tasks.check_warm_leads")
    def check_warm_leads():
        _run_warm_check()

    @celery_app.task(name="app.services.follow_up_tasks.check_cool_leads")
    def check_cool_leads():
        _run_cool_check()


# ── Public scheduling API ─────────────────────────────────────────────────────

def schedule_follow_up(lead_id: int, task_type: str, delay_seconds: int, db=None) -> None:
    """Create a FollowUpTask record for the given lead."""
    if db is None:
        return
    try:
        from ..models import FollowUpTask  # noqa: PLC0415

        scheduled = datetime.now(timezone.utc) + timedelta(seconds=delay_seconds)
        task = FollowUpTask(
            lead_id=lead_id,
            task_type=task_type,
            scheduled_at=scheduled,
            status="pending",
        )
        db.add(task)
        db.commit()
        logger.info("Scheduled %s follow-up for lead_id=%d at %s", task_type, lead_id, scheduled)
    except Exception as exc:  # noqa: BLE001
        logger.error("schedule_follow_up error: %s", exc)


def cancel_follow_up(task_id: int, db=None) -> bool:
    """Cancel a pending follow-up task. Returns True if cancelled."""
    if db is None:
        return False
    try:
        from ..models import FollowUpTask  # noqa: PLC0415

        task = db.get(FollowUpTask, task_id)
        if not task or task.status != "pending":
            return False
        task.status = "cancelled"
        db.commit()
        return True
    except Exception as exc:  # noqa: BLE001
        logger.error("cancel_follow_up error: %s", exc)
        return False
