/**
 * FRONTEND_NETLIFY_FUNCTION.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Server-side Netlify Function — thin auth-aware proxy to the FastAPI backend.
 *
 * DEPLOY LOCATION
 * ───────────────
 * Copy this file to:
 *   netlify/functions/get-token.ts
 *
 * Netlify will automatically deploy it as:
 *   POST /.netlify/functions/get-token
 *
 * REQUIRED NETLIFY ENVIRONMENT VARIABLES
 * ───────────────────────────────────────
 * Set these in Netlify UI → Site → Environment variables.
 * NEVER add a VITE_ prefix to any of these — they must stay server-side.
 *
 *   JWORDEN_MASTER_KEY          The long-lived master API key from the backend.
 *                               Same value as JWORDEN_MASTER_KEY on the FastAPI
 *                               backend.  Used by Option A (recommended).
 *
 *   VITE_API_BASE_URL           The FastAPI backend base URL.
 *                               e.g. https://api.jwordenasphaltpaving.com
 *                               Used by Option A.
 *
 *   JWT_SECRET_KEY              The HS256 signing secret used by the FastAPI
 *                               backend (app/core/security.py).  Must match
 *                               exactly.  Used by Option B only.
 *
 *   USE_BACKEND_TOKEN_ENDPOINT  Set to "true" to activate Option A (proxy to
 *                               FastAPI).  Omit or set to anything else to use
 *                               Option B (local JWT generation, default).
 *
 * HOW IT WORKS
 * ────────────
 * Option A — Proxy to FastAPI (recommended):
 *   The function calls POST /api/v1/auth/token on the FastAPI backend,
 *   passing JWORDEN_MASTER_KEY as a Bearer token.  The backend validates the
 *   key, signs a JWT (HS256, 24h), and returns it.  The function forwards
 *   only the JWT to the browser.  The master key never leaves the server.
 *
 *   Activate: set USE_BACKEND_TOKEN_ENDPOINT=true in Netlify env vars.
 *   Requires: JWORDEN_MASTER_KEY, VITE_API_BASE_URL
 *
 * Option B — Local JWT generation (default):
 *   The function generates the JWT itself using the `jose` library, signing
 *   it with JWT_SECRET_KEY.  The backend verifies it on every request using
 *   the same secret.  No round-trip to the backend during auth.
 *
 *   Activate: omit USE_BACKEND_TOKEN_ENDPOINT (or set it to anything but "true")
 *   Requires: JWT_SECRET_KEY
 *
 * INSTALL DEPENDENCIES
 * ────────────────────
 *   npm install jose                    # Option B JWT signing
 *   npm install --save-dev @netlify/functions
 *
 * NETLIFY.TOML
 * ────────────
 *   [functions]
 *     directory = "netlify/functions"
 *
 * SECURITY NOTES
 * ──────────────
 * • This function runs server-side only.  The browser never sees
 *   JWORDEN_MASTER_KEY or JWT_SECRET_KEY.
 * • The JWT it returns is short-lived (24 hours, matching the backend default).
 * • CORS origin validation restricts token issuance to your own domain.
 *   Update ALLOWED_ORIGINS to match your production and preview URLs.
 * • Add Netlify rate limiting or a WAF rule on this path if you need
 *   additional protection against token farming.
 *
 * LOCAL DEVELOPMENT
 * ─────────────────
 *   npm install -g netlify-cli
 *   netlify dev
 *
 *   # Test the function:
 *   curl -X POST http://localhost:8888/.netlify/functions/get-token
 *   # Expected: { "token": "eyJ...", "expires_at": 1234567890 }
 *
 *   # Verify the JWT against the backend:
 *   curl -H "Authorization: Bearer eyJ..." http://localhost:8000/api/v1/crm/leads
 */

import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { SignJWT } from "jose";

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Token lifetime in seconds — must match the backend's _TOKEN_EXPIRE_SECONDS
 * in app/routers/auth.py (currently 86400 = 24 hours).
 */
const TOKEN_TTL_SECONDS = 24 * 60 * 60; // 24 hours

/**
 * Origins allowed to call this function.
 *
 * Add your Netlify deploy preview pattern if needed:
 *   "https://deploy-preview-*--jworden.netlify.app"
 *
 * Must match the ALLOWED_ORIGINS list in app/main.py on the FastAPI backend.
 */
const ALLOWED_ORIGINS = [
  "https://jwordenasphaltpaving.com",
  "https://jworden.netlify.app",
  "http://localhost:5173", // Vite dev server
  "http://localhost:3000",
];

