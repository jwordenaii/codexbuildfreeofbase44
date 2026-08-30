"""
email_sync.py — multi-mailbox lead intake.

WHY THIS ROUTER EXISTS
──────────────────────
`services/email_sync.sync_gmail_accounts()` has always been able to read many
mailboxes at once — it loops a list of accounts, connects to each over IMAP,
parses unread mail into leads, and files them. It was a finished engine with no
ignition: nothing in the codebase called it, and its account list lived in a
file that was never created. So a business running several inboxes had its
leads sitting unread in whichever mailbox the owner was not looking at.

This router is the ignition, plus a status endpoint that answers the question
you actually ask at 6am — "is it watching my mailboxes, and did it find
anything?" — without ever printing a credential.

Routes
──────
  GET  /api/v1/email-sync/status   — which mailboxes are configured and ready
  POST /api/v1/email-sync/run      — sync every active mailbox now

CONFIGURATION
─────────────
App passwords are live credentials, so they come from the environment, never
from a file in the repository. Set one Fly secret:

  EMAIL_ACCOUNTS_JSON='[{"email":"you@gmail.com",
                         "app_password":"abcd efgh ijkl mnop",
                         "active":true}]'

Gmail requires an App Password (16 letters, generated at
myaccount.google.com → Security → 2-Step Verification → App passwords).
A normal account password will not authenticate over IMAP.
"""

import logging

from fastapi import APIRouter, Depends, Request

from ..core.limiter import limiter
from ..core.security import verify_premium_security
from ..services.email_sync import account_status, sync_gmail_accounts

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/email-sync", tags=["email-sync"])


@router.get("/status", summary="Which mailboxes are configured for lead intake")
@limiter.limit("30/minute")
def get_status(request: Request, _auth=Depends(verify_premium_security)):
    """Non-secret view: addresses, active flags, whether a password is set.

    Never returns the passwords themselves — only whether each account has one
    that is not the placeholder.
    """
    return {"status": "ok", **account_status()}


@router.post("/run", summary="Read unread mail in every active mailbox now")
@limiter.limit("6/minute")
def run_sync(request: Request, _auth=Depends(verify_premium_security)):
    """Sync all configured mailboxes.

    Rate-limited deliberately: each call opens an IMAP session per mailbox and
    runs an LLM extraction per unread message, so this is not something to
    hammer. The scheduled Celery task is the normal path; this endpoint is for
    an owner who wants it run right now.
    """
    result = sync_gmail_accounts()
    if result.get("status") == "error":
        # A missing configuration is not a server fault — report it plainly so
        # the caller sees what to set rather than a stack trace.
        logger.warning("email_sync run failed: %s", result.get("detail"))
    return result
