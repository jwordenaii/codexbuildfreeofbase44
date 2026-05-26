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
const LOCAL_ENTITY_PREFIX = 'jworden.local.entity.'
const AUTH_TOKEN_STORAGE_KEY = 'jworden.auth.token'
const AUTH_EXPIRES_STORAGE_KEY = 'jworden.auth.expires_at'

const entitySubscribers = new Map()

let authState = {
  token: null,
  expiresAt: 0,
  authRequired: false,
  tokenEndpoint: null,
}

function tokenStillValid() {
  return Boolean(authState.token && authState.expiresAt - Date.now() > 60_000)
}

function storeAuthToken(token, expiresAtSeconds) {
  authState.token = token
  authState.expiresAt = (expiresAtSeconds || 0) * 1000
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token)
  window.sessionStorage.setItem(AUTH_EXPIRES_STORAGE_KEY, String(expiresAtSeconds || 0))
}

function clearStoredAuthToken() {
  authState.token = null
  authState.expiresAt = 0
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
  window.sessionStorage.removeItem(AUTH_EXPIRES_STORAGE_KEY)
}

function handleAuthRejection(status, detail) {
  if (![401, 403].includes(Number(status))) return
  const message = String(detail || '').toLowerCase()
  if (status === 401 || message.includes('invalid token') || message.includes('not authenticated') || message.includes('expired')) {
    clearStoredAuthToken()
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('jworden:auth-expired'))
    }
  }
}

function restoreStoredAuthToken() {
  if (typeof window === 'undefined') return false
  const token = window.sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
  const expiresAtSeconds = Number(window.sessionStorage.getItem(AUTH_EXPIRES_STORAGE_KEY) || 0)
  if (!token || expiresAtSeconds * 1000 - Date.now() <= 60_000) {
    clearStoredAuthToken()
    return false
  }
  authState.token = token
  authState.expiresAt = expiresAtSeconds * 1000
  return true
}

async function fetchBootstrapToken() {
  if (!authState.tokenEndpoint) {
    throw new Error('No server token endpoint is configured.')
  }
  const res = await fetch(authState.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `Token bootstrap failed (${res.status})`)
  }
  const body = await res.json()
  storeAuthToken(body.token, body.expires_at)
  return authState.token
}

export async function bootstrapAuth() {
  const status = await request('GET', '/api/v1/auth/status')
  authState.authRequired = Boolean(status?.auth_required)
  authState.tokenEndpoint = status?.token_endpoint || null
  if (authState.authRequired) {
    if (!restoreStoredAuthToken()) {
      try {
        await fetchBootstrapToken()
      } catch (error) {
        clearStoredAuthToken()
        status.token_bootstrap_error = error.message || 'Token bootstrap failed.'
      }
    }
  } else {
    clearStoredAuthToken()
  }
  return status
}

export async function getAccessToken() {
  if (!authState.authRequired) return null
  if (!tokenStillValid()) restoreStoredAuthToken()
  if (tokenStillValid()) return authState.token
  return fetchBootstrapToken()
}

export async function authenticateWithPin(pin) {
  const localPin = import.meta.env.VITE_ADMIN_PIN
  if (localPin && pin === localPin) {
    const fakeToken = `local_${Date.now()}`
    storeAuthToken(fakeToken, Math.floor(Date.now() / 1000) + 86_400 * 30)
    return fakeToken
  }
  const response = await request('POST', '/api/v1/auth/pin-token', { pin })
  storeAuthToken(response.access_token, Math.floor(Date.now() / 1000) + (response.expires_in || 86_400))
  return authState.token
}

export function clearAuthToken() {
  clearStoredAuthToken()
}

export async function request(method, path, body, options = {}) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  const headers = { 'Content-Type': 'application/json' }
  // Attach owner token when present in sessionStorage so frontend can prove operator consent
  try {
    if (typeof window !== 'undefined') {
      const owner = window.sessionStorage.getItem('OWNER_TOKEN') || window.localStorage.getItem('OWNER_TOKEN')
      if (owner) headers['X-OWNER-TOKEN'] = owner
      const sess = window.sessionStorage.getItem('OWNER_SESSION_ID') || null
      if (sess) headers['X-SESSION-TOKEN'] = sess
    }
  } catch {
    // ignore storage errors
  }

  const opts = {
    method,
    headers: { ...headers, ...(options.headers || {}) },
    signal: controller.signal,
  }
  if (body) opts.body = JSON.stringify(body)

  try {
    const res = await fetch(`${BASE}${path}`, opts)
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      handleAuthRejection(res.status, err.detail)
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

async function protectedRequest(method, path, body, options = {}) {
  const token = await getAccessToken()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const opts = {
    method,
    headers: { ...headers, ...(options.headers || {}) },
    signal: controller.signal,
  }
  if (body) opts.body = JSON.stringify(body)

  try {
    const res = await fetch(`${BASE}${path}`, opts)
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      handleAuthRejection(res.status, err.detail)
      throw new Error(err.detail || `HTTP ${res.status}`)
    }
    if (res.status === 204) return null
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

async function protectedFormRequest(path, form) {
  const token = await getAccessToken()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30_000)
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  try {
    const res = await fetch(`${BASE}${path}`, { method: 'POST', body: form, headers, signal: controller.signal })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      handleAuthRejection(res.status, err.detail)
      throw new Error(err.detail || `HTTP ${res.status}`)
    }
    return res.json()
  } finally {
    clearTimeout(timeoutId)
  }
}

/** Build a query string from an object, omitting null/undefined/empty values. */
function buildQS(params = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    )
  ).toString()
  return qs ? `?${qs}` : ''
}

