"""
email_tasks.py — Celery tasks for scheduled follow-up email delivery.

Tasks
─────
  send_follow_up_email(lead_id, task_type)
      Fetch the lead from the database, send the appropriate follow-up email
      via SendGrid, and mark the FollowUpTask record as 'sent'.

Usage
─────
  # Dispatch immediately (fire-and-forget):
  send_follow_up_email.delay(lead_id=42, task_type="hot_1h")

  # Dispatch with a countdown (seconds):
  send_follow_up_email.apply_async(
      kwargs={"lead_id": 42, "task_type": "hot_1h"},
      countdown=3600,
  )

The task is registered in app/celery_app.py under the 'include' list.
Workers must be running for scheduled follow-ups to execute:
  celery -A app.celery_app worker --loglevel=info
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def _execute_follow_up(lead_id: int, task_type: str) -> dict:
    """
    Core logic: load lead + follow-up task from DB, send email, update status.

    Separated from the Celery task wrapper so it can be called directly in
    environments where Celery is not available (e.g. tests, local dev).

    Returns:
        dict with keys: lead_id, task_type, status, email_sent
    """
    from ..database import SessionLocal  # noqa: PLC0415
    from ..models import Lead, FollowUpTask  # noqa: PLC0415
    from ..services.email_service import send_follow_up  # noqa: PLC0415

    db = SessionLocal()
    result = {"lead_id": lead_id, "task_type": task_type, "status": "error", "email_sent": False}

    try:
        # Load the lead
        lead = db.get(Lead, lead_id)
        if lead is None:
            logger.error("send_follow_up_email: lead_id=%d not found — aborting", lead_id)
            result["status"] = "lead_not_found"
            return result

        # Find the matching pending FollowUpTask
        follow_up_task = (
            db.query(FollowUpTask)
            .filter(
                FollowUpTask.lead_id == lead_id,
                FollowUpTask.task_type == task_type,
                FollowUpTask.status == "pending",
            )
            .first()
        )

        if follow_up_task is None:
            logger.warning(
                "send_follow_up_email: no pending FollowUpTask for lead_id=%d task_type=%r "
                "(may have been cancelled or already sent)",
                lead_id,
                task_type,
            )
            result["status"] = "task_not_found"
            return result

        # Send the email
        email_sent = send_follow_up(lead, task_type)
        result["email_sent"] = email_sent

        # Update the FollowUpTask record
        now = datetime.now(timezone.utc)
        follow_up_task.sent_at = now
        follow_up_task.status = "sent" if email_sent else "error"
        db.commit()

        if email_sent:
            logger.info(
                "Follow-up email sent: lead_id=%d task_type=%r email=%s",
                lead_id,
                task_type,
                lead.email,
            )
            result["status"] = "sent"
        else:
            logger.error(
                "Follow-up email FAILED (SendGrid error): lead_id=%d task_type=%r email=%s",
                lead_id,
                task_type,
                lead.email,
            )
            result["status"] = "send_failed"

        return result

    except Exception as exc:  # noqa: BLE001
        logger.error(
            "send_follow_up_email unexpected error: lead_id=%d task_type=%r error=%s",
            lead_id,
            task_type,
            exc,
            exc_info=True,
        )
        try:
            db.rollback()
        except Exception:  # noqa: BLE001
            pass
        result["status"] = "exception"
        raise
    finally:
        db.close()


# ── Celery task registration ───────────────────────────────────────────────────

try:
    from ..celery_app import celery_app  # noqa: PLC0415

    @celery_app.task(
        name="app.tasks.email_tasks.send_follow_up_email",
        bind=True,
        max_retries=3,
        default_retry_delay=60,  # 1 minute between retries
        acks_late=True,
    )
    def send_follow_up_email(self, lead_id: int, task_type: str) -> dict:
        """
        Celery task: send a scheduled follow-up email for a lead.

        Args:
            lead_id:   Primary key of the Lead record.
            task_type: One of 'hot_1h', 'warm_3d', 'cool_7d'.

        Returns:
            Result dict with status and email_sent flag.
        """
        try:
            return _execute_follow_up(lead_id, task_type)
        except Exception as exc:  # noqa: BLE001
            logger.error(
                "send_follow_up_email task failed (attempt %d/%d): lead_id=%d error=%s",
                self.request.retries + 1,
                self.max_retries + 1,
                lead_id,
                exc,
            )
            try:
                import sentry_sdk  # noqa: PLC0415
                sentry_sdk.capture_exception(exc)
            except Exception:  # noqa: BLE001
                pass
            raise self.retry(exc=exc) from exc

except ImportError:
    # Celery not installed — provide a synchronous fallback for local dev / tests
    logger.warning(
        "Celery not available — send_follow_up_email will run synchronously (no scheduling)."
    )

    def send_follow_up_email(lead_id: int, task_type: str) -> dict:  # type: ignore[misc]
        """Synchronous fallback when Celery is not installed."""
        return _execute_follow_up(lead_id, task_type)
