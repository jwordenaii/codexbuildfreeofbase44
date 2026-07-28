import json
import logging
import imaplib
import email
from email.header import decode_header
from pathlib import Path
from typing import Dict, Any, List

from ..database import SessionLocal
from ..models import Lead, InboxMessage
from .email_intake import extract_lead_from_email
from .email_service import send_admin_notification
from .geocoding import geocode_address

logger = logging.getLogger(__name__)

_REPO_ROOT = Path(__file__).resolve().parents[2]
_ACCOUNTS_FILE = _REPO_ROOT / "email_accounts.json"

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
    if not _ACCOUNTS_FILE.exists():
        logger.warning(f"Email accounts file not found at {_ACCOUNTS_FILE}")
        return {"status": "error", "detail": "email_accounts.json not found"}

    try:
        with open(_ACCOUNTS_FILE, "r") as f:
            accounts = json.load(f)
    except Exception as e:
        logger.error(f"Failed to parse email_accounts.json: {e}")
        return {"status": "error", "detail": f"Failed to parse JSON: {e}"}

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

            if not active or password == "ENTER_16_LETTER_PASSWORD_HERE" or not email_addr:
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
