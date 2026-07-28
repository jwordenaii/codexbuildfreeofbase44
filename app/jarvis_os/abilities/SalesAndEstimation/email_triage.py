import imaplib
import email
import logging
from email.header import decode_header
import time
import os

# Increase IMAP line limit to handle 8-year-old inboxes with massive SEARCH results
imaplib._MAXLINE = 10000000

logger = logging.getLogger(__name__)

class EmailTriageEngine:
    """
    Advanced IMAP AI Triage Engine.
    Connects to Gmail, reads 8 years of history, uses AI logic to classify emails, 
    moves important ones to folders, and deletes junk/spam.
    """
    def __init__(self, email_address: str, app_password: str, dry_run: bool = True):
        self.email_address = email_address
        self.app_password = app_password
        self.dry_run = dry_run
        self.mail = None
        self.categories = ["KFC_Docs", "Business", "Banking", "Projects", "Spam_Updates"]

    def connect(self):
        try:
            self.mail = imaplib.IMAP4_SSL("imap.gmail.com")
            self.mail.login(self.email_address, self.app_password)
            logger.info(f"Successfully connected to {self.email_address}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to {self.email_address}: {e}")
            return False

    def _create_folder_if_missing(self, folder_name: str):
        if self.dry_run: return
        try:
            # Gmail uses nested labels usually, we just create the top level label
            self.mail.create(folder_name)
        except Exception as e:
            # Often fails if folder already exists, which is fine
            pass

    def _mock_ai_classify(self, subject: str, sender: str, body: str) -> str:
        """
        Simulates the LLM call to classify the email based on the user's requested folders.
        In production, this routes through google.generativeai or the Omni-Router.
        """
        subject_lower = str(subject).lower()
        sender_lower = str(sender).lower()
        body_lower = str(body).lower()
        
        # 1. ULTIMATE SAFETY OVERRIDES (Never Spam)
        tax_keywords = ["tax", "w2", "1099", "irs", "revenue", "audit", "cpa", "accountant"]
        contract_keywords = ["contract", "agreement", "nda", "sign", "docusign", "proposal"]
        spreadsheet_keywords = ["spreadsheet", "excel", "csv", "xlsx", ".xls"]
        
        if any(k in subject_lower or k in body_lower for k in tax_keywords):
            return "Taxes"
            
        if any(k in subject_lower or k in body_lower for k in contract_keywords):
            return "Contracts"
            
        if any(k in subject_lower or k in body_lower for k in spreadsheet_keywords):
            return "Spreadsheets_Data"
        
        # 2. STANDARD ROUTING
        lead_keywords = ["estimate", "quote", "lead", "roofing", "paving", "bid"]
        if any(k in subject_lower or k in body_lower for k in lead_keywords):
            return "Leads"
            
        if "kfc" in subject_lower or "franchise" in subject_lower or "yum" in sender_lower:
            return "KFC_Docs"
        if "bank" in sender_lower or "statement" in subject_lower or "wire" in subject_lower or "deposit" in subject_lower:
            return "Banking"
        if "project" in subject_lower or "blueprint" in subject_lower:
            return "Projects"
            
        # 3. SPAM TRAP
        if "unsubscribe" in body_lower or "newsletter" in subject_lower or "offer" in subject_lower:
            return "Spam_Updates"
            
        return "Business" # Default to business if unclear

    def triage_inbox(self, max_emails: int = 50):
        if not self.mail:
            logger.error("Not connected to IMAP.")
            return

        self.mail.select("inbox")
        status, messages = self.mail.search(None, "ALL")
        
        if status != "OK":
            logger.error("Failed to search inbox.")
            return
            
        email_ids = messages[0].split()
        total_emails = len(email_ids)
        logger.info(f"Found {total_emails} total emails. Processing up to {max_emails}...")
        
        # Process from newest to oldest for this batch
        for i in reversed(range(max(0, total_emails - max_emails), total_emails)):
            email_id = email_ids[i]
            
            try:
                # Fetch the email data
                res, msg_data = self.mail.fetch(email_id, "(RFC822)")
                if res != "OK": continue
                
                for response_part in msg_data:
                    if isinstance(response_part, tuple):
                        msg = email.message_from_bytes(response_part[1])
                        
                        # Decode Subject
                        subject, encoding = decode_header(msg.get("Subject", "No Subject"))[0]
                        if isinstance(subject, bytes):
                            try:
                                subject = subject.decode(encoding if encoding else "utf-8", errors="ignore")
                            except LookupError:
                                subject = subject.decode("utf-8", errors="ignore")
                            
                        sender = msg.get("From", "Unknown")
                        
                        # Extract plain text body (simplified)
                        body = ""
                        if msg.is_multipart():
                            for part in msg.walk():
                                if part.get_content_type() == "text/plain":
                                    try:
                                        body = part.get_payload(decode=True).decode("utf-8", errors="ignore")
                                        break
                                    except: pass
                        else:
                            try:
                                body = msg.get_payload(decode=True).decode("utf-8", errors="ignore")
                            except: pass
                        
                        # AI Classification
                        category = self._mock_ai_classify(subject, sender, body)
                        
                        if category == "Spam_Updates":
                            target_folder = "AI_Sorted/Pending_Deletion"
                            logger.info(f"MOVING Spam to {target_folder}: '{subject}' from {sender}")
                            if not self.dry_run:
                                self._create_folder_if_missing(target_folder)
                                self.mail.copy(email_id, target_folder)
                                self.mail.store(email_id, '+FLAGS', '\\Deleted')
                        else:
                            target_folder = f"AI_Sorted/{category}"
                            logger.info(f"MOVING to {target_folder}: '{subject}' from {sender}")
                            if not self.dry_run:
                                self._create_folder_if_missing(target_folder)
                                self.mail.copy(email_id, target_folder)
                                self.mail.store(email_id, '+FLAGS', '\\Deleted') # Remove from inbox after copy
            except imaplib.IMAP4.abort:
                logger.warning("IMAP connection aborted by Google (Rate Limit / Timeout). Reconnecting to resume sweep...")
                self.connect()
                self.mail.select("inbox")
            except Exception as e:
                logger.error(f"Error processing email {email_id}: {e}")
                            
        # Permanently expunge deleted emails if not dry run
        if not self.dry_run:
            self.mail.expunge()
            logger.info("Expunged deleted emails.")

    def close(self):
        if self.mail:
            try:
                self.mail.close()
                self.mail.logout()
            except: pass
