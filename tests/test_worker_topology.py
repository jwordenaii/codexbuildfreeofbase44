"""
Guards for the background-work topology (fly.toml process groups).

Seven periodic jobs and thirteen background tasks had never executed, because
every Fly machine ran the Dockerfile CMD (the web server) and no process
consumed the Celery queue. The most expensive one is silent:

    scrape-vdot-bids-daily — the VDOT bid board scraper for a Virginia paving
    contractor. It does not error when absent; the bids simply never arrive.

Two failure modes are worth pinning:

  1. No worker/beat process -> nothing runs, and health reports "skipped",
     which reads like "fine" rather than "absent".
  2. More than one beat -> every cron entry double-fires. For the VDOT
     scraper that means duplicate bid rows; for email tasks, duplicate sends
     to real customers. Worse than not running at all.
"""

import tomllib
from pathlib import Path

import pytest

FLY_TOML = Path(__file__).resolve().parent.parent / "fly.toml"


@pytest.fixture(scope="module")
def cfg():
    assert FLY_TOML.is_file(), "fly.toml is required for worker/beat process groups"
    return tomllib.loads(FLY_TOML.read_text())


def test_all_three_process_groups_are_defined(cfg):
    assert set(cfg["processes"]) == {"app", "worker", "beat"}


def test_worker_consumes_the_queue(cfg):
    cmd = cfg["processes"]["worker"]
    assert "celery" in cmd and "worker" in cmd
    assert "app.celery_app" in cmd, "worker must point at the real Celery app"


def test_beat_emits_the_schedule(cfg):
    cmd = cfg["processes"]["beat"]
    assert "celery" in cmd and "beat" in cmd
    assert "app.celery_app" in cmd


def test_exactly_one_beat_instance(cfg):
    """Two beat schedulers double-fire every cron entry — duplicate bids and
    duplicate customer emails. This is the guard against that."""
    beat_vms = [vm for vm in cfg["vm"] if "beat" in vm.get("processes", [])]
    assert len(beat_vms) == 1, "beat must be described by exactly one [[vm]] block"
    assert beat_vms[0].get("count") == 1, "beat must be pinned to count = 1"


def test_only_the_web_process_serves_http(cfg):
    """Routing HTTP to a worker would send live traffic to a machine with no
    server listening on the port."""
    assert cfg["http_service"]["processes"] == ["app"]


def test_web_process_still_expands_the_port(cfg):
    """Fly injects PORT; a command that does not expand it binds the wrong
    port and the machine fails its health check."""
    assert "${PORT" in cfg["processes"]["app"]


def test_every_scheduled_task_resolves_to_real_code(cfg):
    """A beat entry naming a task that no longer exists fails at runtime, on a
    schedule, where nobody is watching."""
    import importlib

    from app.celery_app import celery_app

    schedule = celery_app.conf.beat_schedule
    assert schedule, "beat schedule is empty — nothing would ever run"

    for name, entry in schedule.items():
        dotted = entry["task"]
        module_path, func = dotted.rsplit(".", 1)
        module = importlib.import_module(module_path)
        assert hasattr(module, func), f"beat job {name!r} -> missing {dotted}"


def test_the_revenue_bearing_scraper_is_scheduled():
    """Explicit guard: this is the job whose absence costs real money."""
    from app.celery_app import celery_app

    tasks = {e["task"] for e in celery_app.conf.beat_schedule.values()}
    assert any("vdot" in t.lower() for t in tasks), "VDOT bid scraper is not scheduled"
