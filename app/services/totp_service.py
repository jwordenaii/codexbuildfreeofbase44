"""
totp_service.py — TOTP-based two-factor authentication helpers.

Wraps pyotp for secret generation and token verification, and qrcode for
producing a data-URI QR code that the admin can scan with any RFC 6238
authenticator app (Google Authenticator, Authy, 1Password, etc.).

All methods are stateless — persistence is handled by the caller via the
TwoFactorSecret ORM model.
"""

from __future__ import annotations

import base64
import io
import json
import logging
import os
import secrets
import string

import pyotp
import qrcode

logger = logging.getLogger(__name__)

# Issuer label shown in the authenticator app (e.g. "JWordenAI Admin")
_ISSUER = os.getenv("TOTP_ISSUER", "JWordenAI Admin")

# Number of backup codes generated per setup
_BACKUP_CODE_COUNT = 10
# Each backup code is 10 alphanumeric characters (upper-case + digits)
_BACKUP_CODE_CHARS = string.ascii_uppercase + string.digits
_BACKUP_CODE_LENGTH = 10


class TOTPService:
    """Stateless TOTP helpers for admin 2FA setup and verification."""

    # ------------------------------------------------------------------
    # Secret generation
    # ------------------------------------------------------------------

    @staticmethod
    def generate_secret(username: str) -> dict:
        """
        Generate a new TOTP secret for *username* and return a dict with:

          secret      — base32-encoded TOTP seed (store this in the DB)
          otpauth_url — otpauth:// URI for manual entry in authenticator apps
          qr_code_uri — data:image/png;base64,… PNG QR code (embed in <img>)

        The secret is generated fresh each call — call this only during setup,
        not on every login.
        """
        secret = pyotp.random_base32()
        totp = pyotp.TOTP(secret)
        otpauth_url = totp.provisioning_uri(name=username, issuer_name=_ISSUER)

        # Render QR code to an in-memory PNG and base64-encode it
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(otpauth_url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")

        buf = io.BytesIO()
        img.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")
        qr_code_uri = f"data:image/png;base64,{b64}"

        logger.info("TOTP secret generated for user=%s issuer=%s", username, _ISSUER)
        return {
            "secret": secret,
            "otpauth_url": otpauth_url,
            "qr_code_uri": qr_code_uri,
        }

    # ------------------------------------------------------------------
    # Token verification
    # ------------------------------------------------------------------

    @staticmethod
    def verify_token(secret: str, token: str) -> bool:
        """
        Verify a 6-digit TOTP *token* against *secret*.

        Accepts tokens from the current 30-second window plus one window on
        either side (±30 s) to tolerate minor clock skew between the server
        and the authenticator device.

        Returns True if valid, False otherwise.  Never raises.
        """
        if not secret or not token:
            return False
        try:
            totp = pyotp.TOTP(secret)
            # valid_window=1 allows ±1 time step (±30 s)
            return totp.verify(token.strip(), valid_window=1)
        except Exception as exc:  # noqa: BLE001
            logger.warning("TOTP verification error: %s", exc)
            return False

    # ------------------------------------------------------------------
    # Backup codes
    # ------------------------------------------------------------------

    @staticmethod
    def generate_backup_codes() -> list[str]:
        """
        Generate a list of 10 one-time backup codes.

        Each code is 10 characters of upper-case letters and digits, formatted
        as XXXXX-XXXXX for readability.  Store the raw codes (without the dash)
        in the database; display the formatted version to the user once.
        """
        codes: list[str] = []
        for _ in range(_BACKUP_CODE_COUNT):
            raw = "".join(secrets.choice(_BACKUP_CODE_CHARS) for _ in range(_BACKUP_CODE_LENGTH))
            codes.append(f"{raw[:5]}-{raw[5:]}")
        return codes

    @staticmethod
    def verify_backup_code(stored_codes_json: str, presented_code: str) -> tuple[bool, str]:
        """
        Check whether *presented_code* matches one of the stored backup codes.

        If it matches, the code is consumed (removed from the list) and the
        updated JSON string is returned so the caller can persist it.

        Returns:
          (True,  updated_json)  — code was valid and has been consumed
          (False, original_json) — code was not found; nothing changed
        """
        try:
            codes: list[str] = json.loads(stored_codes_json or "[]")
        except (json.JSONDecodeError, TypeError):
            codes = []

        # Normalise: strip whitespace and upper-case for comparison
        normalised = presented_code.strip().upper()
        for i, code in enumerate(codes):
            if secrets.compare_digest(code.upper(), normalised):
                codes.pop(i)
                updated_json = json.dumps(codes)
                logger.info("Backup code consumed; %d codes remaining", len(codes))
                return True, updated_json

        return False, stored_codes_json or "[]"