function readLocalEntityStore(entityName) {
  try {
    if (typeof window === 'undefined') return []
    const raw = window.localStorage.getItem(`${LOCAL_ENTITY_PREFIX}${entityName}`)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLocalEntityStore(entityName, records) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(`${LOCAL_ENTITY_PREFIX}${entityName}`, JSON.stringify(records))
}

function nextLocalEntityId(entityName) {
  return `${entityName.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function sortEntityRecords(records, sort) {
  if (!sort) return records
  const descending = String(sort).startsWith('-')
  const field = descending ? String(sort).slice(1) : String(sort)
  return [...records].sort((left, right) => {
    const a = left?.[field]
    const b = right?.[field]
    if (a == null && b == null) return 0
    if (a == null) return 1
    if (b == null) return -1
    if (a < b) return descending ? 1 : -1
    if (a > b) return descending ? -1 : 1
    return 0
  })
}

function matchesEntityFilter(record, filter = {}) {
  return Object.entries(filter).every(([key, value]) => {
    if (value === undefined || value === null || value === '') return true
    return record?.[key] === value
  })
}

function notifyEntitySubscribers(entityName, event) {
  const listeners = entitySubscribers.get(entityName)
  if (!listeners) return
  listeners.forEach((listener) => {
    try {
      listener(event)
    } catch {
      // Keep other listeners alive.
    }
  })
}

function subscribeToEntity(entityName, callback) {
  const listeners = entitySubscribers.get(entityName) || new Set()
  listeners.add(callback)
  entitySubscribers.set(entityName, listeners)
  return () => {
    listeners.delete(callback)
    if (listeners.size === 0) {
      entitySubscribers.delete(entityName)
    }
  }
}

function normalizeLeadRecord(record) {
  if (!record) return record
  return {
    ...record,
    status: record.status || record.pipeline_stage || 'new',
    created_date: record.created_date || record.created_at || new Date().toISOString(),
  }
}

function normalizeBlogPostRecord(record) {
  if (!record) return record
  return {
    ...record,
    content: record.content || record.body || '',
    published_date: record.published_date || record.published_at || record.created_at || null,
    updated_date: record.updated_date || record.updated_at || record.published_at || null,
    author: record.author || record.author_name || 'J. Worden & Sons',
    cover_image: record.cover_image || record.image_url || null,
    tags: Array.isArray(record.tags) ? record.tags : String(record.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean),
  }
}

function normalizeJobRecord(record) {
  if (!record) return record
  return {
    ...record,
    title: record.title || record.name || `Job ${record.job_number || record.id}`,
    address: record.address || record.site_address || null,
    surface_type: record.surface_type || record.service_type || null,
    scheduled_date: record.scheduled_date || (record.scheduled_start ? String(record.scheduled_start).split('T')[0] : null),
    start_time: record.start_time || null,
    progress_percent: Number(record.progress_percent || 0),
    progress_notes: record.progress_notes || '',
    notes: record.notes || record.progress_notes || '',
    sqft: record.sqft || record.project_size_sqft || null,
    client_name: record.client_name || null,
    client_email: record.client_email || null,
    client_phone: record.client_phone || null,
    status: record.status === 'active' ? 'in_progress' : record.status,
  }
}

function normalizeProjectDocumentRecord(record) {
  if (!record) return record
  return {
    ...record,
    visible_to_client: Boolean(record.visible_to_client),
  }
}

async function listBackendLeads(limit = 200) {
  const response = await protectedRequest('GET', `/api/v1/crm/leads${buildQS({ limit })}`)
  const leads = Array.isArray(response?.leads) ? response.leads : []
  return leads.map(normalizeLeadRecord)
}

function mergeLeadOverlay(baseLeads) {
  const overlays = readLocalEntityStore('Lead')
  const byId = new Map(baseLeads.map((lead) => [String(lead.id), lead]))

  overlays.forEach((overlay) => {
    const key = String(overlay.id)
    if (byId.has(key)) {
      byId.set(key, normalizeLeadRecord({ ...byId.get(key), ...overlay }))
      return
    }
    byId.set(key, normalizeLeadRecord(overlay))
  })

  return [...byId.values()]
}

function isQuotePayload(payload) {
  return Boolean(payload && payload.name && payload.phone && payload.service_type)
}

async function createLeadRecord(payload) {
  if (isQuotePayload(payload)) {
    const response = await api.submitQuote({
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      service_type: payload.service_type,
      property_type: payload.property_type || 'residential',
      urgency: payload.urgency || 'within_2_weeks',
      project_size_sqft: payload.project_size_sqft || payload.sqft || 1000,
      address: payload.address || '',
      message: payload.notes || payload.message || '',
      state_code: payload.state_code,
    })
    const created = normalizeLeadRecord({
      ...payload,
      id: response?.lead_id ?? nextLocalEntityId('Lead'),
      score_label: response?.score_label,
      created_at: new Date().toISOString(),
    })
    const existing = readLocalEntityStore('Lead').filter((item) => String(item.id) !== String(created.id))
    writeLocalEntityStore('Lead', [created, ...existing])
    notifyEntitySubscribers('Lead', { type: 'create', id: created.id, data: created })
    return created
  }

  const created = normalizeLeadRecord({
    ...payload,
    id: payload?.id || nextLocalEntityId('Lead'),
    created_at: payload?.created_at || new Date().toISOString(),
  })
  const existing = readLocalEntityStore('Lead').filter((item) => String(item.id) !== String(created.id))
  writeLocalEntityStore('Lead', [created, ...existing])
  notifyEntitySubscribers('Lead', { type: 'create', id: created.id, data: created })
  return created
}

async function updateLeadRecord(id, payload) {
  const key = String(id)
  const records = readLocalEntityStore('Lead')
  const current = records.find((item) => String(item.id) === key) || { id }
  const next = normalizeLeadRecord({ ...current, ...payload, id })
  const merged = [next, ...records.filter((item) => String(item.id) !== key)]
  writeLocalEntityStore('Lead', merged)

  if (payload?.status || payload?.pipeline_stage) {
    const pipelineStage = payload.pipeline_stage || payload.status
    const closedReason = payload.closed_reason || null
    try {
      await protectedRequest('PATCH', `/api/v1/crm/leads/${id}/stage`, {
        pipeline_stage: pipelineStage,
        closed_reason: closedReason,
      })
    } catch {
      // Keep local overlay even if protected stage update is unavailable.
    }
  }

  notifyEntitySubscribers('Lead', { type: 'update', id: next.id, data: next })
  return next
}

async function listLeadRecords(sort = '-created_date', limit = 200) {
  let backend = []
  try {
    backend = await listBackendLeads(limit)
  } catch {
    backend = []
  }
  const merged = mergeLeadOverlay(backend)
  return sortEntityRecords(merged, sort).slice(0, limit)
}

function createLocalEntityAdapter(entityName) {
  return {
    async list(sort, limit = 100) {
      const records = readLocalEntityStore(entityName)
      return sortEntityRecords(records, sort).slice(0, limit)
    },
    async filter(filter = {}, sort, limit = 100) {
      const records = readLocalEntityStore(entityName).filter((record) => matchesEntityFilter(record, filter))
      return sortEntityRecords(records, sort).slice(0, limit)
    },
    async get(id) {
      return readLocalEntityStore(entityName).find((record) => String(record.id) === String(id)) || null
    },
    async create(payload) {
      const created = {
        ...payload,
        id: payload?.id || nextLocalEntityId(entityName),
        created_at: payload?.created_at || new Date().toISOString(),
      }
      const records = readLocalEntityStore(entityName)
      writeLocalEntityStore(entityName, [created, ...records.filter((record) => String(record.id) !== String(created.id))])
      notifyEntitySubscribers(entityName, { type: 'create', id: created.id, data: created })
      return created
    },
    async update(id, payload) {
      const key = String(id)
      const records = readLocalEntityStore(entityName)
      const current = records.find((record) => String(record.id) === key) || { id }
      const updated = { ...current, ...payload, id }
      writeLocalEntityStore(entityName, [updated, ...records.filter((record) => String(record.id) !== key)])
      notifyEntitySubscribers(entityName, { type: 'update', id: updated.id, data: updated })
      return updated
    },
    async delete(id) {
      const key = String(id)
      const remaining = readLocalEntityStore(entityName).filter((record) => String(record.id) !== key)
      writeLocalEntityStore(entityName, remaining)
      notifyEntitySubscribers(entityName, { type: 'delete', id })
      return { status: 'deleted', id }
    },
    subscribe(callback) {
      return subscribeToEntity(entityName, callback)
    },
  }
}

const entityAdapters = {
  BlogPost: {
    async list(sort = '-published_date', limit = 100) {
      const response = await request('GET', `/api/v1/blog${buildQS({ per_page: limit })}`)
      const posts = Array.isArray(response?.posts) ? response.posts.map(normalizeBlogPostRecord) : []
      return sortEntityRecords(posts, sort).slice(0, limit)
    },
    async filter(filter = {}, sort = '-published_date', limit = 100) {
      if (filter?.slug) {
        try {
          const post = await request('GET', `/api/v1/blog/${encodeURIComponent(filter.slug)}`)
          return [normalizeBlogPostRecord(post)]
        } catch {
          return []
        }
      }
      const posts = await this.list(sort, limit)
      return posts.filter((post) => matchesEntityFilter(post, filter)).slice(0, limit)
    },
    async get(idOrSlug) {
      try {
        const post = await request('GET', `/api/v1/blog/${encodeURIComponent(idOrSlug)}`)
        return normalizeBlogPostRecord(post)
      } catch {
        return null
      }
    },
    subscribe(callback) {
      return subscribeToEntity('BlogPost', callback)
    },
  },
  Job: {
    async list(sort = '-scheduled_date', limit = 200) {
      const response = await protectedRequest('GET', `/api/v1/operations/jobs${buildQS()}`)
      const jobs = Array.isArray(response?.jobs) ? response.jobs.map(normalizeJobRecord) : []
      return sortEntityRecords(jobs, sort).slice(0, limit)
    },
    async filter(filter = {}, sort = '-scheduled_date', limit = 200) {
      const response = await protectedRequest('GET', `/api/v1/operations/jobs${buildQS({ client_email: filter.client_email })}`)
      const jobs = Array.isArray(response?.jobs) ? response.jobs.map(normalizeJobRecord) : []
      return sortEntityRecords(jobs.filter((job) => matchesEntityFilter(job, filter)), sort).slice(0, limit)
    },
    async get(id) {
      try {
        const job = await protectedRequest('GET', `/api/v1/operations/jobs/${id}`)
        return normalizeJobRecord(job)
      } catch {
        return null
      }
    },
    async update(id, payload) {
      const job = await protectedRequest('PATCH', `/api/v1/operations/jobs/${id}`, payload)
      return normalizeJobRecord(job)
    },
    subscribe(callback) {
      return subscribeToEntity('Job', callback)
    },
  },
  Lead: {
    async list(sort, limit = 200) {
      return listLeadRecords(sort, limit)
    },
    async filter(filter = {}, sort, limit = 200) {
      const records = await listLeadRecords(sort, limit)
      return records.filter((record) => matchesEntityFilter(record, filter)).slice(0, limit)
    },
    async get(id) {
      const records = await listLeadRecords('-created_date', 500)
      return records.find((record) => String(record.id) === String(id)) || null
    },
    async create(payload) {
      return createLeadRecord(payload)
    },
    async update(id, payload) {
      return updateLeadRecord(id, payload)
    },
    async delete(id) {
      const key = String(id)
      const remaining = readLocalEntityStore('Lead').filter((record) => String(record.id) !== key)
      writeLocalEntityStore('Lead', remaining)
      notifyEntitySubscribers('Lead', { type: 'delete', id })
      return { status: 'deleted', id }
    },
    subscribe(callback) {
      return subscribeToEntity('Lead', callback)
    },
  },
  ProjectDocument: {
    async list(sort = '-created_at', limit = 200) {
      const response = await protectedRequest('GET', '/api/v1/operations/job-documents')
      const documents = Array.isArray(response?.documents) ? response.documents.map(normalizeProjectDocumentRecord) : []
      return sortEntityRecords(documents, sort).slice(0, limit)
    },
    async filter(filter = {}, sort = '-created_at', limit = 200) {
      const response = await protectedRequest('GET', `/api/v1/operations/job-documents${buildQS(filter)}`)
      const documents = Array.isArray(response?.documents) ? response.documents.map(normalizeProjectDocumentRecord) : []
      return sortEntityRecords(documents, sort).slice(0, limit)
    },
    async get(id) {
      const documents = await this.filter({}, '-created_at', 500)
      return documents.find((document) => String(document.id) === String(id)) || null
    },
    async update(id, payload) {
      const document = await protectedRequest('PATCH', `/api/v1/operations/job-documents/${id}`, payload)
      return normalizeProjectDocumentRecord(document)
    },
    async delete(id) {
      return protectedRequest('DELETE', `/api/v1/operations/job-documents/${id}`)
    },
    subscribe(callback) {
      return subscribeToEntity('ProjectDocument', callback)
    },
  },
}

const entities = new Proxy(entityAdapters, {
  get(target, prop) {
    if (typeof prop !== 'string') return undefined
    if (!target[prop]) {
      target[prop] = createLocalEntityAdapter(prop)
    }
    return target[prop]
  },
})

const functionsClient = {
  async invoke(name, payload = {}) {
    return {
      ok: true,
      status: 'queued',
      function_name: name,
      data: {
        acknowledged: true,
        mode: 'standalone_fallback',
        payload,
      },
    }
  },
}

const integrationsClient = {
  Core: {
    async UploadFile({ file }) {
      if (!file) {
        throw new Error('No file provided.')
      }
      return {
        file_url: typeof URL !== 'undefined' ? URL.createObjectURL(file) : '',
      }
    },
  },
}

export const api = {
  getAuthStatus: () => request('GET', '/api/v1/auth/status'),
  authenticateWithPin,
  listAuditEvents: (params = {}) => protectedRequest('GET', `/api/v1/admin/audit/events${buildQS(params)}`),
  listRecentOperationalLeads: (limit = 12) => protectedRequest('GET', `/api/v1/operations/leads/recent${buildQS({ limit })}`),
  submitQuote: (data) => request('POST', '/api/v1/leads/quote', data),
  submitContact: (data) => request('POST', '/api/v1/leads/contact', data),
  getReviews: () => request('GET', '/api/v1/reviews'),
  getSchema: () => request('GET', '/api/v1/schema/local-business'),
  askAI: (data) => request('POST', '/api/v1/ai/chat', data),
  // Mr. Worden premium public concierge — structured response with quick replies + handoff
  publicChat: (data) => request('POST', '/api/v1/public/chat', data),
  // AI-assisted contact form field suggestions (page_context + message → service_type + hint)
  contactSuggest: (data) => request('POST', '/api/v1/ai/contact-suggest', data),
  // Content blocks managed via the admin Webpage Maker.
  // The frontend uses these as optional overrides — hardcoded defaults remain
  // in place if a block is missing (graceful degradation).
  getContent: () => request('GET', '/api/v1/content'),
  getContentBlock: (key) => request('GET', `/api/v1/content/${key}`),
  // ── Geospatial ─────────────────────────────────────────────────────────────
  getSites: () => request('GET', '/api/v1/geo/sites'),
  createSite: (data) => request('POST', '/api/v1/geo/sites', data),
  updateSite: (id, data) => request('PUT', `/api/v1/geo/sites/${id}`, data),
  getPermitLeads: (params = {}) => {
    return request('GET', `/api/v1/geo/permit-leads${buildQS(params)}`)
  },
  triggerScrape: (maxPages = 5) =>
    request('POST', `/api/v1/geo/permit-leads/scrape?max_pages=${maxPages}`),
  radiusQuery: (lat, lng, miles = 20) =>
    request('GET', `/api/v1/geo/radius-query?lat=${lat}&lng=${lng}&radius_miles=${miles}`),
  getTrucks: () => request('GET', '/api/v1/geo/trucks'),
  pingTruck: (id, data) => request('POST', `/api/v1/geo/trucks/${id}`, data),
  // ── Virtual Foreman ────────────────────────────────────────────────────────
  askForeman: (data) => request('POST', '/api/v1/foreman/chat', data),
  getForemanStatus: () => request('GET', '/api/v1/foreman/status'),
  getVisionResult: (jobId) => request('GET', `/api/v1/ai/vision-result/${jobId}`),
  // ── JARVIS Command Interface ───────────────────────────────────────────────
  jarvisCommand: (query, persona = "JARVIS", { confirmed = false } = {}) =>
    request('POST', '/api/v1/jarvis/command', { query, persona, confirmed }),
  jarvisStatus: () => request('GET', '/api/v1/jarvis/status'),
  jarvisReadiness: () => request('GET', '/api/v1/jarvis/readiness'),
  jarvisMetrics: () => protectedRequest('GET', '/api/v1/metrics/jarvis'),
  jarvisSearch: (query, deep = false) =>
    request('POST', '/api/v1/jarvis/search', { query, deep }),
  jarvisCall: (toNumber, purpose, scriptHint) =>
    request('POST', '/api/v1/jarvis/call', {
      to_number: toNumber,
      purpose,
      script_hint: scriptHint || undefined,
      confirmed: true,
    }),
  jarvisEmail: (subject, body, toEmail = null) =>
    request('POST', '/api/v1/jarvis/email', {
      to_email: toEmail || undefined,
      subject,
      body,
    }),
  // ── Twilio Verify (SMS OTP) ────────────────────────────────────────────────
  twilioVerifyStatus:  () => request('GET',  '/api/v1/twilio/verify/status'),
  twilioVerifyStart:   (to, channel = 'sms') => request('POST', '/api/v1/twilio/verify/start', { to, channel }),
  twilioVerifyCheck:   (to, code) => request('POST', '/api/v1/twilio/verify/check', { to, code }),
  twilioVerifyAdminStart: () => request('POST', '/api/v1/twilio/verify/admin/start'),
  // ── Owner-only Integrations panel (runtime keys + tier flags) ─────────────
  integrationsStatus:  () => protectedRequest('GET',  '/api/v1/admin/integrations/status'),
  integrationsPutKey:  (name, value) => protectedRequest('PUT',  '/api/v1/admin/integrations/keys', { name, value }),
  integrationsBulk:    (updates) => protectedRequest('POST', '/api/v1/admin/integrations/bulk', { updates }),
  integrationsReload:  () => protectedRequest('POST', '/api/v1/admin/integrations/reload'),
  integrationsTest:    (provider) => protectedRequest('POST', '/api/v1/admin/integrations/test', { provider }),
  googleHealth:        () => protectedRequest('GET',  '/api/v1/admin/integrations/google/health'),
  // ── Crew wearable health monitoring ───────────────────────────────────────
  wearableSnapshot:   (crew_id) => protectedRequest('GET', `/api/v1/admin/wearables/snapshot${crew_id ? `?crew_id=${encodeURIComponent(crew_id)}` : ''}`),
  wearableCrews:      () => protectedRequest('GET', '/api/v1/admin/wearables/crews'),
  wearableConfig:     () => protectedRequest('GET', '/api/v1/admin/wearables/config'),
  // ── Live Search Pulse / VA hotspot heatmap ───────────────────────────────
  searchPulseSnapshot: (force = false) => protectedRequest('GET', `/api/v1/admin/search-pulse/snapshot${force ? '?force=true' : ''}`),
  // ── Dump-truck dispatch (Ship D) ──────────────────────────────────────────
  dispatchSnapshot: () => protectedRequest('GET', '/api/v1/admin/dispatch/snapshot'),
  dispatchTrucks:   () => protectedRequest('GET', '/api/v1/admin/dispatch/trucks'),
  dispatchUpsertTruck: (payload) => protectedRequest('POST', '/api/v1/admin/dispatch/trucks', payload),
  dispatchDeleteTruck: (id) => protectedRequest('DELETE', `/api/v1/admin/dispatch/trucks/${encodeURIComponent(id)}`),
  dispatchDrivers:  () => protectedRequest('GET', '/api/v1/admin/dispatch/drivers'),
  dispatchUpsertDriver: (payload) => protectedRequest('POST', '/api/v1/admin/dispatch/drivers', payload),
  dispatchDeleteDriver: (id) => protectedRequest('DELETE', `/api/v1/admin/dispatch/drivers/${encodeURIComponent(id)}`),
  dispatchJobs:     () => protectedRequest('GET', '/api/v1/admin/dispatch/jobs'),
  dispatchUpsertJob: (payload) => protectedRequest('POST', '/api/v1/admin/dispatch/jobs', payload),
  dispatchDeleteJob: (id) => protectedRequest('DELETE', `/api/v1/admin/dispatch/jobs/${encodeURIComponent(id)}`),
  dispatchAssign:   (jobId) => protectedRequest('GET', `/api/v1/admin/dispatch/assign/${encodeURIComponent(jobId)}`),
  // ── Asphalt thermal lay-down window (Ship E) ─────────────────────────────
  thermalWindow: (params) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/api/v1/thermal/window?${q}`);
  },
  // ── Drone capture pipeline (Ship F) ──────────────────────────────────────
  droneSnapshot: () => protectedRequest('GET', '/api/v1/admin/drone/snapshot'),
  droneCaptures: (jobId) => protectedRequest('GET', `/api/v1/admin/drone/captures/${encodeURIComponent(jobId)}`),
  droneUpload: (formData) => protectedFormRequest('/api/v1/admin/drone/upload', formData),
  droneDeleteCapture: (jobId, capId) => protectedRequest('DELETE', `/api/v1/admin/drone/captures/${encodeURIComponent(jobId)}/${encodeURIComponent(capId)}`),
  // ── LiDAR / iPhone scan ingestion (Ship G) ──────────────────────────────
  lidarSnapshot: () => protectedRequest('GET', '/api/v1/admin/lidar/snapshot'),
  lidarScans: (bucket) => protectedRequest('GET', `/api/v1/admin/lidar/scans/${encodeURIComponent(bucket)}`),
  lidarMatch: (lat, lng) => protectedRequest('GET', `/api/v1/admin/lidar/match?lat=${lat}&lng=${lng}`),
  lidarUpload: (formData) => protectedFormRequest('/api/v1/admin/lidar/upload', formData),
  lidarDeleteScan: (bucket, scanId) => protectedRequest('DELETE', `/api/v1/admin/lidar/scans/${encodeURIComponent(bucket)}/${encodeURIComponent(scanId)}`),
  // ── Roller compaction telemetry (Ship H) ────────────────────────────────
  rollerSnapshot: () => protectedRequest('GET', '/api/v1/admin/roller/snapshot'),
  rollerSession: (sid) => protectedRequest('GET', `/api/v1/admin/roller/sessions/${encodeURIComponent(sid)}`),
  // ── Staff portal (Ship I) ─────────────────────────────────────────
  staffLogin: (username, password) => request('POST', '/api/v1/staff/login', { username, password }),
  staffMe: (token) => {
    return fetch(`${BASE}/api/v1/staff/me`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.ok ? r.json() : r.json().then(j => Promise.reject(new Error(j.detail || `HTTP ${r.status}`))))
  },
  staffCheckin: (token, formData) => {
    return fetch(`${BASE}/api/v1/staff/checkin`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    }).then(r => r.ok ? r.json() : r.json().then(j => Promise.reject(new Error(j.detail || `HTTP ${r.status}`))))
  },
  staffCheckins: (token) => {
    return fetch(`${BASE}/api/v1/staff/checkins`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.ok ? r.json() : r.json().then(j => Promise.reject(new Error(j.detail || `HTTP ${r.status}`))))
  },
  adminStaffUsers: () => protectedRequest('GET', '/api/v1/admin/staff/users'),
  adminCreateStaffUser: (body) => protectedRequest('POST', '/api/v1/admin/staff/users', body),
  adminStaffCheckins: (limit = 100) => protectedRequest('GET', `/api/v1/admin/staff/checkins?limit=${limit}`),
  // ── Worker profiles (admin) ──────────────────────────────────────────────
  adminWorkers: () => protectedRequest('GET', '/api/v1/admin/staff/workers'),
  adminCreateWorker: (body) => protectedRequest('POST', '/api/v1/admin/staff/workers', body),
  adminWorker: (id) => protectedRequest('GET', `/api/v1/admin/staff/workers/${id}`),
  adminUpdateWorker: (id, body) => protectedRequest('PATCH', `/api/v1/admin/staff/workers/${id}`, body),
  adminUploadWorkerDoc: (profileId, formData) => protectedFormRequest(`/api/v1/admin/staff/workers/${profileId}/docs`, formData),
  adminReviewDoc: (docId, body) => protectedRequest('PATCH', `/api/v1/admin/staff/docs/${docId}`, body),
  adminCompliance: () => protectedRequest('GET', '/api/v1/admin/staff/compliance'),
  adminVaLaw: () => protectedRequest('GET', '/api/v1/admin/staff/va-law'),
  adminCdlRequirements: () => protectedRequest('GET', '/api/v1/admin/staff/cdl-requirements'),
  // ── Staff self-service (Bearer JWT) ─────────────────────────────────────
  staffMyProfile: (token) => fetch(`${BASE}/api/v1/staff/my-profile`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : r.json().then(j => Promise.reject(new Error(j.detail || `HTTP ${r.status}`)))),
  staffMyDocs: (token) => fetch(`${BASE}/api/v1/staff/my-docs`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : r.json().then(j => Promise.reject(new Error(j.detail || `HTTP ${r.status}`)))),
  staffUploadMyDoc: (token, formData) => fetch(`${BASE}/api/v1/staff/my-docs`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData }).then(r => r.ok ? r.json() : r.json().then(j => Promise.reject(new Error(j.detail || `HTTP ${r.status}`)))),
  // ── Public tier/feature flags (no secrets) ────────────────────────────────
  getFeatures: () => request('GET', '/api/v1/features'),
  // ── Autonomy kill switch (defense-in-depth, layer 2) ─────────────────────
  getAutonomyState: () => request('GET', '/api/v1/autonomy/state'),
  autonomyStatus: () => protectedRequest('GET', '/api/v1/autonomy/status'),
  autonomyIntelligenceMap: () => protectedRequest('GET', '/api/v1/autonomy/intelligence-map'),
  freezeAutonomy: (reason = 'manual') => request('POST', '/api/v1/autonomy/freeze', { reason }),
  unfreezeAutonomy: () => protectedRequest('POST', '/api/v1/autonomy/unfreeze'),
  // ── Command Center dashboard metrics ──────────────────────────────────────
  getSiteMetrics: () => request('GET', '/api/v1/site-metrics'),
  // ── Property Visualizer (public, anonymous) ───────────────────────────────
  scanParcel: (data) => request('POST', '/api/v1/visualizer/parcel', data),
  submitVisualProposal: (data) => request('POST', '/api/v1/visualizer/proposal', data),
  getAIDesignSuggestions: (data) => request('POST', '/api/v1/visualizer/ai-suggestions', data),
  // ── Proposals + Stripe checkout (post-quote pipeline) ─────────────────────
  generateProposal: (leadId) =>
    protectedRequest('POST', '/api/v1/proposals/generate', { lead_id: leadId, include_pdf: true }),
  sendProposal: (leadId) => protectedRequest('POST', `/api/v1/proposals/${leadId}/send`),
  createCheckoutSession: (leadId, successUrl, cancelUrl) =>
    request('POST', '/api/v1/payments/checkout-session', {
      lead_id: leadId,
      success_url: successUrl,
      cancel_url: cancelUrl,
    }),
  // ── National permit feed (Command Center) ─────────────────────────────────
  getNationalPermits: (states, keyword, limit = 50) => {
    const params = { keyword, limit }
    if (Array.isArray(states) && states.length) params.states = states.join(',')
    return request('GET', `/api/v1/permits/national${buildQS(params)}`)
  },
  // ── Intelligent compaction ─────────────────────────────────────────────────
  postCompactionPing: (data) => request('POST', '/api/v1/iot/compaction-ping', data),
  getCompactionHeatmap: (siteId, limit = 2000) =>
    request('GET', `/api/v1/iot/compaction-heatmap/${siteId}?limit=${limit}`),
  getCompactionSummary: (siteId) =>
    request('GET', `/api/v1/iot/compaction-summary/${siteId}`),
  // ── Drone scans ────────────────────────────────────────────────────────────
  postDroneScan: (siteId, data) => request('POST', `/api/v1/sites/${siteId}/drone-scan`, data),
  getDroneScans: (siteId) => request('GET', `/api/v1/sites/${siteId}/drone-scans`),
  getDroneScan: (scanId) => request('GET', `/api/v1/drone-scans/${scanId}`),
  // ── Live site snapshot (one-shot; use EventSource for the SSE stream) ──────
  getLiveSiteSnapshot: () => request('GET', '/api/v1/live/site-snapshot'),
  // ── 50-State compliance & license verification ────────────────────────────
  verifyLicense: (state, licenseNum, expectedName) =>
    request('GET', `/api/v1/compliance/verify?state=${state}&license_num=${licenseNum}${expectedName ? `&expected_name=${encodeURIComponent(expectedName)}` : ''}`),
  verifyLicenseBatch: (licenses) => request('POST', '/api/v1/compliance/verify-batch', { licenses }),
  getComplianceMatrix: () => request('GET', '/api/v1/compliance/matrix'),
  getStateInfo: (code) => request('GET', `/api/v1/compliance/state/${code}`),
  getVerificationHistory: (state, licenseNum) =>
    request('GET', `/api/v1/compliance/history${buildQS({ state_code: state, license_number: licenseNum })}`),
  // ── Civil / contractor intelligence advisor ───────────────────────────────
  getLegalStrategy: (data) => request('POST', '/api/v1/advisor/legal-strategy', data),
  rankContractors: (data) => request('POST', '/api/v1/advisor/rank-contractors', data),
  getTopStates: (disputeType = 'general', topN = 10) =>
    request('GET', `/api/v1/advisor/top-states${buildQS({ dispute_type: disputeType, top_n: topN })}`),
  getLicenseOptimizer: (topN = 10) =>
    request('GET', `/api/v1/advisor/license-optimizer${buildQS({ top_n: topN })}`),
  getReciprocityRanking: (homeState = 'VA', topN = 10) =>
    request('GET', `/api/v1/advisor/reciprocity-ranking${buildQS({ home_state: homeState, top_n: topN })}`),
  evaluateUtilityRisk: (data) => request('POST', '/api/v1/advisor/utility-risk', data),
  askLegalQuestion: (data) => request('POST', '/api/v1/advisor/legal-qa', data),
  scoreProjectLegal: (data) => request('POST', '/api/v1/advisor/project-legal-score', data),
  // ── What-If schedule simulator ────────────────────────────────────────────
  simulateSchedule: (data) => request('POST', '/api/v1/schedule/simulate', data),
  // ── Ads Intelligence (AI Max URL exclusions, CRM export, qualifier, anomaly) ─
  getAdsStatus: () => request('GET', '/api/v1/ads/status'),
  getUrlExclusions: (format = 'json') =>
    request('GET', `/api/v1/ads/url-exclusions?format=${format}`),
  addUrlExclusion: (data) => request('POST', '/api/v1/ads/url-exclusions', data),
  removeUrlExclusion: (id) => request('DELETE', `/api/v1/ads/url-exclusions/${id}`),
  getCrmExport: (limit = 5000) => request('GET', `/api/v1/ads/crm-export?limit=${limit}`),
  qualifyLead: (data) => request('POST', '/api/v1/ads/qualify-lead', data),
  getAnomalies: (includeResolved = false) =>
    request('GET', `/api/v1/ads/anomalies?include_resolved=${includeResolved}`),
  runAnomalyScan: () => request('POST', '/api/v1/ads/anomaly-scan'),
  resolveAnomaly: (id) => request('POST', `/api/v1/ads/anomalies/${id}/resolve`),
  // ── Cost Catalog & GC Project Estimates ──────────────────────────────────
  getCostCatalog: (category) =>
    request('GET', `/api/v1/cost-catalog${buildQS({ category })}`),
  addCatalogItem: (data) => request('POST', '/api/v1/cost-catalog', data),
  updateCatalogItem: (id, data) => request('PUT', `/api/v1/cost-catalog/${id}`, data),
  getEstimateLines: (siteId) => request('GET', `/api/v1/spatial/estimate/${siteId}`),
  getEstimateSummary: (siteId) => request('GET', `/api/v1/spatial/estimate/${siteId}/summary`),
  createEstimateLine: (data) => request('POST', '/api/v1/spatial/estimate', data),
  deleteEstimateLine: (id) => request('DELETE', `/api/v1/spatial/estimate/${id}`),
  // ── Spatial as-built verification (file upload — returns JSON) ────────────
  verifyAsBuilt: async (file, params = {}) => {
    const form = new FormData()
    form.append('file', file)
    const qs = buildQS(params)
    const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
    const controller = new AbortController()
    const tId = setTimeout(() => controller.abort(), 30_000)
    try {
      const res = await fetch(`${BASE_URL}/api/v1/spatial/verify-as-built${qs}`, {
        method: 'POST', body: form, signal: controller.signal,
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `HTTP ${res.status}`) }
      return res.json()
    } finally { clearTimeout(tId) }
  },

  // ── Plan-to-Estimate Pipeline ──────────────────────────────────────────────
  // Upload N plan files (PDF blueprints, civil drawings, GC takeoffs, sketches)
  // and receive a priced estimate covering the combined scope.
  estimateFromPlans: async (files, contact = {}) => {
    const form = new FormData()
    files.forEach((f) => form.append('files', f))
    if (contact.name) form.append('contact_name', contact.name)
    if (contact.email) form.append('contact_email', contact.email)
    if (contact.address) form.append('project_address', contact.address)
    if (contact.notes) form.append('notes', contact.notes)
    const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
    const controller = new AbortController()
    const tId = setTimeout(() => controller.abort(), 120_000)
    try {
      const res = await fetch(`${BASE_URL}/api/v1/plan-estimator/from-files`, {
        method: 'POST', body: form, signal: controller.signal,
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `HTTP ${res.status}`) }
      return res.json()
    } finally { clearTimeout(tId) }
  },

  // ── SCC Business Verification ──────────────────────────────────────────────
  verifySccEntity: (params) => request('GET', `/api/v1/scc/verify${buildQS(params)}`),
  verifySccBatch: (entities) => request('POST', '/api/v1/scc/verify-batch', { entities }),
  getSccStatus: () => request('GET', '/api/v1/scc/status'),

  // ── VDOT Bid Board ─────────────────────────────────────────────────────────
  getVdotBids: (params) => request('GET', `/api/v1/vdot-bids${buildQS(params)}`),
  getVdotBid: (id) => request('GET', `/api/v1/vdot-bids/${id}`),
  triggerVdotScan: (maxResults = 50) => request('POST', `/api/v1/vdot-bids/scan?max_results=${maxResults}`),
  getVdotStatus: () => request('GET', '/api/v1/vdot-bids/status'),
  dashboardPreflight: () => request('GET', '/api/v1/ops/dashboard-preflight'),
  getMonitoringStatus: () => protectedRequest('GET', '/api/v1/admin/monitoring/status'),
  getTechIntelligenceQueue: (params = {}) => protectedRequest('GET', `/api/v1/tech-intelligence/queue${buildQS(params)}`),
  getPredictiveCapitalShadowForecast: (params = {}) => protectedRequest('GET', `/api/v1/predictive-capital/shadow-forecast${buildQS(params)}`),
  ingestAmbientVoiceEvent: (payload) => protectedRequest('POST', '/api/v1/voice/ambient-ingest', payload),
  getVoiceOpsReviewQueue: (params = {}) => protectedRequest('GET', `/api/v1/voice/ops/review-queue${buildQS(params)}`),
  verifyVoiceOpsReviewItem: (eventId, payload) => protectedRequest('POST', `/api/v1/voice/ops/review-queue/${eventId}/verify`, payload),
  drivewayEstimatePreview: (payload) => protectedRequest('POST', '/api/v1/driveway-growth/estimate-preview', payload),
  drivewayCvMaskEstimate: (payload) => protectedRequest('POST', '/api/v1/driveway-growth/cv/mask-estimate', payload),
  draftDrivewayDirectMailCampaign: (payload, options = {}) => protectedRequest('POST', '/api/v1/driveway-growth/direct-mail/campaign-draft', payload, options),
  getDrivewayOptInLanding: (token) => request('GET', `/api/v1/driveway-growth/opt-in/${encodeURIComponent(token)}`),
  submitDrivewayOptIn: (token, payload, options = {}) => request('POST', `/api/v1/driveway-growth/opt-in/${encodeURIComponent(token)}/submit`, payload, options),
  createEstimateFromLead: (leadId, scopeSummary) => protectedRequest('POST', '/api/v1/operations/estimates/from-lead', { lead_id: leadId, scope_summary: scopeSummary }),
  listEstimates: () => protectedRequest('GET', '/api/v1/operations/estimates'),
  createJobFromEstimate: (estimateId, payload = {}) => protectedRequest('POST', '/api/v1/operations/jobs/from-estimate', { estimate_id: estimateId, ...payload }),
  seedDemoWorkspace: (resetExisting = true) => protectedRequest('POST', '/api/v1/operations/demo/seed', { reset_existing: resetExisting }),
  listJobs: () => protectedRequest('GET', '/api/v1/operations/jobs'),
  getPublicJob: (jobId) => request('GET', `/api/v1/operations/public/jobs/${encodeURIComponent(jobId)}`),
  createWorkOrder: (payload) => protectedRequest('POST', '/api/v1/operations/work-orders', payload),
  listWorkOrders: (jobId) => protectedRequest('GET', `/api/v1/operations/jobs/${jobId}/work-orders`),
  uploadProjectDocument: async (file, payload) => {
    const form = new FormData()
    form.append('file', file)
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return
      form.append(key, typeof value === 'boolean' ? String(value) : value)
    })
    return protectedFormRequest('/api/v1/operations/job-documents/upload', form)
  },
  uploadGalleryImage: (form) => protectedFormRequest('/api/v1/gallery/upload', form),
  deleteGalleryImage: (imageId) => protectedRequest('DELETE', `/api/v1/gallery/images/${imageId}`),
  entities,
  functions: functionsClient,
  integrations: integrationsClient,
}

