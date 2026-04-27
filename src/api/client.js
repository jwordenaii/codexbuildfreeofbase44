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

  // ── Analytics (Feature 10) ─────────────────────────────────────────
  getAnalyticsDashboard: () => request('GET', '/api/v1/analytics/dashboard'),
  getAnalyticsFunnel:    () => request('GET', '/api/v1/analytics/funnel'),
  getRevenueForecast:    () => request('GET', '/api/v1/analytics/revenue-forecast'),
  getMonthlyVolume:      () => request('GET', '/api/v1/analytics/monthly-volume'),

  // ── CRM Pipeline (Feature 3) ───────────────────────────────────────
  getCRMLeads:    (params = {}) => request('GET', `/api/v1/crm/leads${buildQS(params)}`),
  updateLeadStage: (leadId, stage, closedReason) =>
    request('PATCH', `/api/v1/crm/leads/${leadId}/stage`, { pipeline_stage: stage, closed_reason: closedReason }),
  getCRMFunnel:   () => request('GET', '/api/v1/crm/funnel'),

  // ── Weather (Feature 8) ────────────────────────────────────────────
  getPavingForecast: (address) => request('POST', '/api/v1/weather/paving-forecast', { address }),
  getStateWeatherRisk: (stateCode) => request('GET', `/api/v1/weather/risk/${stateCode}`),

  // ── Material Prices (Feature 7) ────────────────────────────────────
  getMaterialPrices: () => request('GET', '/api/v1/materials/price-index'),

  // ── Lien Calendar (Feature 12) ─────────────────────────────────────
  calculateLienDeadlines: (data) => request('POST', '/api/v1/liens/calculate', data),
  trackLienProject:       (data) => request('POST', '/api/v1/liens/track',     data),
  getUpcomingLiens:       (daysAhead = 30) => request('GET', `/api/v1/liens/upcoming?days_ahead=${daysAhead}`),
  getLienEntries:         () => request('GET', '/api/v1/liens/entries'),

  // ── Subcontractors (Feature 14) ────────────────────────────────────
  getSubcontractors:    () => request('GET',  '/api/v1/subcontractors'),
  getExpiringCerts:     (daysAhead = 30) => request('GET', `/api/v1/subcontractors/expiring?days_ahead=${daysAhead}`),
  addSubcontractor:     (data) => request('POST',   '/api/v1/subcontractors',     data),
  updateSubcontractor:  (id, data) => request('PUT', `/api/v1/subcontractors/${id}`, data),

  // ── Market Intelligence (Feature 13) ───────────────────────────────
  getCompetitors:     (location, service = 'asphalt paving') =>
    request('GET', `/api/v1/market/competitors?location=${encodeURIComponent(location)}&service=${encodeURIComponent(service)}`),
  getMarketSignals:   (stateCode) => request('GET', `/api/v1/market/signals/${stateCode}`),
  getSeasonalDemand:  (stateCode) => request('GET', `/api/v1/market/seasonal/${stateCode}`),

  // ── Proposals (Feature 1) ──────────────────────────────────────────
  generateProposal: (leadId) => request('POST', `/api/v1/proposals/generate`, { lead_id: leadId }),
  sendProposal:     (proposalId) => request('POST', `/api/v1/proposals/${proposalId}/send`),


  // ── Payments (Stripe) ───────────────────────────────────────────────
  createCheckoutSession: (leadId, success_url, cancel_url) => request('POST', '/api/v1/payments/checkout-session', { lead_id: leadId, success_url, cancel_url }),
  getPaymentStatus:      (leadId) => request('GET', `/api/v1/payments/status/${leadId}`),
  // ── Human Review Queue (Feature 5) ────────────────────────────────
  listReviewQueue:   (params = {}) => request('GET', `/api/v1/review/queue${buildQS(params)}`),
  getReviewStats:    () => request('GET', '/api/v1/review/stats'),
  approveReviewItem: (id, correction) =>
    request('POST', `/api/v1/review/queue/${id}/approve`, { correction: correction || null }),
  rejectReviewItem:  (id, correction) =>
    request('POST', `/api/v1/review/queue/${id}/reject`, { correction: correction || null }),

  // ── Follow-Ups (Feature 4) ─────────────────────────────────────────
  listFollowUps:  (params = {}) => request('GET', `/api/v1/followups${buildQS(params)}`),
  cancelFollowUp: (taskId) => request('POST', `/api/v1/followups/${taskId}/cancel`),

  // ── National Permits (Feature 6) ──────────────────────────────────
  getNationalPermits: (states, keyword = 'asphalt', limit = 25) =>
    request('GET', `/api/v1/permits/national?states=${encodeURIComponent(states)}&keyword=${encodeURIComponent(keyword)}&limit=${limit}`),

  // ── Blog (Feature: blog & knowledge center) ────────────────────────
  listBlogPosts:        (params = {}) => request('GET', `/api/v1/blog${buildQS(params)}`),
  getBlogPost:          (slug) => request('GET', `/api/v1/blog/${slug}`),
  generateBlogDraft:    (data) => request('POST', '/api/v1/blog/draft', data),
  createBlogPost:       (data) => request('POST', '/api/v1/blog', data),
  updateBlogPost:       (slug, data) => request('PUT', `/api/v1/blog/${slug}`, data),
  publishBlogPost:      (slug) => request('POST', `/api/v1/blog/${slug}/publish`),

  // ── Review AI Response ──────────────────────────────────────────────
  generateReviewResponse: (data) => request('POST', '/api/v1/reviews/respond', data),

  // ── SEO Generation ──────────────────────────────────────────────────
  generateCityPageCopy: (data) => request('POST', '/api/v1/seo/city-page', data),
  generateMetaTags:     (data) => request('POST', '/api/v1/seo/meta-tags', data),
  generateFAQ:          (data) => request('POST', '/api/v1/seo/faq', data),

  // Retrospectives (Module 1)
  listRetrospectives:  (params = {}) => request('GET', `/api/v1/retrospectives${buildQS(params)}`),
  createRetrospective: (data) => request('POST', '/api/v1/retrospectives', data),
  updateRetrospective: (id, data) => request('PUT', `/api/v1/retrospectives/${id}`, data),
  deleteRetrospective: (id) => request('DELETE', `/api/v1/retrospectives/${id}`),
  tagRetrospective:    (id) => request('POST', `/api/v1/retrospectives/${id}/tag`),
  surfaceLessons:      (params = {}) => request('GET', `/api/v1/retrospectives/surface${buildQS(params)}`),

  // Safety (Module 2)
  listToolboxTalks:  (params = {}) => request('GET', `/api/v1/safety/toolbox${buildQS(params)}`),
  createToolboxTalk: (data) => request('POST', '/api/v1/safety/toolbox', data),
  listIncidents:     (params = {}) => request('GET', `/api/v1/safety/incidents${buildQS(params)}`),
  createIncident:    (data) => request('POST', '/api/v1/safety/incidents', data),
  getOshaRate:       (params = {}) => request('GET', `/api/v1/safety/osha-rate${buildQS(params)}`),
  getSafetyScores:   () => request('GET', '/api/v1/safety/scores'),

  // Cash Flow (Module 3)
  listCashFlowEntries: (params = {}) => request('GET', `/api/v1/cashflow/entries${buildQS(params)}`),
  createCashFlowEntry: (data) => request('POST', '/api/v1/cashflow/entries', data),
  deleteCashFlowEntry: (id) => request('DELETE', `/api/v1/cashflow/entries/${id}`),
  getCashFlowForecast: () => request('GET', '/api/v1/cashflow/forecast'),
  getCashFlowAlert:    () => request('GET', '/api/v1/cashflow/alert'),
  setCashFlowAlert:    (data) => request('POST', '/api/v1/cashflow/alert', data),

  // Project Metrics / Scorecard (Module 4)
  listProjectMetrics:     () => request('GET', '/api/v1/project-metrics'),
  createProjectMetric:    (data) => request('POST', '/api/v1/project-metrics', data),
  updateProjectMetric:    (id, data) => request('PUT', `/api/v1/project-metrics/${id}`, data),
  deleteProjectMetric:    (id) => request('DELETE', `/api/v1/project-metrics/${id}`),
  getProjectMetricTrends: () => request('GET', '/api/v1/project-metrics/trends'),
  generateCaseStudy:      (id) => request('POST', `/api/v1/project-metrics/${id}/case-study`),

  // Workforce / Skills Matrix (Module 5)
  listWorkforce:             (params = {}) => request('GET', `/api/v1/workforce${buildQS(params)}`),
  addWorkforceMember:        (data) => request('POST', '/api/v1/workforce', data),
  updateWorkforceMember:     (id, data) => request('PUT', `/api/v1/workforce/${id}`, data),
  deleteWorkforceMember:     (id) => request('DELETE', `/api/v1/workforce/${id}`),
  queryAvailableWorkforce:   (scope) => request('GET', `/api/v1/workforce/available${buildQS({ scope })}`),
  getExpiringWorkforceCerts: (daysAhead = 90) => request('GET', `/api/v1/workforce/expiring-certs?days_ahead=${daysAhead}`),

  // Subcontractor Performance (Module 6)
  getSubcontractorPerformance: (subId) => request('GET', `/api/v1/subcontractors/${subId}/performance`),
  addSubcontractorPerformance: (subId, data) => request('POST', `/api/v1/subcontractors/${subId}/performance`, data),
  deleteSubcontractorPerf:     (perfId) => request('DELETE', `/api/v1/subcontractors/performance/${perfId}`),

  // Bid Intelligence / Win-Rate (Module 7)
  listBidOutcomes:   () => request('GET', '/api/v1/bid-intelligence/outcomes'),
  recordBidOutcome:  (data) => request('POST', '/api/v1/bid-intelligence/outcomes', data),
  updateBidOutcome:  (id, data) => request('PUT', `/api/v1/bid-intelligence/outcomes/${id}`, data),
  deleteBidOutcome:  (id) => request('DELETE', `/api/v1/bid-intelligence/outcomes/${id}`),
  getBidSummary:     () => request('GET', '/api/v1/bid-intelligence/summary'),
  getBidWinAnalysis: () => request('GET', '/api/v1/bid-intelligence/win-analysis'),

  // KPI Wall (Module 8)
  getKPIWall: () => request('GET', '/api/v1/kpi-wall'),

  // Innovations (Module 10)
  listInnovations:   (params = {}) => request('GET', `/api/v1/innovations${buildQS(params)}`),
  createInnovation:  (data) => request('POST', '/api/v1/innovations', data),
  updateInnovation:  (id, data) => request('PUT', `/api/v1/innovations/${id}`, data),
  deleteInnovation:  (id) => request('DELETE', `/api/v1/innovations/${id}`),
  getAdoptedMethods: () => request('GET', '/api/v1/innovations/adopted'),

  // ── 3-D Property Visualizer ────────────────────────────────────────────
  scanParcel:            (data)  => request('POST', '/api/v1/visualizer/parcel',         data),
  submitVisualProposal:  (data)  => request('POST', '/api/v1/visualizer/proposal',       data),
  getAIDesignSuggestions:(data)  => request('POST', '/api/v1/visualizer/ai-suggestions', data),

  // ── iGrade Engine ─────────────────────────────────────────────────────
  getIGradeStats:         ()            => request('GET',    '/api/v1/igrade/stats'),
  listGradeLogs:          (params = {}) => request('GET',    `/api/v1/igrade/logs${buildQS(params)}`),
  runSelfCorrectionSweep: ()            => request('POST',   '/api/v1/igrade/sweep'),

  // Media File Storage Registry
  listMediaFiles:         (params = {}) => request('GET',    `/api/v1/igrade/media${buildQS(params)}`),
  registerMediaFile:      (data)        => request('POST',   '/api/v1/igrade/media', data),
  deleteMediaFile:        (id)          => request('DELETE', `/api/v1/igrade/media/${id}`),
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
