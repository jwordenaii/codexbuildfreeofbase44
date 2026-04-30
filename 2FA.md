# Two-Factor Authentication (TOTP) for the Admin Dashboard

This document covers setup, daily use, backup codes, and recovery procedures for the TOTP-based two-factor authentication (2FA) added to the JWordenAI admin dashboard.

---

## Overview

Admin 2FA uses the **TOTP** standard (RFC 6238) — the same algorithm used by Google Authenticator, Authy, 1Password, Bitwarden, and most other authenticator apps. A new 6-digit code is generated every 30 seconds from a shared secret stored in the database.

When 2FA is enabled, every admin request must include both:

1. **HTTP Basic credentials** — `ADMIN_USERNAME` / `ADMIN_PASSWORD` (unchanged)
2. **`X-TOTP-Token` header** — the current 6-digit code from your authenticator app

---

## Setup Instructions

### Step 1 — Initiate setup

```bash
curl -X POST https://your-backend.railway.app/api/v1/admin/2fa/setup \
     -u admin:YOUR_ADMIN_PASSWORD
```

The response contains:

| Field | Description |
|---|---|
| `secret` | Base32 TOTP seed — for manual entry in your authenticator app |
| `otpauth_url` | `otpauth://` URI — can be used to generate your own QR code |
| `qr_code_uri` | `data:image/png;base64,…` — embed in an `<img>` tag to display the QR code |
| `backup_codes` | 10 one-time recovery codes — **save these now, they will not be shown again** |

### Step 2 — Scan the QR code

Open your authenticator app and scan the QR code from the `qr_code_uri` field, or manually enter the `secret` value. The account will appear as **JWordenAI Admin** (or the value of the `TOTP_ISSUER` environment variable).

### Step 3 — Verify and activate

Confirm the setup by submitting the first 6-digit code from your app:

```bash
curl -X POST https://your-backend.railway.app/api/v1/admin/2fa/verify \
     -u admin:YOUR_ADMIN_PASSWORD \
     -H "Content-Type: application/json" \
     -d '{"token": "123456"}'
```

A `{"enabled": true}` response means 2FA is now active. All subsequent admin requests must include the `X-TOTP-Token` header.

---

## Logging In with 2FA Enabled

Add the `X-TOTP-Token` header to every admin request:

```bash
curl https://your-backend.railway.app/admin/dashboard \
     -u admin:YOUR_ADMIN_PASSWORD \
     -H "X-TOTP-Token: 123456"
```

The token is valid for the current 30-second window plus one window on either side (±30 s) to tolerate minor clock skew between your device and the server.

---

## Checking 2FA Status

```bash
curl https://your-backend.railway.app/api/v1/admin/2fa/status \
     -u admin:YOUR_ADMIN_PASSWORD \
     -H "X-TOTP-Token: 123456"
```

Response:

```json
{
  "enabled": true,
  "has_backup_codes": true,
  "backup_codes_remaining": 9
}
```

---

## Disabling 2FA

To turn off 2FA, supply your current password and a valid TOTP token (or backup code):

```bash
curl -X POST https://your-backend.railway.app/api/v1/admin/2fa/disable \
     -u admin:YOUR_ADMIN_PASSWORD \
     -H "X-TOTP-Token: 123456" \
     -H "Content-Type: application/json" \
     -d '{"password": "YOUR_ADMIN_PASSWORD", "token": "123456"}'
```

Both the `X-TOTP-Token` header (for the Basic-auth gate) and the `token` field in the body (for the disable confirmation) must be valid. This double-confirmation prevents accidental or unauthorised disablement.

---

## Backup Codes

Ten one-time backup codes are generated during setup. Each code is 10 characters formatted as `XXXXX-XXXXX`.

- **Store them securely** — in a password manager, printed and locked away, or in an encrypted note.
- Each code can only be used **once**. After use it is permanently removed from the database.
- Backup codes can be used in place of a TOTP token anywhere a token is accepted (login header, disable endpoint).
- To regenerate backup codes, call `POST /api/v1/admin/2fa/setup` again — this replaces the secret and issues a fresh set of 10 codes, and requires re-verification.

---

## Recovery Procedures

### Lost authenticator device (backup codes available)

Use a backup code in place of the TOTP token:

```bash
curl https://your-backend.railway.app/admin/dashboard \
     -u admin:YOUR_ADMIN_PASSWORD \
     -H "X-TOTP-Token: ABCDE-FGHIJ"
```

Then immediately re-run setup to generate a new secret and new backup codes.

### Lost authenticator device AND backup codes

If both the authenticator and all backup codes are lost, 2FA must be disabled directly in the database:

```sql
UPDATE two_factor_secrets
SET enabled = false
WHERE user_id = 'admin';
```

Run this via your Railway PostgreSQL console or any connected DB client. After disabling, log in normally and run setup again.

### Re-setup (new device or new app)

Call `POST /api/v1/admin/2fa/setup` with valid Basic credentials. This generates a new secret and invalidates the old one. Verify with `POST /api/v1/admin/2fa/verify` to re-activate.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `TOTP_ISSUER` | `JWordenAI Admin` | Label shown in the authenticator app |
| `ADMIN_USERNAME` | `admin` | Admin username for HTTP Basic auth |
| `ADMIN_PASSWORD` | *(required)* | Admin password for HTTP Basic auth |

No additional environment variables are required for 2FA. The TOTP secret is stored in the `two_factor_secrets` database table, which is created automatically when `AUTO_CREATE_TABLES=true`.

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/admin/2fa/setup` | Generate new TOTP secret + QR code |
| `POST` | `/api/v1/admin/2fa/verify` | Confirm first token to activate 2FA |
| `POST` | `/api/v1/admin/2fa/disable` | Disable 2FA (requires password + token) |
| `GET` | `/api/v1/admin/2fa/status` | Check if 2FA is enabled |

All endpoints require HTTP Basic authentication (`ADMIN_USERNAME` / `ADMIN_PASSWORD`). When 2FA is already enabled, the `X-TOTP-Token` header is also required on all endpoints except `/setup`.

---

## Security Notes

- TOTP secrets are stored in plaintext in the database. Ensure your database is not publicly accessible and that backups are encrypted.
- The `X-TOTP-Token` header is transmitted over HTTPS — never use 2FA over plain HTTP in production.
- Tokens are verified with a ±1 time-step tolerance (±30 s). Ensure your server clock is synchronised via NTP.
- Backup codes use `secrets.compare_digest` for constant-time comparison to prevent timing attacks.
