/**
 * FRONTEND_AUTH_CLIENT.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Framework-agnostic TypeScript auth client for the J. Worden & Sons backend.
 *
 * DEPLOY LOCATION
 * ───────────────
 * Copy this file to:
 *   src/lib/auth.ts
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
 * 6. Concurrent refresh calls are deduplicated — only one in-flight request
 *    is made at a time via a promise cache.
 *
 * ENVIRONMENT VARIABLES (Netlify / Vite)
 * ───────────────────────────────────────
 *   VITE_API_BASE_URL           ✅ safe — public backend URL
 *                                  e.g. https://api.jwordenasphaltpaving.com
 *   VITE_SITE_URL               ✅ safe — public site URL
 *   VITE_GA4_ID                 ✅ safe — Google Analytics measurement ID
 *   VITE_GOOGLE_MAPS_API_KEY    ✅ safe — restrict to your domain in GCP console
 *   VITE_STRIPE_PUBLISHABLE_KEY ✅ safe — publishable key only
 *
 *   JWORDEN_MASTER_KEY          ❌ NEVER expose — Netlify server-side env only
 *   JWT_SECRET_KEY              ❌ NEVER expose — backend env only
 *   VITE_MASTER_API_KEY         ❌ NEVER create — any VITE_ var is bundled
 *                                  into browser JS and visible to anyone
 *
 * BACKEND AUTH CONTRACT
 * ─────────────────────
 * The backend (app/core/security.py) accepts two auth methods:
 *   1. Bearer <JWORDEN_MASTER_KEY>  — long-lived, internal tools only
 *   2. Bearer <JWT>                 — signed with JWT_SECRET_KEY, HS256, 24h TTL
 *
 * The token endpoint used here is a Netlify Function, NOT the FastAPI backend
 * directly.  The Netlify Function calls POST /api/v1/auth/token on the backend
 * and forwards the resulting JWT to the browser.
 * See FRONTEND_NETLIFY_FUNCTION.ts for the server-side half.
 *
 * DEPENDENCIES
 * ────────────
 * None — this file uses only the browser Fetch API and standard TypeScript.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TokenResponse {
  /** Signed JWT to use as a Bearer token on all protected API calls. */
  token: string;
  /** Unix timestamp (seconds) when the token expires. */
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
 * calls POST /api/v1/auth/token on the FastAPI backend, and returns the JWT.
 * The master key is never sent to or from the browser.
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
 *
 * @example
 * // In your React app root (e.g. main.tsx or AuthProvider):
 * await initAuth()
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
 * This is the primary way to get a token for manual use outside of apiFetch.
 *
 * @throws {Error} if no token is available after a refresh attempt.
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
//   • Injects the Authorization: Bearer <token> header automatically
//   • Handles 401/403 by refreshing the token and retrying once
//   • Enforces a configurable timeout via AbortController
//   • Throws a typed AuthError on permanent auth failures
//   • Throws a plain Error with the backend's `detail` message on other failures
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = (
  typeof import.meta !== "undefined" ? import.meta.env?.VITE_API_BASE_URL : ""
) ?? "";

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Thrown when a protected endpoint returns 401/403 after a token refresh retry.
 * Catch this specifically to show an auth error UI.
 */
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
   * refresh loops.  Do not set this manually.
   */
  _isRetry?: boolean;
}

