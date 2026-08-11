"""
Guards for Google Search Console / GA4 credential wiring.

This is the class of bug that kept surfacing across this codebase: code that
looks finished, reports "not configured" instead of erroring, and therefore
fails silently forever.

app/routers/google_reporting.py read three environment variables that nothing
in the project ever sets:

    GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON   (2 uses)  vs
    GSC_SERVICE_ACCOUNT_JSON                    (18 uses, and in MANAGED_KEYS)

    GOOGLE_SEARCH_CONSOLE_SITE_URL               (2 uses)  vs
    GSC_SITE_URL                                (15 uses, and in MANAGED_KEYS)

    GOOGLE_ANALYTICS_PROPERTY_ID                 vs  GA4_PROPERTY_ID

Setting the credential the documented way left this router blind. Worse, the
values were read at import time, so a key pasted into the Command Center could
not take effect without a redeploy.

Search Console is how the owner sees what Google is doing with the money
sites, so a silently-blind reporting router is a ranking problem, not a
cosmetic one.
"""

import pytest

from app.routers import google_reporting as gr
from app.services import runtime_config

CANONICAL = {
    "GSC_SERVICE_ACCOUNT_JSON": '{"type":"service_account"}',
    "GSC_SITE_URL": "sc-domain:jwordenasphaltpaving.com",
    "GA4_PROPERTY_ID": "123456",
}

LEGACY = {
    "GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON": '{"type":"service_account"}',
    "GOOGLE_SEARCH_CONSOLE_SITE_URL": "sc-domain:jwordenasphaltpaving.com",
    "GOOGLE_ANALYTICS_PROPERTY_ID": "123456",
}

ALL_NAMES = list(CANONICAL) + list(LEGACY) + ["GSC_SA_JSON"]


@pytest.fixture()
def clean_env(monkeypatch):
    for name in ALL_NAMES:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setattr(runtime_config, "_CACHE", None)
    return monkeypatch


def test_reports_unconfigured_when_nothing_is_set(clean_env):
    assert gr._gsc_ready() is False
    assert gr._ga4_ready() is False


def test_canonical_names_are_honoured(clean_env):
    """The documented names — the ones in MANAGED_KEYS and the rest of the
    codebase — must actually reach this router."""
    for k, v in CANONICAL.items():
        clean_env.setenv(k, v)
    clean_env.setattr(runtime_config, "_CACHE", None)
    assert gr._gsc_ready() is True
    assert gr._ga4_ready() is True
    assert gr._gsc_site_url() == CANONICAL["GSC_SITE_URL"]
    assert gr._ga4_property_id() == CANONICAL["GA4_PROPERTY_ID"]


def test_legacy_names_still_work(clean_env):
    """A deployment that already set the old names must not break."""
    for k, v in LEGACY.items():
        clean_env.setenv(k, v)
    clean_env.setattr(runtime_config, "_CACHE", None)
    assert gr._gsc_ready() is True
    assert gr._ga4_ready() is True


def test_canonical_wins_over_legacy(clean_env):
    for k, v in LEGACY.items():
        clean_env.setenv(k, v)
    clean_env.setenv("GSC_SITE_URL", "sc-domain:canonical.example")
    clean_env.setattr(runtime_config, "_CACHE", None)
    assert gr._gsc_site_url() == "sc-domain:canonical.example"


def test_config_is_read_per_request_not_at_import(clean_env):
    """A key pasted into the Command Center must take effect without a
    redeploy. Import-time constants are what broke that."""
    assert gr._gsc_ready() is False
    for k, v in CANONICAL.items():
        clean_env.setenv(k, v)
    clean_env.setattr(runtime_config, "_CACHE", None)
    assert gr._gsc_ready() is True, "still reading config at import time"


def test_no_module_level_getenv_for_gsc_or_ga4():
    """Structural guard — a reintroduced module-level constant would restore
    the original silent failure."""
    import re
    from pathlib import Path

    src = Path(gr.__file__).read_text()
    body = "\n".join(
        line for line in src.splitlines()
        if not line.lstrip().startswith("#")
    )
    offenders = re.findall(
        r'^_\w*(?:GSC|GA4|SEARCH_CONSOLE|ANALYTICS)\w*\s*=\s*os\.getenv',
        body, re.M | re.I,
    )
    assert not offenders, f"module-level getenv reintroduced: {offenders}"


def test_credentials_are_managed_and_masked():
    """Settable from the Command Center, and never rendered in plaintext."""
    assert "GSC_SERVICE_ACCOUNT_JSON" in runtime_config.MANAGED_KEYS
    assert "GSC_SITE_URL" in runtime_config.MANAGED_KEYS
    assert "GA4_PROPERTY_ID" in runtime_config.MANAGED_KEYS
    assert "GSC_SERVICE_ACCOUNT_JSON" in runtime_config.SENSITIVE_KEYS
