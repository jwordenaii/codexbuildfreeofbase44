"""
CORS allowlist regression tests.

WHY: the API used to set `allow_origin_regex = r"https://([\\w-]+--)?[\\w-]+\\.netlify\\.app"`
together with `allow_credentials=True`. netlify.app subdomains are free and
self-service, so *anyone* could register one and hold a credentialed
cross-origin grant against this backend. Verified against production on
2026-07-26: a preflight from a made-up origin was echoed back in
`access-control-allow-origin`.

Netlify is not part of this stack (frontend: Vercel, backend: Fly), so the
rule protected nothing and only widened the blast radius.

The money domains must keep working: the live bundle calls this API
cross-origin for billing checkout, portal estimate signing, and superadmin,
so a regression here is a revenue outage, not a cosmetic one.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app

MUST_ALLOW = [
    "https://jwordenasphaltpaving.com",
    "https://www.jwordenasphaltpaving.com",
    "https://thewordenstandard.com",
    "https://richmondasphaltpaving.com",
    "https://atlantaasphaltpavingpros.com",
    "https://asphaltpavingkansascity.com",
    "https://savannahasphaltpaving.com",
    "https://carolinablacktop.com",
]

MUST_BLOCK = [
    # Any third party who registers a free subdomain on a shared apex.
    "https://evil-attacker-site.netlify.app",
    "https://deploy-preview-42--jworden.netlify.app",
    "https://jworden.netlify.app",
    # Plain unrelated origin.
    "https://attacker.example.com",
    # Lookalikes that must not pass a sloppy substring/suffix check.
    "https://jwordenasphaltpaving.com.attacker.example",
    "http://jwordenasphaltpaving.com",  # scheme downgrade
]


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def _preflight_origin(client, origin):
    resp = client.options(
        "/api/v1/auth/status",
        headers={"Origin": origin, "Access-Control-Request-Method": "POST"},
    )
    return resp.headers.get("access-control-allow-origin")


@pytest.mark.parametrize("origin", MUST_ALLOW)
def test_money_domains_are_allowed(client, origin):
    assert _preflight_origin(client, origin) == origin, (
        f"{origin} lost CORS access — checkout and estimate signing break there"
    )


@pytest.mark.parametrize("origin", MUST_BLOCK)
def test_untrusted_origins_are_refused(client, origin):
    assert _preflight_origin(client, origin) is None, (
        f"{origin} was granted a credentialed cross-origin allowance"
    )


def test_no_wildcard_origin_with_credentials(client):
    """`*` plus credentials is the classic footgun; make sure we never ship it."""
    resp = client.options(
        "/api/v1/auth/status",
        headers={
            "Origin": "https://attacker.example.com",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert resp.headers.get("access-control-allow-origin") != "*"
