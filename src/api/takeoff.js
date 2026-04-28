/**
 * Takeoff API client — Google Solar API, OpenCV image measurement, Aerial View.
 *
 * All functions share the same BASE URL and timeout logic as the main
 * api/client.js so the Command Center dashboard works seamlessly with the
 * existing FastAPI backend.
 */

const BASE = import.meta.env.VITE_API_BASE_URL || ''
const DEFAULT_TIMEOUT_MS = 30_000 // image processing can take a moment

async function request(method, path, body, isFormData = false) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  const opts = { method, signal: controller.signal }

  if (isFormData) {
    // Let the browser set the correct multipart boundary
    opts.body = body
  } else {
    opts.headers = { 'Content-Type': 'application/json' }
    if (body) opts.body = JSON.stringify(body)
  }

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
 * Call Google Solar API for the building closest to a lat/lng.
 * @param {{ lat: number, lng: number }} payload
 */
export function getSolarData(payload) {
  return request('POST', '/api/v1/takeoff/solar', payload)
}

/**
 * Upload a project photo for OpenCV area measurement.
 * @param {File}   file            Image file object
 * @param {number} pixelsPerFoot   Calibration value (pixels per linear foot)
 * @param {number} minAreaSqft     Minimum polygon area to include
 */
export function measureImage(file, pixelsPerFoot = 10, minAreaSqft = 10) {
  const form = new FormData()
  form.append('file', file)
  const params = new URLSearchParams({ pixels_per_foot: pixelsPerFoot, min_area_sqft: minAreaSqft })
  return request('POST', `/api/v1/takeoff/measure?${params}`, form, true)
}

/**
 * Retrieve a Google Aerial View video URL for a street address.
 * @param {string} address  Street address
 */
export function getAerialView(address) {
  const params = new URLSearchParams({ address })
  return request('GET', `/api/v1/takeoff/aerial?${params}`)
}

/**
 * Analyze 811 + civil-tech utility locating data before digging.
 * @param {object} payload
 */
export function analyzeGroundScan(payload) {
  return request('POST', '/api/v1/takeoff/ground-scan', payload)
}

/**
 * Simulate pavement age decay for roads, parking lots, and driveways.
 * @param {object} payload
 */
export function simulatePavementDecay(payload) {
  return request('POST', '/api/v1/takeoff/pavement-decay', payload)
}

/**
 * Run the seven-module premium civil-tech stack.
 * @param {object} payload
 */
export function runPremiumCivilStack(payload) {
  return request('POST', '/api/v1/takeoff/premium-civil-stack', payload)
}