/**
 * Authenticated fetch wrapper.
 *
 * Automatically injects `Authorization: Bearer <token>`, handles token
 * refresh on 401/403, and enforces a request timeout.
 *
 * @param path  API path, e.g. "/api/v1/crm/leads"
 * @param opts  Standard RequestInit options plus optional timeoutMs
 * @returns     Parsed JSON response body typed as T
 * @throws      {AuthError} on 401/403 after retry
 * @throws      {Error} on network failure, timeout, or other HTTP errors
 *
 * @example
 * const data = await apiFetch<CrmLeadsResponse>("/api/v1/crm/leads");
 * const lead = await apiFetch("/api/v1/crm/leads/1/stage", {
 *   method: "PATCH",
 *   body: JSON.stringify({ pipeline_stage: "contacted" }),
 * });
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
// Typed API helpers
//
// These wrap apiFetch with the exact request/response shapes from the real
// backend routers (app/routers/crm.py, leads.py, analytics.py, etc.).
// Add more as needed — the pattern is always the same.
// ─────────────────────────────────────────────────────────────────────────────

// ── CRM types (app/routers/crm.py) ───────────────────────────────────────────

export type PipelineStage =
  | "new"
  | "contacted"
  | "proposal_sent"
  | "negotiating"
  | "won"
  | "lost";

export type ScoreLabel = "HOT" | "WARM" | "COOL";

export interface CrmLead {
  id: number;
  name: string;
  email: string;
  phone: string;
  service_type: string;
  urgency: string;
  score_label: ScoreLabel | null;
  pipeline_stage: PipelineStage;
  contacted_at: string | null;      // ISO 8601
  proposal_sent_at: string | null;  // ISO 8601
  closed_at: string | null;         // ISO 8601
  closed_reason: string | null;
  created_at: string;               // ISO 8601
}

export interface CrmLeadsResponse {
  total: number;
  offset: number;
  limit: number;
  leads: CrmLead[];
}

export interface FunnelRow {
  stage: PipelineStage;
  count: number;
}

export interface FunnelResponse {
  funnel: FunnelRow[];
  total: number;
  won: number;
  win_rate_pct: number;
}

export interface StageUpdateResponse {
  id: number;
  pipeline_stage: PipelineStage;
  status: "updated";
}

// ── Analytics types (app/routers/analytics.py) ────────────────────────────────

export interface MonthlyVolumeEntry {
  month: string; // "YYYY-MM"
  total: number;
  hot: number;
}

export interface MonthlyVolumeResponse {
  monthly_volume: MonthlyVolumeEntry[];
}

// ── KPI Wall types (app/routers/kpi_wall.py) ──────────────────────────────────

export type KpiStatus = "green" | "yellow" | "red" | "gray";

export interface KpiMetric {
  label: string;
  value: number | null;
  unit: string;
  target: number;
  status: KpiStatus;
  [key: string]: unknown; // additional fields vary by KPI
}

export interface KpiWallResponse {
  generated_at: string; // ISO 8601
  kpis: {
    bid_win_rate: KpiMetric;
    on_time_delivery: KpiMetric;
    safety_trir: KpiMetric;
    projected_cash: KpiMetric;
    cert_current_pct: KpiMetric;
    client_nps: KpiMetric;
  };
  monthly_lead_trend: Array<{ month: string; count: number }>;
}

// ── Leads types (app/routers/leads.py) ────────────────────────────────────────

export type ServiceType =
  | "paving"
  | "sealcoating"
  | "crackfill"
  | "parking_lot"
  | "driveway";

export type PropertyType = "residential" | "commercial";

export type Urgency =
  | "asap"
  | "within_1_week"
  | "within_1_month"
  | "flexible";

export interface QuoteRequest {
  name: string;
  email: string;
  phone: string;
  service_type: ServiceType;
  property_type: PropertyType;
  urgency: Urgency;
  project_size_sqft?: number;
  address?: string;
  message?: string;
}

export interface QuoteResponse {
  status: "received";
  message: string;
  lead_score: ScoreLabel;
  priority: number;
  follow_up_sla: string;
}

export interface EstimateRequest {
  service_type: ServiceType;
  property_type: PropertyType;
  project_size_sqft: number;
}

export interface EstimateResponse {
  estimate_available: boolean;
  reason?: string;
  service_type?: string;
  low_usd?: number;
  high_usd?: number;
  unit?: string;
}

// ── Proposals types (app/routers/proposals.py) ────────────────────────────────

export interface ProposalResponse {
  proposal_id: number;
  lead_id: number;
  lead_name: string;
  proposal_text: string;
  pdf_b64?: string;
  pdf_base64?: string;
  pdf_size_bytes?: number;
}

// ── Payments types (app/routers/payments.py) ──────────────────────────────────

export interface CheckoutSessionResponse {
  payment_id: number;
  lead_id: number;
  amount_usd: number;
  checkout_session_id: string;
  checkout_url: string;
  status: "pending" | "paid" | "failed";
}

export interface PaymentStatusResponse {
  lead_id: number;
  has_payment: boolean;
  status: "pending" | "paid" | "failed" | "none";
  amount_usd: number | null;
  paid_at: string | null; // ISO 8601
}

// ── Follow-ups types (app/routers/follow_ups.py) ──────────────────────────────

export interface FollowUpTask {
  id: number;
  lead_id: number;
  task_type: "hot_1h" | "warm_3d" | "cool_7d";
  scheduled_at: string; // ISO 8601
  sent_at: string | null;
  status: "pending" | "sent" | "cancelled";
  created_at: string;
}

export interface FollowUpsResponse {
  total: number;
  tasks: FollowUpTask[];
}

// ── Customer types (app/routers/customers.py) ─────────────────────────────────

export interface Customer {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  state_code: string | null;
  city: string | null;
  customer_type: string | null;
  is_franchise: 0 | 1;
  brand: string | null;
  total_jobs: number;
  total_revenue: number;
  ltv_score: number | null;
  churn_risk: string | null;
  created_at: string;
}

export interface CustomersResponse {
  total: number;
  offset: number;
  limit: number;
  items: Customer[];
}

export interface CustomerStatsResponse {
  total_customers: number;
  franchise_accounts: number;
  states_represented: number;
  total_jobs_on_record: number;
  total_revenue_on_record: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// CRM helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/crm/leads
 *
 * List leads with optional pipeline stage and score label filters.
 *
 * @example
 * const { leads, total } = await getCrmLeads({ pipeline_stage: "new", limit: 20 })
 */
