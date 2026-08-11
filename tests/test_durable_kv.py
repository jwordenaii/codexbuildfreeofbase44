"""
Tests for the Postgres-backed durable KV store and the two consumers that
depend on it: the Jarvis kill switch and the runtime API-key config.

WHY THESE MATTER: `jworden-api` has no Fly volume mounted, so file-backed
state lands on ephemeral /tmp and is destroyed by every redeploy. It also runs
two machines, which a volume could not keep in sync. The regression these
tests guard is therefore not hypothetical — it is the observed production
behaviour before this change:

  * a deliberate `freeze()` silently reverted to unfrozen on redeploy,
    re-enabling autonomous action nobody re-authorised;
  * API keys pasted into the Command Center vanished on redeploy.

The "REDEPLOY SIM" tests delete the local file and assert the state is still
there — i.e. that Postgres, not the disk, is the source of truth.
"""

import json
import os

import pytest

os.environ.setdefault("JWT_SECRET_KEY", "test-only-not-a-real-secret")


@pytest.fixture()
def kv(tmp_path, monkeypatch):
    """
    durable_kv disables itself on SQLite (a dev machine's own disk is already
    durable, and it avoids an import cycle). These tests need the real DB code
    path exercised, so the SQLite short-circuit — and only that — is bypassed.
    """
    from app import models  # noqa: F401 — registers DurableKV with Base.metadata
    from app.database import create_all_tables
    from app.services import durable_kv

    create_all_tables()
    monkeypatch.setattr(durable_kv, "_DISABLED", False)
    monkeypatch.setattr(durable_kv, "_enabled", lambda: True)
    return durable_kv


def test_crud_roundtrip(kv):
    key = "test_crud_roundtrip"
    kv.delete(key)
    assert kv.get(key) is None
    assert kv.set(key, "v1") is True
    assert kv.get(key) == "v1"
    assert kv.set(key, "v2") is True, "second set must upsert, not fail on the PK"
    assert kv.get(key) == "v2"
    assert kv.delete(key) is True
    assert kv.get(key) is None


def test_disabled_store_degrades_silently(monkeypatch):
    """A missing/unreachable database must never raise into the caller."""
    from app.services import durable_kv

    monkeypatch.setattr(durable_kv, "_enabled", lambda: False)
    assert durable_kv.get("anything") is None
    assert durable_kv.set("anything", "x") is False
    assert durable_kv.delete("anything") is False
    assert durable_kv.available() is False


def test_kill_switch_survives_redeploy(kv, monkeypatch):
    """REDEPLOY SIM: wipe the local file, freeze must still be in effect."""
    from app.services import autonomy_state

    kv.delete("jarvis_autonomy")
    autonomy_state.freeze("test freeze")
    assert autonomy_state.is_frozen() is True

    stored = json.loads(kv.get("jarvis_autonomy"))
    assert stored["frozen"] is True
    assert stored["reason"] == "test freeze"

    try:
        os.remove(autonomy_state._STATE_PATH)
    except OSError:
        pass

    assert autonomy_state.is_frozen() is True, (
        "kill switch reverted after the file vanished — this is the exact "
        "production bug: a redeploy would re-enable autonomy"
    )

    autonomy_state.unfreeze()
    assert autonomy_state.is_frozen() is False


def test_freeze_forces_master_off(kv):
    from app.services import autonomy_state

    autonomy_state.unfreeze()
    autonomy_state.set_master(True)
    state = autonomy_state.freeze("safety")
    assert state["master"] is False
    assert state["domains"] == {}
    autonomy_state.unfreeze()


def test_runtime_config_survives_redeploy(kv):
    """REDEPLOY SIM: a key pasted into the Command Center must outlive deploys."""
    from app.services import runtime_config

    kv.delete("runtime_config")
    runtime_config._CACHE = None
    runtime_config.set_value("COMPANY_PHONE", "555-0199")
    assert json.loads(kv.get("runtime_config"))["COMPANY_PHONE"] == "555-0199"

    try:
        os.remove(runtime_config._STATE_PATH)
    except OSError:
        pass
    runtime_config._CACHE = None

    assert runtime_config.get("COMPANY_PHONE") == "555-0199"
    runtime_config.set_value("COMPANY_PHONE", "")
    runtime_config._CACHE = None


def test_non_whitelisted_keys_are_still_refused(kv):
    """The KV backend must not become a way around MANAGED_KEYS."""
    from app.services import runtime_config

    assert runtime_config.set_value("DATABASE_URL", "postgres://attacker/") is False
    assert runtime_config.get("DATABASE_URL") == os.environ.get("DATABASE_URL", "")
