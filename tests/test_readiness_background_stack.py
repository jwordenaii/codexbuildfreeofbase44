"""
Guards for /health/ready reporting the background stack honestly.

WHY THIS EXISTS

Measured in production on 2026-08-09: zero Celery workers, 5,937 messages in
the ready queue, and this endpoint answering 200 "ready". The worker had been
gone roughly two weeks. Nothing alarmed, because there was nothing an alarm
could key on — the old code computed worker health, logged a warning nobody
reads, and then dropped it before deciding the response. Queue depth was
returned in the payload but never consulted at all.

check_celery_workers() reports ok=True with an empty worker list, so "dead
worker" and "healthy worker" were byte-identical to anything watching.

Two properties are load-bearing here and they pull in opposite directions:

  1. A dead worker MUST be visible in the payload.
  2. A dead worker MUST NOT change the status code. Nothing routes on this
     path today, but the moment a Fly health check points at it, a 503 would
     start evicting healthy web machines — an outage manufactured by the
     monitoring rather than by the fault.

Tests that only assert on the status code would pass on the broken version,
which is exactly how this survived. Assert on the payload.
"""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app

HEALTHY_REDIS = {"ok": True, "latency_ms": 12.0}


def _ready(celery: dict, queue: dict, redis: dict = None):
    """Call /health/ready with the background stack forced into a given shape."""
    with patch("app.routers.health._background_stack_configured", return_value=True), patch(
        "app.routers.health.check_redis_connection", return_value=redis or HEALTHY_REDIS
    ), patch("app.routers.health.check_celery_workers", return_value=celery), patch(
        "app.routers.health.check_queue_depth", return_value=queue
    ):
        resp = TestClient(app).get("/health/ready")
        return resp.status_code, resp.json()


def test_dead_worker_with_backlog_is_reported_not_hidden():
    """The exact production state on 2026-08-09."""
    code, body = _ready(
        celery={"ok": True, "active_workers": 0, "worker_names": []},
        queue={"ok": True, "queue_depth": 5937},
    )

    # Serving is genuinely fine — Redis and Postgres are up.
    assert code == 200, "must not 503; a dead worker cannot be allowed to evict web machines"
    assert body["serving_ok"] is True

    # But the background stack must not claim to be fine.
    assert body["background_ok"] is False
    assert body["status"] != "ready"
    reasons = " ".join(body["degraded_reasons"])
    assert "0 active workers" in reasons
    assert "5937" in reasons


def test_healthy_worker_reports_plain_ready():
    code, body = _ready(
        celery={"ok": True, "active_workers": 2, "worker_names": ["w1", "w2"]},
        queue={"ok": True, "queue_depth": 3},
    )
    assert code == 200
    assert body["status"] == "ready"
    assert body["background_ok"] is True
    assert body["degraded_reasons"] == []


def test_large_backlog_flagged_even_with_workers_running():
    """
    Workers present but not keeping up. Worth surfacing on its own: everything
    in the ready queue dispatches at once, and lead follow-up emails are queued
    there with apply_async(countdown=...), so a backlog is a hazard to drain.
    """
    _, body = _ready(
        celery={"ok": True, "active_workers": 2, "worker_names": ["w1", "w2"]},
        queue={"ok": True, "queue_depth": 5000},
    )
    assert body["background_ok"] is False
    assert any("queue" in r for r in body["degraded_reasons"])


def test_broker_unreachable_is_distinguished_from_no_workers():
    _, body = _ready(
        celery={"ok": False, "error": "connection refused"},
        queue={"ok": False, "error": "connection refused"},
    )
    assert body["background_ok"] is False
    assert any("broker unreachable" in r for r in body["degraded_reasons"])


@pytest.mark.parametrize("depth", [0, 1, 499])
def test_small_backlogs_do_not_cry_wolf(depth):
    _, body = _ready(
        celery={"ok": True, "active_workers": 1, "worker_names": ["w1"]},
        queue={"ok": True, "queue_depth": depth},
    )
    assert body["background_ok"] is True, f"depth {depth} should not be flagged"


def test_serving_failure_still_503s():
    """Redis down is a real serving fault and must keep its 503."""
    code, body = _ready(
        celery={"ok": True, "active_workers": 2, "worker_names": ["w1", "w2"]},
        queue={"ok": True, "queue_depth": 0},
        redis={"ok": False, "error": "connection refused"},
    )
    assert code == 503
    assert body["serving_ok"] is False
    assert body["status"] == "degraded"