// ─────────────────────────────────────────────────────────────────────────────
// Option A — Proxy to FastAPI backend
//
// Calls POST /api/v1/auth/token on the FastAPI backend with the master key.
// The backend validates the key, signs a JWT, and returns it.
// This function forwards only the JWT to the browser.
//
// Backend contract (app/routers/auth.py):
//   POST /api/v1/auth/token
//   Authorization: Bearer <JWORDEN_MASTER_KEY>
//   → { access_token: string, token_type: "bearer", expires_in: 86400 }
//
// Activate: set USE_BACKEND_TOKEN_ENDPOINT=true in Netlify env vars.
// ─────────────────────────────────────────────────────────────────────────────

async function fetchTokenFromBackend(): Promise<{
  token: string;
  expires_at: number;
}> {
  const apiBase = process.env.VITE_API_BASE_URL;
  const masterKey = process.env.JWORDEN_MASTER_KEY;

  if (!apiBase) {
    throw new Error(
      "VITE_API_BASE_URL is not set. Add it to Netlify environment variables."
    );
  }
  if (!masterKey) {
    throw new Error(
      "JWORDEN_MASTER_KEY is not set. Add it to Netlify environment variables."
    );
  }

  // POST /api/v1/auth/token — exchange master key for JWT.
  // The backend (app/routers/auth.py) accepts the master key as a Bearer token
  // and returns a signed JWT valid for 24 hours.
  const res = await fetch(`${apiBase}/api/v1/auth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${masterKey}`,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(
      `Backend token endpoint returned ${res.status}: ${body.detail ?? res.statusText}`
    );
  }

  // Backend returns: { access_token, token_type, expires_in }
  // We normalise to { token, expires_at } for the browser client.
  const data = await res.json();
  const nowSeconds = Math.floor(Date.now() / 1000);
  return {
    token: data.access_token,
    expires_at: nowSeconds + (data.expires_in ?? TOKEN_TTL_SECONDS),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Option B — Generate JWT locally (default)
//
// Signs a JWT with JWT_SECRET_KEY using HS256, matching the algorithm and
// claims expected by app/core/security.py.
//
// JWT claims (must match what verify_premium_security() expects):
//   sub        — subject identifier (any string)
//   tenant_id  — "JWORDEN_HQ"
//   iat        — issued-at timestamp
//   exp        — expiry timestamp
//
// Activate: omit USE_BACKEND_TOKEN_ENDPOINT (default behaviour).
// ─────────────────────────────────────────────────────────────────────────────

async function generateTokenLocally(): Promise<{
  token: string;
  expires_at: number;
}> {
  const secret = process.env.JWT_SECRET_KEY;

  if (!secret) {
    throw new Error(
      "JWT_SECRET_KEY is not set. Add it to Netlify environment variables."
    );
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresAt = nowSeconds + TOKEN_TTL_SECONDS;

  // Encode the secret as a Uint8Array for jose.
  const secretBytes = new TextEncoder().encode(secret);

  const token = await new SignJWT({
    // Claims must match what app/core/security.py's verify_premium_security() expects.
    sub: "frontend-client",
    tenant_id: "JWORDEN_HQ",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(nowSeconds)
    .setExpirationTime(expiresAt)
    .sign(secretBytes);

  return { token, expires_at: expiresAt };
}

// ─────────────────────────────────────────────────────────────────────────────
// CORS helper
// ─────────────────────────────────────────────────────────────────────────────

function getCorsHeaders(
  requestOrigin: string | undefined
): Record<string, string> {
  // Reflect the request origin if it is in the allowlist; otherwise fall back
  // to the production origin.  This supports Netlify deploy previews if you
  // add their pattern to ALLOWED_ORIGINS.
  const origin =
    requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)
      ? requestOrigin
      : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    // Prevent the response from being cached by CDNs or shared caches.
    // Each browser tab must fetch its own token.
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

export const handler: Handler = async (
  event: HandlerEvent,
  _context: HandlerContext
) => {
  const corsHeaders = getCorsHeaders(event.headers["origin"]);

  // ── Preflight (CORS) ───────────────────────────────────────────────────────
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  // ── Method guard ───────────────────────────────────────────────────────────
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, Allow: "POST, OPTIONS" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  // ── Generate or proxy token ────────────────────────────────────────────────
  try {
    const useBackend =
      process.env.USE_BACKEND_TOKEN_ENDPOINT?.toLowerCase() === "true";

    const result = useBackend
      ? await fetchTokenFromBackend()   // Option A — proxy to FastAPI
      : await generateTokenLocally();   // Option B — local JWT generation

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(result),
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";

    // Log server-side (visible in Netlify function logs, not in the browser).
    console.error("[get-token] Error:", err);

    return {
      statusCode: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: message }),
    };
  }
};
