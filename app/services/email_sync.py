import json
import logging
import imaplib
import os
import email
from email.header import decode_header
from pathlib import Path
from typing import Dict, Any, List

from ..database import SessionLocal
from ..models import Lead, InboxMessage
from .email_intake import extract_lead_from_email
from .email_service import send_admin_notification


def geocode_address(address: str):
    """Resolve an address to (lat, lng), or None.

    WHY THIS WRAPPER EXISTS
    ───────────────────────
    This module imported `from .geocoding import geocode_address`, and
    app/services/geocoding.py does not exist and never has. That made
    email_sync UNIMPORTABLE — not merely unwired: any caller, task or test
    touching it died at import with ModuleNotFoundError. It is the reason the
    multi-mailbox intake could not have run even if something had called it.

    The real geocoder lives in weather_service (_geocode: Google Geocoding
    first, OpenWeather as fallback). Imported lazily so a missing key or an
    unavailable weather module degrades to "no coordinates" rather than
    taking the whole lead-intake path down with it — a lead without a pin on
    the map is still a lead.
    """
    if not address:
        return None
    try:
        from .weather_service import _geocode  # noqa: PLC0415
        return _geocode(address)
    except Exception as exc:  # noqa: BLE001
        logger.warning("geocode failed for %r: %s", address, exc)
        return None

logger = logging.getLogger(__name__)

_REPO_ROOT = Path(__file__).resolve().parents[2]
_ACCOUNTS_FILE = _REPO_ROOT / "email_accounts.json"

# App passwords are live credentials. They belong in a Fly secret, never in a
# file that could be committed — so the environment is the primary source and
# the JSON file is a local-development fallback only.
_ACCOUNTS_ENV = "EMAIL_ACCOUNTS_JSON"
_PLACEHOLDER_PASSWORD = "ENTER_16_LETTER_PASSWORD_HERE"


def load_accounts() -> tuple[List[Dict[str, Any]], str | None]:
    """Return (accounts, error). Environment first, file second.

    The env var holds a JSON array of objects:
      [{"email": "you@gmail.com", "app_password": "abcd efgh ijkl mnop",
        "active": true, "tenant_id": "optional"}]

    Passwords are never logged, and a malformed value is reported without
    echoing its contents.
    """
    raw = os.getenv(_ACCOUNTS_ENV, "").strip()
    if raw:
        try:
            accounts = json.loads(raw)
        except Exception:
            return [], f"{_ACCOUNTS_ENV} is not valid JSON"
        if not isinstance(accounts, list):
            return [], f"{_ACCOUNTS_ENV} must be a JSON array of account objects"
        return accounts, None

    if not _ACCOUNTS_FILE.exists():
        return [], (
            f"no mailboxes configured — set the {_ACCOUNTS_ENV} secret "
            "(JSON array of {email, app_password, active})"
        )
    try:
        with open(_ACCOUNTS_FILE, "r") as fh:
            accounts = json.load(fh)
    except Exception as exc:  # noqa: BLE001
        return [], f"failed to parse email_accounts.json: {exc}"
    if not isinstance(accounts, list):
        return [], "email_accounts.json must be a JSON array of account objects"
    return accounts, None


def account_status() -> Dict[str, Any]:
    """Non-secret view of what is configured — safe to expose and to log."""
    accounts, error = load_accounts()
    if error:
        return {"configured": False, "reason": error, "accounts": []}
    view = []
    for acc in accounts:
        pw = acc.get("app_password") or ""
        view.append({
            "email": acc.get("email"),
            "active": bool(acc.get("active", False)),
            "has_password": bool(pw) and pw != _PLACEHOLDER_PASSWORD,
            "tenant_id": acc.get("tenant_id"),
        })
    ready = [a for a in view if a["active"] and a["has_password"] and a["email"]]
    return {
        "configured": True,
        "source": _ACCOUNTS_ENV if os.getenv(_ACCOUNTS_ENV, "").strip() else "email_accounts.json",
        "total": len(view),
        "ready": len(ready),
        "accounts": view,
    }

def _decode_header_value(header_value: str | None) -> str:
    if not header_value:
        return ""
    try:
        decoded_parts = decode_header(header_value)
        parts = []
        for content, encoding in decoded_parts:
            if isinstance(content, bytes):
                parts.append(content.decode(encoding or "utf-8", errors="replace"))
            else:
                parts.append(content)
        return "".join(parts)
    except Exception as e:
        logger.warning(f"Error decoding header {header_value}: {e}")
        return str(header_value)

def _get_body(msg) -> str:
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            disposition = str(part.get("Content-Disposition"))
            if content_type in ["text/plain", "text/html"] and "attachment" not in disposition:
                try:
                    payload = part.get_payload(decode=True)
                    if payload:
                        body += payload.decode("utf-8", errors="ignore")
                except Exception as e:
                    logger.warning(f"Failed to decode part: {e}")
    else:
        try:
            payload = msg.get_payload(decode=True)
            if payload:
                body = payload.decode("utf-8", errors="ignore")
        except Exception as e:
            logger.warning(f"Failed to decode body: {e}")
    return body

