/**
 * Permits API client — Virginia Permit Transparency, DEQ PEEP, and DPOR.
 *
 * All functions share the same BASE URL and timeout logic as the main
 * api/client.js so the Command Center dashboard works seamlessly with the
 * existing FastAPI backend.
 */

const BASE = import.meta.env.VITE_API_BASE_URL || ''
const DEFAULT_TIMEOUT_MS = 15_000

async function request(method, path, body) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
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
    if (err.name === 'AbortError') throw new Error('Request timed out. Please try again.')
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Fetch Virginia Permit Transparency permits.
 * @param {string} keyword  Search term (default: 'paving')
 * @param {number} limit    Max results (default: 50)
 */
export function getVptPermits(keyword = 'paving', limit = 50) {
  const params = new URLSearchParams({ keyword, limit })
  return request('GET', `/api/v1/permits/virginia/vpt?${params}`)
}

/**
 * Fetch Virginia DEQ PEEP stormwater construction permits.
 * @param {number} limit  Max results (default: 50)
 */
export function getDeqPermits(limit = 50) {
  const params = new URLSearchParams({ limit })
  return request('GET', `/api/v1/permits/virginia/deq?${params}`)
}

/**
 * Look up a DPOR license by number or address.
 * @param {{ license_number?: string, address?: string }} payload
 */
export function lookupDpor(payload) {
  return request('POST', '/api/v1/permits/virginia/dpor', payload)
}
