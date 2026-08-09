"""
Guards the staleness cut-off on scheduled follow-up emails.

WHY THIS EXISTS

Follow-ups are queued with apply_async(countdown=3600 / 3d / 7d). With the
Redis transport that message sits in the READY queue with its ETA attached, so
when no worker is consuming they accumulate with their ETAs already elapsed —
and the instant a worker connects it pulls the whole backlog and fires every
overdue one at once.

That is not hypothetical. The worker crashed on 2026-07-30 (exit_code=1) and
beat kept publishing for nine days, leaving 5,937 messages queued. Draining
that without a guard would have emailed every lead from that window, some of
them more than once, all in the same minute.

The cut-off has to hold from both sides, so both are tested here: a slightly
late follow-up (worker restart, deploy, broker blip) must still send, and a
days-late one must not.
"""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.tasks import email_tasks


def _run(scheduled_offset: timedelta, sender: MagicMock, tzaware: bool = True):
    """
    Drive _execute_follow_up with a FollowUpTask due `scheduled_offset` ago.
    Negative offset means the send is still in the future.
    """
    scheduled_at = datetime.now(timezone.utc) - scheduled_offset
    if not tzaware:
        scheduled_at = scheduled_at.replace(tzinfo=None)

    lead = SimpleNamespace(id=42, email="customer@example.com")
    task_row = SimpleNamespace(
        lead_id=42, task_type="hot_1h", scheduled_at=scheduled_at, status="pending", sent_at=None
    )

    db = MagicMock()
    db.get.return_value = lead
    db.query.return_value.filter.return_value.first.return_value = task_row

    # The real Lead / FollowUpTask classes stay in place: the db session is a
    # mock, so the filter expressions are never executed, and swapping the
    # models out breaks `FollowUpTask.lead_id == ...` at expression-build time.
    with patch("app.database.SessionLocal", return_value=db), patch(
        "app.services.email_service.send_follow_up", sender
    ):
        result = email_tasks._execute_follow_up(42, "hot_1h")
    return result, task_row


def test_nine_day_old_follow_up_is_not_emailed():
    """The exact production backlog scenario."""
    sender = MagicMock(return_value=True)
    result, task_row = _run(timedelta(days=9), sender)

    sender.assert_not_called(), "a nine-day-late follow-up must never reach a customer"
    assert result["status"] == "skipped_stale"
    assert result["email_sent"] is False
    assert task_row.status == "skipped_stale"
    assert result["overdue_days"] == pytest.approx(9, abs=0.1)


def test_slightly_late_follow_up_still_sends():
    """A worker restart or deploy must not silently drop a real follow-up."""
    sender = MagicMock(return_value=True)
    result, task_row = _run(timedelta(hours=6), sender)

    sender.assert_called_once()
    assert result["status"] == "sent"
    assert result["email_sent"] is True
    assert task_row.status == "sent"


def test_on_time_follow_up_sends():
    sender = MagicMock(return_value=True)
    result, _ = _run(timedelta(seconds=30), sender)
    sender.assert_called_once()
    assert result["status"] == "sent"


@pytest.mark.parametrize("hours,should_send", [(47, True), (49, False)])
def test_cutoff_sits_at_the_documented_boundary(hours, should_send):
    sender = MagicMock(return_value=True)
    result, _ = _run(timedelta(hours=hours), sender)
    assert (result["status"] == "sent") is should_send


def test_naive_timestamps_do_not_crash_the_comparison():
    """
    Postgres hands back tz-aware datetimes and SQLite naive ones. Comparing the
    two raises TypeError, which inside the task would surface as a retry storm
    rather than a skip — so the naive path is normalised, and tested.
    """
    sender = MagicMock(return_value=True)
    result, _ = _run(timedelta(days=9), sender, tzaware=False)
    assert result["status"] == "skipped_stale"
    sender.assert_not_called()


def test_grace_env_override_rejects_garbage_rather_than_disabling_the_guard():
    """A broken env value must not turn the guard off — that would mass-email."""
    for bad in ("", "abc", "-5", "0"):
        with patch.dict("os.environ", {"FOLLOW_UP_STALE_GRACE_HOURS": bad}):
            assert email_tasks._stale_grace() == timedelta(hours=48), f"bad value {bad!r}"

    with patch.dict("os.environ", {"FOLLOW_UP_STALE_GRACE_HOURS": "6"}):
        assert email_tasks._stale_grace() == timedelta(hours=6)
