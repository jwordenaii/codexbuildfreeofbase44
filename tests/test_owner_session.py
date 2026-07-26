"""
Owner/admin session tests.

HISTORY: this file used to POST to `/api/v1/admin/owner/unlock` and assert a
200. That endpoint does not exist and never did — it is absent from every
router and returns 404 in production, so the test had been failing on `main`
continuously. A test that asserts a fictional endpoint works is worse than no
test: it was the backend half of the same phantom route the Command Center's
unlock modal was calling, which is why that modal failed 100% of the time.

These tests exercise the real credential exchange, `/api/v1/auth/pin-token`.
"""

import os

import pytest
from fastapi.testclient import TestClient

# The router reads ADMIN_PIN at request time; set it before import anyway so
# the module is never imported into a half-configured environment.
os.environ["ADMIN_PIN"] = "135790"
# Token issuance refuses to sign without this and returns 500 — which is the
# correct behaviour, so the test supplies one rather than weakening the check.
os.environ.setdefault("JWT_SECRET_KEY", "test-only-not-a-real-secret")

from app.main import app  # noqa: E402

PIN_URL = "/api/v1/auth/pin-token"


@pytest.fixture()
def client():
    return TestClient(app)


def test_correct_pin_issues_token(client):
    resp = client.post(PIN_URL, json={"pin": "135790"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body.get("access_token")
    assert body.get("token_type", "").lower() == "bearer"


def test_incorrect_pin_is_rejected(client):
    resp = client.post(PIN_URL, json={"pin": "999999"})
    assert resp.status_code == 403


@pytest.mark.parametrize(
    "pin",
    [
        "",               # empty
        "abcd",           # non-numeric
        "123",            # too short
        "1234567890123",  # too long
    ],
)
def test_malformed_pins_are_rejected_before_comparison(client, pin):
    resp = client.post(PIN_URL, json={"pin": pin})
    assert resp.status_code in (400, 422), resp.text


def test_non_four_digit_pin_still_works(client, monkeypatch):
    """
    Regression guard. The old check was `len(pin) != 4`, which validated only
    the SUBMITTED pin and never ADMIN_PIN — so any deployment configured with a
    PIN of another length rejected every login before the comparison ran,
    locking the owner out of their own Command Center.
    """
    monkeypatch.setenv("ADMIN_PIN", "8675309")
    resp = client.post(PIN_URL, json={"pin": "8675309"})
    assert resp.status_code == 200, resp.text


def test_phantom_owner_unlock_endpoint_is_still_absent(client):
    """
    Pins down the fact this file documents. If someone later adds a real
    /admin/owner/unlock route, this test fails and whoever adds it must also
    repoint SessionUnlockModal.jsx in jworden-production, which currently uses
    authenticateWithPin() instead.
    """
    resp = client.post(
        "/api/v1/admin/owner/unlock", json={"owner_token": "x", "pin": "1234"}
    )
    assert resp.status_code == 404