def _parse_sender(sender_header: str):
    # e.g., "John Doe <john@example.com>" or "john@example.com"
    import email.utils
    name, addr = email.utils.parseaddr(sender_header)
    return name, addr

def sync_gmail_accounts() -> Dict[str, Any]:
    """
    Connects to configured Gmail accounts, reads unread emails, parses them as leads, 
    saves to DB, and marks them as read.
    """
    accounts, load_error = load_accounts()
    if load_error:
        logger.warning("email_sync: %s", load_error)
        return {"status": "error", "detail": load_error}

    results = {
        "accounts_processed": 0,
        "accounts_skipped": 0,
        "emails_read": 0,
        "leads_created": 0,
        "errors": []
    }

    db = SessionLocal()
    try:
        for acc in accounts:
            email_addr = acc.get("email")
            password = acc.get("app_password")
            active = acc.get("active", False)

            if not active or password == _PLACEHOLDER_PASSWORD or not password or not email_addr:
                logger.info(f"Skipping account {email_addr} (inactive or placeholder password)")
                results["accounts_skipped"] += 1
                continue

            try:
                logger.info(f"Connecting IMAP for {email_addr}...")
                mail = imaplib.IMAP4_SSL("imap.gmail.com")
                mail.login(email_addr, password)
                mail.select("inbox")

                status, messages = mail.search(None, "UNSEEN")
                if status != "OK":
                    logger.warning(f"Failed to search inbox for {email_addr}")
                    mail.logout()
                    continue

                email_ids = messages[0].split()
                results["accounts_processed"] += 1

                for e_id in email_ids:
                    res, msg_data = mail.fetch(e_id, "(RFC822)")
                    if res != "OK":
                        continue
                        
                    for response_part in msg_data:
                        if isinstance(response_part, tuple):
                            msg = email.message_from_bytes(response_part[1])
                            
                            subject = _decode_header_value(msg.get("Subject"))
                            sender = _decode_header_value(msg.get("From"))
                            
                            from_name, from_email = _parse_sender(sender)
                            body = _get_body(msg)
                            
                            logger.info(f"Processing unread email: {subject} from {from_email}")
                            
                            # Use GPT-4o logic to extract Lead
                            lead_data = extract_lead_from_email(
                                subject=subject,
                                body=body,
                                from_email=from_email,
                                from_name=from_name
                            )
                            
                            is_lead = lead_data.get("is_lead", False)
                            confidence = lead_data.get("confidence") or 0.0
                            category = lead_data.get("category") or "General"
                            importance = lead_data.get("importance_score") or 1
                            body_summary = lead_data.get("body_summary") or ""
                            
                            # 1. ALWAYS log the email in InboxMessage
                            inbox_msg = InboxMessage(
                                email_account=email_addr,
                                sender_name=from_name,
                                sender_email=from_email,
                                subject=subject,
                                body_summary=body_summary,
                                category=category,
                                importance_score=importance,
                                is_lead=is_lead
                            )
                            db.add(inbox_msg)
                            
                            # 2. AI Gatekeeper: Only create Lead if it's actually a lead
                            if not is_lead or confidence < 0.6:
                                logger.info(f"Skipping CRM insertion for non-lead email (is_lead={is_lead}, conf={confidence}): {subject}")
                                # Commit the InboxMessage and mark as seen
                                db.commit()
                                mail.store(e_id, '+FLAGS', '\\Seen')
                                results["emails_read"] += 1
                                continue
                            
                            # Geocode lead address
                            lat, lng = None, None
                            addr_str = lead_data.get("address")
                            if addr_str:
                                coords = geocode_address(addr_str)
                                if coords:
                                    lat, lng = coords

                            # Create Lead in DB
                            lead = Lead(
                                name=lead_data.get("name") or "Unknown Email Lead",
                                phone=lead_data.get("phone"),
                                email=lead_data.get("email"),
                                address=addr_str,
                                service_type=lead_data.get("service_type") or "unknown",
                                property_type=lead_data.get("property_type") or "residential",
                                urgency=lead_data.get("urgency") or "flexible",
                                project_size_sqft=lead_data.get("project_size_sqft"),
                                message=lead_data.get("message") or "",
                                source=f"gmail:{email_addr}",
                                latitude=lat,
                                longitude=lng,
                                raw_data=lead_data
                            )
                            db.add(lead)
                            db.commit()
                            db.refresh(lead)
                            
                            results["leads_created"] += 1
                            results["emails_read"] += 1
                            
                            # Notify Admin
                            try:
                                send_admin_notification(lead)
                            except Exception as e:
                                logger.error(f"Failed to send admin notification for lead {lead.id}: {e}")
                                
                            # Mark as seen
                            mail.store(e_id, '+FLAGS', '\\Seen')
                            
                mail.logout()
            except Exception as e:
                logger.error(f"Error processing account {email_addr}: {e}")
                results["errors"].append(f"{email_addr}: {str(e)}")

    finally:
        db.close()

    return results
