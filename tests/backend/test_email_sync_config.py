"""
Tests for multi-mailbox lead intake configuration.

The engine (sync_gmail_accounts) could always read several mailboxes; what was
missing was a safe way to configure them and anything to call it. These tests
cover the part that carries live credentials:

  • accounts load from the environment (a Fly secret), not a committed file
  • a malformed secret reports the problem WITHOUT echoing its contents
  • the status view never leaks a password, only whether one is set
  • placeholder / inactive / password-less accounts are not treated as ready
  • with nothing configured the sync is quiet and returns a clear reason
"""
from __future__ import annotations

import json

from app.services import email_sync


def _clear(monkeypatch):
    monkeypatch.delenv("EMAIL_ACCOUNTS_JSON", raising=False)


def test_accounts_load_from_environment(monkeypatch):
    monkeypatch.setenv("EMAIL_ACCOUNTS_JSON", json.dumps([
        {"email": "a@example.com", "app_password": "aaaa bbbb cccc dddd", "active": True},
        {"email": "b@example.com", "app_password": "eeee ffff gggg hhhh", "active": True},
    ]))
    accounts, error = email_sync.load_accounts()
    assert error is None
    assert [a["email"] for a in accounts] == ["a@example.com", "b@example.com"]


def test_malformed_secret_is_reported_without_echoing_it(monkeypatch):
    monkeypatch.setenv("EMAIL_ACCOUNTS_JSON", "not-json-and-contains-hunter2")
    accounts, error = email_sync.load_accounts()
    assert accounts == []
    assert error and "EMAIL_ACCOUNTS_JSON" in error
    # The bad value must never be reflected back into logs or responses.
    assert "hunter2" not in error


def test_non_array_secret_rejected(monkeypatch):
    monkeypatch.setenv("EMAIL_ACCOUNTS_JSON", json.dumps({"email": "a@example.com"}))
    accounts, error = email_sync.load_accounts()
    assert accounts == []
    assert error and "array" in error.lower()


def test_status_never_leaks_passwords(monkeypatch):
    secret = "zzzz yyyy xxxx wwww"
    monkeypatch.setenv("EMAIL_ACCOUNTS_JSON", json.dumps([
        {"email": "real@example.com", "app_password": secret, "active": True},
    ]))
    status = email_sync.account_status()
    blob = json.dumps(status)
    assert secret not in blob
    assert "app_password" not in blob
    assert status["accounts"][0]["has_password"] is True


def test_placeholder_and_inactive_accounts_are_not_ready(monkeypatch):
    monkeypatch.setenv("EMAIL_ACCOUNTS_JSON", json.dumps([
        {"email": "live@example.com", "app_password": "aaaa bbbb cccc dddd", "active": True},
        {"email": "placeholder@example.com",
         "app_password": "ENTER_16_LETTER_PASSWORD_HERE", "active": True},
        {"email": "off@example.com", "app_password": "aaaa bbbb cccc dddd", "active": False},
        {"email": "nopw@example.com", "app_password": "", "active": True},
    ]))
    status = email_sync.account_status()
    assert status["total"] == 4
    assert status["ready"] == 1, "only the fully-configured active account counts as ready"


def test_unconfigured_is_quiet_and_explains_itself(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setattr(email_sync, "_ACCOUNTS_FILE", email_sync.Path("/nonexistent/x.json"))
    status = email_sync.account_status()
    assert status["configured"] is False
    assert "EMAIL_ACCOUNTS_JSON" in status["reason"]

    result = email_sync.sync_gmail_accounts()
    assert result["status"] == "error"
    assert "EMAIL_ACCOUNTS_JSON" in result["detail"]
