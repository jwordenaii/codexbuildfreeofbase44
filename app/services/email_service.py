"""
email_service.py — SendGrid transactional email client for J. Worden & Sons.

Wraps the SendGrid Python SDK with:
  - Automatic HTML + plain-text multipart messages
  - Per-method retry logic (up to MAX_RETRIES attempts with exponential back-off)
  - Graceful degradation when SENDGRID_API_KEY is not configured
  - Structured logging for every send attempt

Environment variables
─────────────────────
  SENDGRID_API_KEY    — SendGrid API key (required for live sends)
  SENDGRID_FROM_EMAIL — Verified sender address (required for live sends)
  SENDGRID_FROM_NAME  — Display name for the From header (optional)

Public API
──────────
  send_quote_confirmation(lead)       → bool
  send_admin_notification(lead)       → bool
  send_follow_up(lead, task_type)     → bool
  send_contact_response(contact)      → bool
  send_raw(*, to, subject, html, text) → bool
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any

from . import email_templates as tmpl

logger = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────────────────────────

_API_KEY = os.getenv("SENDGRID_API_KEY", "").strip()
_FROM_EMAIL = os.getenv("SENDGRID_FROM_EMAIL", "").strip()
_FROM_NAME = os.getenv("SENDGRID_FROM_NAME", "J. Worden & Sons Asphalt Paving").strip()
_ADMIN_EMAIL = os.getenv("ADMIN_NOTIFY_EMAIL", "j.wordenandsonspaving@gmail.com").strip()

MAX_RETRIES = 3
RETRY_BASE_DELAY = 1.0  # seconds; doubles on each retry


# ── SendGrid client initialisation ────────────────────────────────────────────

def _get_sg_client():
    """
    Return an initialised SendGrid API client, or None if the SDK is not
    installed or the API key is missing.
    """
    if not _API_KEY:
        logger.warning(
            "SENDGRID_API_KEY not set — email sends will be skipped. "
            "Set the env var to enable transactional email."
        )
        return None
    if not _FROM_EMAIL:
        logger.warning(
            "SENDGRID_FROM_EMAIL not set — email sends will be skipped. "
            "Set the env var to a verified SendGrid sender address."
        )
        return None
    try:
        import sendgrid  # type: ignore  # noqa: PLC0415
        return sendgrid.SendGridAPIClient(api_key=_API_KEY)
    except ImportError:
        logger.error(
            "sendgrid package not installed. "
            "Add 'sendgrid==7.0.0' to requirements.txt and redeploy."
        )
        return None


# ── Core send helper ──────────────────────────────────────────────────────────

def send_raw(
    *,
    to_email: str,
    subject: str,
    html_body: str,
    plain_text: str = "",
    from_email: str | None = None,
    from_name: str | None = None,
) -> bool:
    """
    Send a single transactional email via SendGrid with retry logic.

    Args:
        to_email:   Recipient email address.
        subject:    Email subject line.
        html_body:  Full HTML content.
        plain_text: Plain-text fallback (recommended for deliverability).
        from_email: Override sender address (defaults to SENDGRID_FROM_EMAIL).
        from_name:  Override sender display name.

    Returns:
        True if the email was accepted by SendGrid (2xx response), False otherwise.
    """
    sg = _get_sg_client()
    if sg is None:
        return False

    sender_email = from_email or _FROM_EMAIL
    sender_name = from_name or _FROM_NAME

    try:
        from sendgrid.helpers.mail import (  # type: ignore  # noqa: PLC0415
            Mail,
            Email,
            To,
            Content,
        )
    except ImportError:
        logger.error("sendgrid.helpers.mail not available — cannot build email message.")
        return False

    message = Mail()
    message.from_email = Email(sender_email, sender_name)
    message.to = [To(to_email)]
    message.subject = subject

    if plain_text:
        message.add_content(Content("text/plain", plain_text))
    message.add_content(Content("text/html", html_body))

    last_exc: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = sg.send(message)
            status = response.status_code
            if 200 <= status < 300:
                logger.info(
                    "Email sent via SendGrid: to=%s subject=%r status=%d attempt=%d",
                    to_email,
                    subject,
                    status,
                    attempt,
                )
                return True
            else:
                logger.warning(
                    "SendGrid returned non-2xx: to=%s status=%d attempt=%d body=%s",
                    to_email,
                    status,
                    attempt,
                    getattr(response, "body", ""),
                )
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            logger.warning(
                "SendGrid send error (attempt %d/%d): to=%s error=%s",
                attempt,
                MAX_RETRIES,
                to_email,
                exc,
            )

        if attempt < MAX_RETRIES:
            delay = RETRY_BASE_DELAY * (2 ** (attempt - 1))
            logger.debug("Retrying in %.1fs…", delay)
            time.sleep(delay)

    logger.error(
        "Failed to send email after %d attempts: to=%s subject=%r last_error=%s",
        MAX_RETRIES,
        to_email,
        subject,
        last_exc,
    )
    return False


# ── Public API ────────────────────────────────────────────────────────────────

def send_quote_confirmation(lead: Any) -> bool:
    """
    Send a quote confirmation email to the customer.

    Args:
        lead: Lead ORM object or dict containing at minimum 'name' and 'email'.

    Returns:
        True if the email was sent successfully.
    """
    to_email = getattr(lead, "email", None) or lead.get("email", "")
    if not to_email:
        logger.warning("send_quote_confirmation: no email address on lead — skipping")
        return False

    subject, html_body, plain_text = tmpl.quote_confirmation(lead)
    logger.info("Sending quote confirmation to %s", to_email)
    return send_raw(
        to_email=to_email,
        subject=subject,
        html_body=html_body,
        plain_text=plain_text,
    )


def send_admin_notification(lead: Any) -> bool:
    """
    Send a new-lead notification to the admin (J. Worden).

    Args:
        lead: Lead ORM object or dict.

    Returns:
        True if the email was sent successfully.
    """
    if not _ADMIN_EMAIL:
        logger.warning("send_admin_notification: ADMIN_NOTIFY_EMAIL not set — skipping")
        return False

    subject, html_body, plain_text = tmpl.admin_new_lead(lead)
    lead_id = getattr(lead, "id", None) or lead.get("id", "?")
    logger.info("Sending admin notification for lead #%s to %s", lead_id, _ADMIN_EMAIL)
    return send_raw(
        to_email=_ADMIN_EMAIL,
        subject=subject,
        html_body=html_body,
        plain_text=plain_text,
    )


def send_follow_up(lead: Any, task_type: str) -> bool:
    """
    Send a follow-up email to a lead based on their temperature tier.

    Args:
        lead:      Lead ORM object or dict.
        task_type: One of 'hot_1h', 'warm_3d', 'cool_7d'.

    Returns:
        True if the email was sent successfully.
    """
    to_email = getattr(lead, "email", None) or lead.get("email", "")
    if not to_email:
        logger.warning("send_follow_up: no email address on lead — skipping")
        return False

    template_map = {
        "hot_1h": tmpl.follow_up_hot,
        "warm_3d": tmpl.follow_up_warm,
        "cool_7d": tmpl.follow_up_cool,
    }

    template_fn = template_map.get(task_type)
    if template_fn is None:
        logger.error("send_follow_up: unknown task_type=%r — skipping", task_type)
        return False

    subject, html_body, plain_text = template_fn(lead)
    lead_id = getattr(lead, "id", None) or lead.get("id", "?")
    logger.info(
        "Sending %s follow-up email to %s (lead #%s)",
        task_type,
        to_email,
        lead_id,
    )
    return send_raw(
        to_email=to_email,
        subject=subject,
        html_body=html_body,
        plain_text=plain_text,
    )


def send_contact_response(contact: Any) -> bool:
    """
    Send an auto-reply to a customer who submitted the contact form.

    Args:
        contact: ContactMessage ORM object or dict containing 'name' and 'email'.

    Returns:
        True if the email was sent successfully.
    """
    to_email = getattr(contact, "email", None) or contact.get("email", "")
    if not to_email:
        logger.warning("send_contact_response: no email address on contact — skipping")
        return False

    subject, html_body, plain_text = tmpl.contact_response(contact)
    logger.info("Sending contact auto-reply to %s", to_email)
    return send_raw(
        to_email=to_email,
        subject=subject,
        html_body=html_body,
        plain_text=plain_text,
    )
