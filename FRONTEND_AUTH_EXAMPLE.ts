/**
 * FRONTEND_AUTH_EXAMPLE.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Complete, copy-paste-ready auth system for the J. Worden & Sons frontend.
 *
 * HOW IT WORKS
 * ────────────
 * 1. The browser calls a Netlify Function (server-side) to exchange the master
 *    key for a short-lived JWT.  The master key NEVER touches the browser.
 * 2. The JWT is stored in a plain JS module-level variable (in-memory only).
 *    It is NOT written to localStorage, sessionStorage, or a cookie.
 * 3. Every protected API call goes through `apiFetch`, which injects the
 *    Authorization header automatically.
 * 4. On a 401/403 response, `apiFetch` attempts one token refresh then retries.
 * 5. A proactive refresh fires 5 minutes before the token expires so users
 *    never hit an expired-token error mid-session.
 *
 * ENVIRONMENT VARIABLES (Netlify / Vite)
 * ───────────────────────────────────────
 *   VITE_API_BASE_URL          ✅ safe — public backend URL, e.g. https://api.jwordenasphaltpaving.com
 *   VITE_SITE_URL              ✅ safe — public site URL
 *   VITE_GA4_ID                ✅ safe — Google Analytics measurement ID
 *   VITE_GOOGLE_MAPS_API_KEY   ✅ safe — restricted to your domain in GCP console
 *   VITE_STRIPE_PUBLISHABLE_KEY ✅ safe — publishable key only
 *
 *   JWORDEN_MASTER_KEY         ❌ NEVER expose — server-side Netlify env only
 *   JWT_SECRET_KEY             ❌ NEVER expose — backend env only
 *   VITE_MASTER_API_KEY        ❌ NEVER create this — any VITE_ var is bundled
 *                                 into the browser JS and visible to anyone
 *
 * BACKEND CONTRACT
 * ────────────────
 * The backend (app/core/security.py) accepts two auth methods:
 *   1. Bearer <JWORDEN_MASTER_KEY>  — long-lived, internal tools only
 *   2. Bearer <JWT>                 — signed with JWT_SECRET_KEY, HS256, 24 h TTL
 *
 * The token endpoint used here is a Netlify Function, NOT the FastAPI backend
 * directly.  See FRONTEND_NETLIFY_FUNCTION.ts for the server-side half.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface TokenResponse {
  token: string;
  /** Unix timestamp (seconds) when the token expires */
  expires_at: number;
}

interface AuthState {
  token: string | null;
  expiresAt: number | null; // Unix timestamp in seconds
}

// ─────────────────────────────────────────────────────────────────────────────
// In-memory token store
//
// Module-level variables survive for the lifetime of the JS module (i.e. the
// browser tab session).  They are wiped on page reload — which is intentional.
// Never persist a JWT to localStorage or a cookie without HttpOnly + Secure
// flags, because XSS can steal it.
// ─────────────────────────────────────────────────────────────────────────────

let _auth: AuthState = {
  token: null,
  expiresAt: null,
};

/** How many seconds before expiry to proactively refresh (5 minutes). */
const REFRESH_BUFFER_SECONDS = 5 * 60;

/** Singleton refresh timer handle so we never schedule two at once. */
let _refreshTimer: ReturnType<typeof setTimeout> | null = null;

// ─────────────────────────────────────────────────────────────────────────────
// Token lifecycle
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch a fresh JWT from the Netlify Function.
 *
 * The Netlify Function reads JWORDEN_MASTER_KEY from its own environment,
 * generates a signed JWT, and returns it.  The master key is never sent to
 * or from the browser.
 *
 * @throws {Error} if the token endpoint returns a non-2xx status.
 */
async function fetchToken(): Promise<TokenResponse> {
  // /.netlify/functions/get-token is the Netlify Function defined in
  // FRONTEND_NETLIFY_FUNCTION.ts (deployed to netlify/functions/get-token.ts).
  const res = await fetch("/.netlify/functions/get-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(
      `Token fetch failed (${res.status}): ${body.error ?? res.statusText}`
    );
  }

  return res.json() as Promise<TokenResponse>;
}