export async function getCrmLeads(params?: {
  pipeline_stage?: PipelineStage;
  score_label?: ScoreLabel;
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

/**
 * PATCH /api/v1/crm/leads/{lead_id}/stage
 *
 * Move a lead to a new pipeline stage.  Automatically sets stage timestamps.
 * For "won" or "lost" stages, pass a closed_reason.
 *
 * @example
 * await updateLeadStage(42, "contacted")
 * await updateLeadStage(42, "won", "Signed contract")
 */
export async function updateLeadStage(
  leadId: number,
  pipeline_stage: PipelineStage,
  closed_reason?: string
): Promise<StageUpdateResponse> {
  return apiFetch<StageUpdateResponse>(`/api/v1/crm/leads/${leadId}/stage`, {
    method: "PATCH",
    body: JSON.stringify({ pipeline_stage, closed_reason }),
  });
}

/**
 * GET /api/v1/crm/funnel
 *
 * Aggregate lead counts by pipeline stage for funnel visualization.
 *
 * @example
 * const { funnel, win_rate_pct } = await getCrmFunnel()
 */
export async function getCrmFunnel(): Promise<FunnelResponse> {
  return apiFetch<FunnelResponse>("/api/v1/crm/funnel");
}

// ─────────────────────────────────────────────────────────────────────────────
// Analytics helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/analytics/dashboard
 *
 * Full BI dashboard — all metrics in a single payload.
 */
export async function getAnalyticsDashboard(): Promise<unknown> {
  return apiFetch("/api/v1/analytics/dashboard");
}

/**
 * GET /api/v1/analytics/monthly-volume
 *
 * Monthly lead counts and HOT lead breakdown for the last 12 months.
 */
export async function getMonthlyVolume(): Promise<MonthlyVolumeResponse> {
  return apiFetch<MonthlyVolumeResponse>("/api/v1/analytics/monthly-volume");
}

/**
 * GET /api/v1/analytics/revenue-forecast
 *
 * Revenue projection from HOT leads × win rate × average job value.
 */
export async function getRevenueForecast(): Promise<unknown> {
  return apiFetch("/api/v1/analytics/revenue-forecast");
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI Wall helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/kpi-wall
 *
 * Aggregate KPIs from all modules.
 *
 * @example
 * const { kpis, monthly_lead_trend } = await getKpiWall()
 * console.log(kpis.bid_win_rate.value, kpis.bid_win_rate.status)
 */
export async function getKpiWall(): Promise<KpiWallResponse> {
  return apiFetch<KpiWallResponse>("/api/v1/kpi-wall");
}

// ─────────────────────────────────────────────────────────────────────────────
// Public leads helpers (no auth required)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/leads/quote  (public — no auth required)
 *
 * Submit a customer quote request.  Triggers lead scoring, DB persistence,
 * email notification, and automatic follow-up scheduling.
 *
 * @example
 * const result = await submitQuote({
 *   name: "John Smith",
 *   email: "john@example.com",
 *   phone: "555-867-5309",
 *   service_type: "paving",
 *   property_type: "commercial",
 *   urgency: "within_1_week",
 *   project_size_sqft: 5000,
 * })
 * console.log(result.lead_score) // "HOT" | "WARM" | "COOL"
 */
export async function submitQuote(req: QuoteRequest): Promise<QuoteResponse> {
  const res = await fetch(
    `${API_BASE}/api/v1/leads/quote`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail ?? `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * POST /api/v1/leads/estimate  (public — no auth required)
 *
 * Get a ballpark price estimate without submitting a lead.
 *
 * @example
 * const est = await getEstimate({ service_type: "sealcoating", property_type: "residential", project_size_sqft: 2000 })
 * if (est.estimate_available) {
 *   console.log(`$${est.low_usd} – $${est.high_usd}`)
 * }
 */
export async function getEstimate(
  req: EstimateRequest
): Promise<EstimateResponse> {
  const res = await fetch(
    `${API_BASE}/api/v1/leads/estimate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Proposals helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/proposals/generate
 *
 * Generate a text + PDF proposal for a lead.
 *
 * @example
 * const proposal = await generateProposal(42)
 * // Decode PDF: atob(proposal.pdf_b64)
 */
export async function generateProposal(
  leadId: number,
  includePdf = true
): Promise<ProposalResponse> {
  return apiFetch<ProposalResponse>("/api/v1/proposals/generate", {
    method: "POST",
    body: JSON.stringify({ lead_id: leadId, include_pdf: includePdf }),
  });
}

/**
 * POST /api/v1/proposals/{lead_id}/send
 *
 * Generate and email a proposal to the lead (background task).
 */
export async function sendProposal(
  leadId: number
): Promise<{ status: string; message: string; lead_id: number; lead_name: string }> {
  return apiFetch(`/api/v1/proposals/${leadId}/send`, { method: "POST" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Payments helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/payments/checkout-session
 *
 * Create a Stripe checkout session for a lead deposit (20% of low estimate).
 *
 * @example
 * const session = await createCheckoutSession(42)
 * window.location.href = session.checkout_url
 */
export async function createCheckoutSession(
  leadId: number,
  successUrl?: string,
  cancelUrl?: string
): Promise<CheckoutSessionResponse> {
  return apiFetch<CheckoutSessionResponse>("/api/v1/payments/checkout-session", {
    method: "POST",
    body: JSON.stringify({
      lead_id: leadId,
      success_url: successUrl,
      cancel_url: cancelUrl,
    }),
  });
}

/**
 * GET /api/v1/payments/status/{lead_id}
 *
 * Get the latest payment status for a lead.
 */
export async function getPaymentStatus(
  leadId: number
): Promise<PaymentStatusResponse> {
  return apiFetch<PaymentStatusResponse>(`/api/v1/payments/status/${leadId}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Follow-ups helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/followups
 *
 * List follow-up tasks with optional filters.
 */
export async function getFollowUps(params?: {
  status?: "pending" | "sent" | "cancelled";
  lead_id?: number;
  task_type?: string;
  limit?: number;
  offset?: number;
}): Promise<FollowUpsResponse> {
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
  return apiFetch<FollowUpsResponse>(`/api/v1/followups${qs}`);
}

/**
 * POST /api/v1/followups/{task_id}/cancel
 *
 * Cancel a pending follow-up task.
 */
export async function cancelFollowUp(
  taskId: number
): Promise<{ id: number; status: "cancelled" }> {
  return apiFetch(`/api/v1/followups/${taskId}/cancel`, { method: "POST" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Customers helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/customers
 *
 * List customers with optional filters.
 */
export async function getCustomers(params?: {
  state_code?: string;
  customer_type?: string;
  is_franchise?: 0 | 1;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<CustomersResponse> {
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
  return apiFetch<CustomersResponse>(`/api/v1/customers${qs}`);
}

/**
 * GET /api/v1/customers/stats/overview
 *
 * Overall CRM statistics.
 */
export async function getCustomerStats(): Promise<CustomerStatsResponse> {
  return apiFetch<CustomerStatsResponse>("/api/v1/customers/stats/overview");
}

/**
 * GET /api/v1/customers/{id}/history
 *
 * Service history for a specific customer.
 */
export async function getCustomerHistory(customerId: number): Promise<unknown> {
  return apiFetch(`/api/v1/customers/${customerId}/history`);
}
