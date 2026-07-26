"""
Guards for the Jarvis/Command Center flagship configuration.

This is the surface customers see and judge before they buy, so the failure
modes here are commercial, not just technical:

  * Sending `temperature` to a current-generation Claude model returns a 400 —
    Jarvis would fail on every single turn, not degrade.
  * `max_tokens` bounds thinking AND the visible answer together on these
    models. The shipped defaults were 220-512, which reasoning consumed before
    the reply was written, so answers truncated mid-sentence and read as a
    broken or "downgraded" assistant.
  * The premium voice (ElevenLabs) has to actually outrank the fallback when a
    key is present, and must never render in plaintext in the admin UI.
"""

import pytest

from app.services import llm_client, runtime_config, tts_service

CURRENT_GEN = ["claude-opus-5", "claude-sonnet-5", "claude-fable-5", "claude-opus-4-8"]
OLDER_OR_OTHER = ["claude-haiku-4-5", "gpt-4o", "gpt-4o-mini", "gemini-2.5-pro", "grok-4"]

# Lanes a buyer exercises during a demo.
FLAGSHIP_LANES = ["jarvis", "jarvis_fast", "persona", "reasoning",
                  "legal", "proposal", "review_reply", "analytics"]


@pytest.mark.parametrize("model", CURRENT_GEN)
def test_current_generation_rejects_sampling_params(model):
    """If this returns False, every Jarvis call 400s."""
    assert llm_client._rejects_sampling_params(model) is True


@pytest.mark.parametrize("model", OLDER_OR_OTHER)
def test_other_models_still_accept_sampling_params(model):
    """Over-broad matching here would silently drop temperature everywhere."""
    assert llm_client._rejects_sampling_params(model) is False


@pytest.mark.parametrize("task", FLAGSHIP_LANES)
def test_flagship_lanes_run_on_the_flagship_model(task):
    provider, model = llm_client._resolved_chain(task)[0]
    assert (provider, model) == ("anthropic", "claude-opus-5"), (
        f"{task} fell off the flagship model onto {provider}/{model}"
    )


@pytest.mark.parametrize("task", FLAGSHIP_LANES)
def test_every_lane_has_a_non_anthropic_fallback(task):
    """An Anthropic outage must not take the product demo down with it."""
    providers = {p for p, _ in llm_client._resolved_chain(task)}
    assert providers - {"anthropic"}, f"{task} has no cross-provider fallback"


def test_spend_cap_downgrades_to_sonnet(monkeypatch):
    monkeypatch.setenv("JARVIS_MAX_TIER", "sonnet")
    monkeypatch.setattr(runtime_config, "_CACHE", None)
    assert llm_client._resolved_chain("jarvis")[0] == ("anthropic", "claude-sonnet-5")


def test_no_retired_or_stale_model_ids_remain():
    """A retired ID 404s; a stale one quietly ships last-generation quality."""
    stale = {"claude-sonnet-4-5", "claude-sonnet-4-6", "claude-opus-4-6",
             "claude-opus-4-7", "claude-3-opus-20240229", "claude-3-5-sonnet-20241022"}
    used = {model for chain in llm_client._ROUTES.values() for _, model in chain}
    assert not (used & stale), f"stale model IDs still routed: {used & stale}"


def test_effort_is_bounded_to_valid_levels(monkeypatch):
    monkeypatch.setattr(runtime_config, "_CACHE", None)
    monkeypatch.setenv("JARVIS_EFFORT", "not-a-level")
    assert llm_client._anthropic_effort() == "medium"
    monkeypatch.setenv("JARVIS_EFFORT", "xhigh")
    monkeypatch.setattr(runtime_config, "_CACHE", None)
    assert llm_client._anthropic_effort() == "xhigh"


# ── Answer length ────────────────────────────────────────────────────────────

def test_token_budgets_leave_room_for_thinking_plus_answer():
    """
    Regression guard for the "downgraded mode" report. These models think by
    default and `max_tokens` caps thinking + answer together, so the old
    220/260/512 ceilings were spent on reasoning and truncated the reply.
    """
    import re
    from pathlib import Path

    src = Path(llm_client.__file__).with_name("jarvis.py").read_text()
    budgets = [int(n) for n in re.findall(r'_cfg_int\("JARVIS_\w*MAX_TOKENS", (\d+)', src)]
    assert budgets, "could not locate Jarvis token budgets"
    assert min(budgets) >= 2000, f"token budget too low to fit an answer: {budgets}"
    assert llm_client._MIN_THINKING_HEADROOM >= 4000


def test_low_cost_mode_is_off_by_default(monkeypatch):
    """Low-cost mode shipped ON, which is what made answers feel clipped."""
    from app.services import jarvis

    monkeypatch.delenv("JARVIS_LOW_COST_MODE", raising=False)
    monkeypatch.setattr(runtime_config, "_CACHE", None)
    assert jarvis._low_cost_mode() is False


def test_system_prompt_does_not_cap_answer_length():
    from app.services import jarvis

    prompt = jarvis.JARVIS_SYSTEM_PROMPT.lower()
    assert "1-3 sentences" not in prompt, "hard sentence cap makes Jarvis read as canned"
    for capability in ("web_search", "make_phone_call", "send_email"):
        assert capability in prompt, f"{capability} not advertised to the model"
    assert "frozen" in prompt, "kill switch must stay in the system prompt"


# ── Voice ────────────────────────────────────────────────────────────────────