/**
 * Store a token in memory and schedule a proactive refresh before it expires.
 */
function _storeToken(tokenResponse: TokenResponse): void {
  _auth = {
    token: tokenResponse.token,
    expiresAt: tokenResponse.expires_at,
  };

  // Cancel any existing refresh timer.
  if (_refreshTimer !== null) {
    clearTimeout(_refreshTimer);
    _refreshTimer = null;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const secondsUntilExpiry = tokenResponse.expires_at - nowSeconds;
  const refreshInSeconds = Math.max(
    0,
    secondsUntilExpiry - REFRESH_BUFFER_SECONDS
  );

  if (refreshInSeconds > 0) {
    _refreshTimer = setTimeout(async () => {
      try {
        await refreshToken();
      } catch (err) {
        // Proactive refresh failed — the next apiFetch call will retry.
        console.warn("[auth] Proactive token refresh failed:", err);
      }
    }, refreshInSeconds * 1000);
  }
}

/**
 * Returns true if the stored token is present and not within the refresh
 * buffer window (i.e. still valid for at least REFRESH_BUFFER_SECONDS).
 */
function isTokenValid(): boolean {
  if (!_auth.token || !_auth.expiresAt) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return _auth.expiresAt - nowSeconds > REFRESH_BUFFER_SECONDS;
}

/**
 * Fetch and store a new token.  Call this once on app startup (e.g. inside
 * your root component or auth context provider).
 */
export async function initAuth(): Promise<void> {
  const tokenResponse = await fetchToken();
  _storeToken(tokenResponse);
}

/**
 * Force-refresh the token.  Called automatically by the proactive timer and
 * by apiFetch on 401/403.  Safe to call concurrently — only one in-flight
 * request is made at a time via the promise cache below.
 */
let _refreshPromise: Promise<void> | null = null;

export async function refreshToken(): Promise<void> {
  // Deduplicate concurrent refresh calls (e.g. multiple parallel requests all
  // hitting 401 at the same time).
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = fetchToken()
    .then((tokenResponse) => {
      _storeToken(tokenResponse);
    })
    .finally(() => {
      _refreshPromise = null;
    });

  return _refreshPromise;
}

/**
 * Return the current in-memory token, refreshing first if needed.
 * This is the primary way to get a token for manual use.
 */
export async function getToken(): Promise<string> {
  if (!isTokenValid()) {
    await refreshToken();
  }
  if (!_auth.token) {
    throw new Error("[auth] No token available after refresh attempt.");
  }
  return _auth.token;
}

// ─────────────────────────────────────────────────────────────────────────────
// apiFetch — authenticated fetch wrapper
//
// Drop-in replacement for fetch() that:
//   • Injects the Authorization: Bearer <token> header
//   • Handles 401/403 by refreshing the token and retrying once
//   • Enforces a configurable timeout via AbortController
//   • Throws a typed AuthError on permanent auth failures
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const DEFAULT_TIMEOUT_MS = 15_000;

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export interface ApiFetchOptions extends RequestInit {
  /** Override the default 15-second timeout. */
  timeoutMs?: number;
  /**
   * Internal flag — set to true on the retry attempt to prevent infinite
   * refresh loops.
   */
  _isRetry?: boolean;
}

/**
 * Authenticated fetch wrapper.
 *
 * Usage:
 *   const data = await apiFetch<Lead[]>("/api/v1/crm/leads");
 *   const lead = await apiFetch<Lead>("/api/v1/crm/leads/1", { method: "PATCH", body: JSON.stringify({...}) });
 *
 * @param path  API path, e.g. "/api/v1/crm/leads"
 * @param opts  Standard RequestInit options plus optional timeoutMs
 * @returns     Parsed JSON response body
 * @throws      AuthError on 401/403 after retry
 * @throws      Error on network failure or timeout
 */
export async function apiFetch<T = unknown>(
  path: string,
  opts: ApiFetchOptions = {}
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, _isRetry = false, ...fetchOpts } = opts;

  // Ensure we have a valid token before making the request.
  if (!isTokenValid()) {
    await refreshToken();
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const headers = new Headers(fetchOpts.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${_auth.token}`);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...fetchOpts,
      headers,
      signal: controller.signal,
    });

    // ── Auth failure → refresh and retry once ──────────────────────────────
    if ((res.status === 401 || res.status === 403) && !_isRetry) {
      await refreshToken();
      return apiFetch<T>(path, { ...opts, _isRetry: true });
    }

    // ── Permanent auth failure ─────────────────────────────────────────────
    if (res.status === 401 || res.status === 403) {
      const body = await res.json().catch(() => ({ detail: res.statusText }));
      throw new AuthError(
        body.detail ?? `Unauthorized (${res.status})`,
        res.status
      );
    }

    // ── Other HTTP errors ──────────────────────────────────────────────────
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(body.detail ?? `HTTP ${res.status}`);
    }

    return res.json() as Promise<T>;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms: ${path}`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Typed API helpers — add more as needed
//
// These mirror the endpoints in src/api/client.js but use apiFetch so every
// call is automatically authenticated.
// ─────────────────────────────────────────────────────────────────────────────

export interface CrmLead {
  id: number;
  name: string;
  email: string;
  phone: string;
  service_type: string;
  urgency: string;
  score_label: "HOT" | "WARM" | "COOL" | null;
  pipeline_stage: "new" | "contacted" | "proposal_sent" | "negotiating" | "won" | "lost";
  contacted_at: string | null;
  proposal_sent_at: string | null;
  closed_at: string | null;
  closed_reason: string | null;
  created_at: string;
}

export interface CrmLeadsResponse {
  total: number;
  offset: number;
  limit: number;
  leads: CrmLead[];
}

export interface FunnelRow {
  stage: string;
  count: number;
}

export interface FunnelResponse {
  funnel: FunnelRow[];
  total: number;
  won: number;
  win_rate_pct: number;
}

/** GET /api/v1/crm/leads */
export async function getCrmLeads(params?: {
  pipeline_stage?: string;
  score_label?: string;
  limit?: number;
  offset?: number;
}): Promise<CrmLeadsResponse> {
  const qs = params
    ? "?" +
      new URLSearchParams(
        Object.fromEntries(
          Object.entries(params).filter(
            ([, v]) => v !== undefined && v !== null && v !== ""
          ) as [string, string][]
        )
      ).toString()
    : "";
  return apiFetch<CrmLeadsResponse>(`/api/v1/crm/leads${qs}`);
}

/** PATCH /api/v1/crm/leads/:id/stage */
export async function updateLeadStage(
  leadId: number,
  pipeline_stage: string,
  closed_reason?: string
): Promise<{ id: number; pipeline_stage: string; status: string }> {
  return apiFetch(`/api/v1/crm/leads/${leadId}/stage`, {
    method: "PATCH",
    body: JSON.stringify({ pipeline_stage, closed_reason }),
  });
}

/** GET /api/v1/crm/funnel */
export async function getCrmFunnel(): Promise<FunnelResponse> {
  return apiFetch<FunnelResponse>("/api/v1/crm/funnel");
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick-start usage example (not exported — for documentation only)
// ─────────────────────────────────────────────────────────────────────────────

/*
// In your React app root (e.g. main.tsx or App.tsx):

import { initAuth } from './FRONTEND_AUTH_EXAMPLE'

// Call once before rendering protected routes.
await initAuth()

// Then anywhere in your app:
import { getCrmLeads, updateLeadStage } from './FRONTEND_AUTH_EXAMPLE'

const { leads } = await getCrmLeads({ pipeline_stage: 'new' })
await updateLeadStage(leads[0].id, 'contacted')
*/
