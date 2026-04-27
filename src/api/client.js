/**
 * API client — reads VITE_API_BASE_URL at build time.
 * Falls back to relative paths so the frontend still works when
 * the backend is not yet deployed.
 *
 * All requests include a 10-second AbortController timeout so the UI
 * never hangs indefinitely on a slow/down backend.
 */

const BASE = import.meta.env.VITE_API_BASE_URL || ''
const DEFAULT_TIMEOUT_MS = 10_000
const MASTER_KEY = import.meta.env.VITE_MASTER_API_KEY || ''

async function request(method, path, body) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  const headers = { 'Content-Type': 'application/json' }
  if (MASTER_KEY) headers.Authorization = `Bearer ${MASTER_KEY}`

  const opts = {
    method,
    headers,
    signal: controller.signal,
  }
  if (body) opts.body = JSON.stringify(body)

  try {
    const res = await fetch(`${BASE}${path}`, opts)
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail || `HTTP ${res.status}`)
    }
    return res.json()
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.')
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

/** Build a query string from an object, omitting null/undefined/empty values. */
function buildQS(params) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))
  ).toString()
  return qs ? `?${qs}` : ''
}

export const api = {
  submitQuote:    (data) => request('POST', '/api/v1/leads/quote',   data),
  submitContact:  (data) => request('POST', '/api/v1/leads/contact', data),
  getReviews:     ()     => request('GET',  '/api/v1/reviews'),
  getSchema:      ()     => request('GET',  '/api/v1/schema/local-business'),
  askAI:          (data) => request('POST', '/api/v1/ai/chat',       data),
  // Content blocks managed via the admin Webpage Maker.
  // The frontend uses these as optional overrides — hardcoded defaults remain
  // in place if a block is missing (graceful degradation).
  getContent:     ()     => request('GET',  '/api/v1/content'),
  getContentBlock:(key)  => request('GET',  `/api/v1/content/${key}`),
  // ── Geospatial ─────────────────────────────────────────────────────────────
  getSites:       ()     => request('GET',  '/api/v1/geo/sites'),
  createSite:     (data) => request('POST', '/api/v1/geo/sites',     data),
  updateSite:     (id, data) => request('PUT', `/api/v1/geo/sites/${id}`, data),
  getPermitLeads: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return request('GET', `/api/v1/geo/permit-leads${q ? '?' + q : ''}`)
  },
  triggerScrape:  (maxPages = 5) => request('POST', `/api/v1/geo/permit-leads/scrape?max_pages=${maxPages}`),
  radiusQuery:    (lat, lng, miles = 20) => request('GET', `/api/v1/geo/radius-query?lat=${lat}&lng=${lng}&radius_miles=${miles}`),
  getTrucks:      ()     => request('GET',  '/api/v1/geo/trucks'),
  pingTruck:      (id, data) => request('POST', `/api/v1/geo/trucks/${id}`, data),
  // ── Virtual Foreman ────────────────────────────────────────────────────────
  askForeman:     (data) => request('POST', '/api/v1/foreman/chat',  data),
  getForemanStatus: ()   => request('GET',  '/api/v1/foreman/status'),
  getVisionResult: (jobId) => request('GET', `/api/v1/ai/vision-result/${jobId}`),
}

// ── GA4 event helpers ─────────────────────────────────────────────────────────
export function trackEvent(eventName, params = {}) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params)
  }
}

export function trackPageView(path, title) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', {
      page_path: path,
      page_title: title,
    })
  }
}