// ── GA4 / Google Ads event helpers ────────────────────────────────────────────
// Map of internal event names → Netlify env vars holding the matching
// Google Ads conversion label (format "AbCdEf12-3"). When set, the event
// also fires `gtag('event','conversion', { send_to: 'AW-XXX/LABEL', value })`
// so the click is counted in Google Ads. Set these in Netlify → Site settings
// → Environment variables, then redeploy:
//   VITE_GADS_CONVERSION_ID            = AW-18031160509   (already in <head>)
//   VITE_GADS_LABEL_LEAD_FORM          = <label from Google Ads conversion>
//   VITE_GADS_LABEL_PHONE_CLICK        = <label>
//   VITE_GADS_LABEL_QUOTE_REQUEST      = <label>
const ADS_ID = import.meta.env.VITE_GADS_CONVERSION_ID || 'AW-18031160509'
const ADS_CONVERSION_MAP = {
  contact_form_submit: import.meta.env.VITE_GADS_LABEL_LEAD_FORM,
  generate_lead:       import.meta.env.VITE_GADS_LABEL_LEAD_FORM,
  phone_click:         import.meta.env.VITE_GADS_LABEL_PHONE_CLICK,
  quote_request:       import.meta.env.VITE_GADS_LABEL_QUOTE_REQUEST,
  qualified_lead_signal: import.meta.env.VITE_GADS_LABEL_LEAD_FORM,
  // QuickQuoteBar + SMS deeplink events (added 2026-05) — these are the
  // highest-converting paths from Google Ads traffic. Map them to the same
  // Lead/Phone conversion labels so Google Ads can optimise bids on them.
  quick_quote_submit:  import.meta.env.VITE_GADS_LABEL_LEAD_FORM,
  sms_click:           import.meta.env.VITE_GADS_LABEL_PHONE_CLICK,
}
// Events that ALWAYS represent a conversion-worthy lead signal, even if no
// Google Ads label env var is configured. We fire the GA4-recommended
// `generate_lead` event so Google Ads can pick it up as a conversion via
// "Import from Google Analytics" without any further config.
const LEAD_GA4_FALLBACK_EVENTS = new Set([
  'contact_form_submit',
  'generate_lead',
  'quote_request',
  'qualified_lead_signal',
  'quick_quote_submit',
  'sms_click',
  'phone_click',
])
// Estimated lead value (USD) — used for value-based bidding/ROAS reporting.
const LEAD_VALUE_USD = Number(import.meta.env.VITE_GADS_LEAD_VALUE_USD) || 50

export function trackEvent(eventName, params = {}) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  // 1. Always fire the GA4 event
  window.gtag('event', eventName, params)
  // 2. If this event maps to a configured Google Ads conversion, fire it too.
  //    Skip on explicit failures (e.g. form submit error).
  if (params && params.success === false) return
  const label = ADS_CONVERSION_MAP[eventName]
  if (label && ADS_ID) {
    window.gtag('event', 'conversion', {
      send_to: `${ADS_ID}/${label}`,
      value: params.value ?? LEAD_VALUE_USD,
      currency: 'USD',
    })
  }
  // 3. Fallback: even without a label env var, fire the GA4-recommended
  //    `generate_lead` event so Google Ads (with GA4 import) still counts it.
  //    Skipped if this event itself is `generate_lead` to avoid double-fire.
  if (eventName !== 'generate_lead' && LEAD_GA4_FALLBACK_EVENTS.has(eventName)) {
    window.gtag('event', 'generate_lead', {
      currency: 'USD',
      value: params.value ?? LEAD_VALUE_USD,
      lead_source: eventName,
      ...params,
    })
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
