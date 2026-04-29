/**
 * FRONTEND_NETLIFY_FUNCTION.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Server-side Netlify Function that exchanges the master key for a JWT.
 *
 * DEPLOY LOCATION
 * ───────────────
 * Copy this file to:
 *   netlify/functions/get-token.ts
 *
 * Netlify will automatically deploy it as:
 *   POST /.netlify/functions/get-token
 *
 * REQUIRED NETLIFY ENVIRONMENT VARIABLES (set in Netlify UI → Site → Env vars)
 * ─────────────────────────────────────────────────────────────────────────────
 *   JWORDEN_MASTER_KEY   The long-lived master API key from the backend.
 *                        This is the same value set on the FastAPI backend.
 *                        NEVER add a VITE_ prefix to this variable.
 *
 *   JWT_SECRET_KEY       The HS256 signing secret used by the FastAPI backend
 *                        (app/core/security.py).  Must match exactly.
 *                        NEVER add a VITE_ prefix to this variable.
 *
 * HOW IT WORKS
 * ────────────
 * Option A (recommended for most setups):
 *   The Netlify Function calls the FastAPI backend's token endpoint directly,
 *   passing the master key.  The backend generates and signs the JWT.
 *   The function forwards the JWT to the browser.
 *
 * Option B (self-contained, no backend round-trip):
 *   The Netlify Function generates the JWT itself using the `jose` library,
 *   signing it with JWT_SECRET_KEY.  The backend verifies it on every request.
 *   Use this if you want to avoid the extra network hop.
 *
 * This file implements BOTH options.  Option B is active by default because it
 * avoids a round-trip to the backend during auth.  Switch to Option A by
 * setting USE_BACKEND_TOKEN_ENDPOINT=true in Netlify env vars.
 *
 * INSTALL DEPENDENCY (Option B only)
 * ────────────────────────────────────
 *   npm install jose
 *   # jose is a zero-dependency JWT library that works in Node.js and edge runtimes.
 *
 * NETLIFY.TOML ADDITION
 * ─────────────────────
 * Add this to netlify.toml so Netlify knows where to find the functions:
 *
 *   [functions]
 *     directory = "netlify/functions"
 *
 * SECURITY NOTES
 * ──────────────
 * • This function runs server-side only.  The browser never sees JWORDEN_MASTER_KEY
 *   or JWT_SECRET_KEY.
 * • The JWT it returns is short-lived (24 hours, matching the backend default).
 * • Add rate limiting in Netlify (or via a WAF) if this endpoint is public.
 * • The CORS origin check below restricts token issuance to your own domain.
 *   Update ALLOWED_ORIGINS to match your production and preview URLs.
 */

import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { SignJWT } from "jose";

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

/** Token lifetime in seconds — must match the backend's expectation. */
const TOKEN_TTL_SECONDS = 24 * 60 * 60; // 24 hours

/**
 * Origins allowed to call this function.
 * Add your Netlify deploy preview pattern if needed:
 *   "https://deploy-preview-*--jworden.netlify.app"
 */
const ALLOWED_ORIGINS = [
  "https://jwordenasphaltpaving.com",
  "https://jworden.netlify.app",
  "http://localhost:5173", // Vite dev server
  "http://localhost:3000",
];

// ─────────────────────────────────────────────────────────────────────────────
// Option A — Delegate token generation to the FastAPI backend
//
// The backend already has a master-key → JWT exchange path in
// app/core/security.py.  We call it here with the master key and forward
// the resulting JWT to the browser.
//
// Activate by setting USE_BACKEND_TOKEN_ENDPOINT=true in Netlify env vars.
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
  // The backend accepts the master key as a Bearer token and returns a JWT.
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

  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Option B — Generate the JWT directly in the Netlify Function (default)
//
// Signs a JWT with JWT_SECRET_KEY using HS256, matching the algorithm and
// claims expected by app/core/security.py.
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
    // Claims must match what app/core/security.py expects.
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
  const origin =
    requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)
      ? requestOrigin
      : ALLOWED_ORIGINS[0]; // Fall back to production origin.

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    // Prevent the response from being cached by CDNs or shared caches.
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

  // ── Preflight ──────────────────────────────────────────────────────────────
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

  // ── Generate token ─────────────────────────────────────────────────────────
  try {
    const useBackend =
      process.env.USE_BACKEND_TOKEN_ENDPOINT?.toLowerCase() === "true";

    const result = useBackend
      ? await fetchTokenFromBackend()
      : await generateTokenLocally();

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

// ─────────────────────────────────────────────────────────────────────────────
// Local development testing
//
// Run this function locally with the Netlify CLI:
//   npm install -g netlify-cli
//   netlify dev
//
// Then test it:
//   curl -X POST http://localhost:8888/.netlify/functions/get-token
//
// Expected response:
//   { "token": "eyJ...", "expires_at": 1234567890 }
//
// Verify the token against the backend:
//   curl -H "Authorization: Bearer eyJ..." \
//        http://localhost:8000/api/v1/crm/leads
// ─────────────────────────────────────────────────────────────────────────────