def test_elevenlabs_outranks_openai_when_configured(monkeypatch):
    monkeypatch.setattr(runtime_config, "_CACHE", None)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-openai")
    monkeypatch.delenv("ELEVENLABS_API_KEY", raising=False)
    assert tts_service.active_provider() == "openai"

    monkeypatch.setenv("ELEVENLABS_API_KEY", "sk-eleven")
    assert tts_service.active_provider() == "elevenlabs"


def test_voice_provider_reports_none_when_unconfigured(monkeypatch):
    monkeypatch.setattr(runtime_config, "_CACHE", None)
    monkeypatch.delenv("ELEVENLABS_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    assert tts_service.active_provider() == "none"


@pytest.mark.parametrize("key", [
    "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID", "ELEVENLABS_MODEL",
    "JARVIS_LOW_COST_MODE", "JARVIS_EFFORT", "JARVIS_CHAT_MAX_TOKENS",
])
def test_voice_and_tuning_keys_are_manageable_from_the_ui(key):
    assert key in runtime_config.MANAGED_KEYS


def test_elevenlabs_key_is_masked_in_the_admin_ui():
    """A credential rendered in plaintext on a screen-shared demo is a leak."""
    assert "ELEVENLABS_API_KEY" in runtime_config.SENSITIVE_KEYS
    status = runtime_config.status_for(["ELEVENLABS_API_KEY"])["ELEVENLABS_API_KEY"]
    assert status["sensitive"] is True


# ── The direct tool-calling path (raw HTTP, bypasses llm_client) ──────────────
# Jarvis has TWO Anthropic paths. Fixing only the router left this one — the
# lane the operator actually converses with — on last-generation Claude at a
# 320-token ceiling, which is what production reported after the first deploy.

def test_direct_path_uses_the_flagship_model(monkeypatch):
    from app.services import jarvis

    monkeypatch.delenv("ANTHROPIC_MODEL", raising=False)
    monkeypatch.setattr(runtime_config, "_CACHE", None)
    assert jarvis._anthropic_model() == "claude-opus-5"


def test_direct_path_budget_and_timeout_fit_a_real_answer():
    import re
    from pathlib import Path
    from app.services import jarvis

    src = Path(jarvis.__file__).read_text()

    budgets = [int(n) for n in re.findall(r"default_tokens = (\d+) if _low_cost_mode", src)]
    assert budgets and min(budgets) >= 2000, f"direct-path budget too low: {budgets}"

    # Adaptive thinking makes a good answer take longer than the old 14s ceiling,
    # which surfaced as Jarvis returning nothing at all.
    timeouts = [float(n) for n in re.findall(r"timeout_s = (\d+(?:\.\d+)?)", src)]
    assert timeouts and min(timeouts) >= 60, f"timeout too tight for thinking: {timeouts}"


def test_direct_path_never_sends_sampling_params():
    """A `temperature` key in this payload 400s every request on claude-opus-5."""
    import re
    from pathlib import Path
    from app.services import jarvis

    src = Path(jarvis.__file__).read_text()
    payload_blocks = re.findall(r'payload = \{.*?\n        \}', src, re.S)
    assert payload_blocks, "could not locate the Anthropic payload"
    for block in payload_blocks:
        for param in ("temperature", "top_p", "top_k"):
            assert f'"{param}"' not in block, f"{param} in payload -> 400 on current models"


# ── One model default, not six ────────────────────────────────────────────────
# The default was copy-pasted into 6 files. Upgrading the model updated some and
# silently left others, so production kept reporting claude-sonnet-4-5 through
# two deploys that had "upgraded the model".

def test_single_source_of_truth_for_the_model_default():
    assert runtime_config.DEFAULT_ANTHROPIC_MODEL == "claude-opus-5"
    assert runtime_config.anthropic_model() == "claude-opus-5"


def test_no_file_hardcodes_its_own_model_default():
    """Any second copy of the default will drift out of sync with the first."""
    from pathlib import Path

    app_dir = Path(runtime_config.__file__).parent.parent
    offenders = []
    for py in app_dir.rglob("*.py"):
        if py.name == "runtime_config.py":
            continue  # the one legitimate definition
        text = py.read_text()
        for line in text.splitlines():
            if 'ANTHROPIC_MODEL"' in line and "or " in line and "claude-" in line:
                offenders.append(f"{py.name}: {line.strip()[:90]}")
    assert not offenders, "hardcoded model defaults will drift:\n" + "\n".join(offenders)


def test_every_reporting_surface_agrees_with_the_configured_model(monkeypatch):
    """readiness / status / preflight must never disagree about what is running."""
    from fastapi.testclient import TestClient
    from app.main import app

    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test-key")
    monkeypatch.setattr(runtime_config, "_CACHE", None)
    client = TestClient(app)

    expected = runtime_config.anthropic_model()
    assert client.get("/api/v1/jarvis/readiness").json()["model"] == expected
    assert client.get("/api/v1/jarvis/status").json()["model"] == expected
    assert client.get("/api/v1/ops/dashboard-preflight").json()["jarvis"]["model"] == expected


def test_operator_override_propagates_to_every_surface(monkeypatch):
    from fastapi.testclient import TestClient
    from app.main import app

    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test-key")
    monkeypatch.setenv("ANTHROPIC_MODEL", "claude-sonnet-5")
    monkeypatch.setattr(runtime_config, "_CACHE", None)
    client = TestClient(app)

    assert runtime_config.anthropic_model() == "claude-sonnet-5"
    assert client.get("/api/v1/jarvis/readiness").json()["model"] == "claude-sonnet-5"
