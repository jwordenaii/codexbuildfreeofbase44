/**
 * Client-side ballpark pricing estimator — 50-state aware.
 *
 * Base rates use industry-standard cost ranges per square foot.
 * When a stateCode is supplied the estimate is adjusted using the
 * state's laborIndex and materialPremium from states50.js:
 *   multiplier = (laborIndex × 0.65) + (materialPremium × 0.35)
 *
 * Math basis (national baseline):
 *   Residential paving    $3.50 – $8.00 / sq ft
 *   Commercial paving     $2.50 – $6.00 / sq ft  (volume discount)
 *   Sealcoating           $0.15 – $0.35 / sq ft
 *   Crack filling         $0.40 – $1.00 / sq ft  (varies with crack density)
 *   Parking lot           $3.00 – $7.00 / sq ft
 *   Driveway              $3.50 – $7.50 / sq ft
 *   Maintenance plan      $0.20 – $0.45 / sq ft / year
 *
 * Returns { lowFmt, highFmt, disclaimer, stateNote? } or null.
 */
import { getPriceMultiplier, getStateSummary } from './states50'

const RATES = {
  paving: {
    residential: { low: 3.5, high: 8.0 },
    commercial: { low: 2.5, high: 6.0 },
    default: { low: 3.0, high: 7.0 },
  },
  sealcoating: {
    residential: { low: 0.15, high: 0.35 },
    commercial: { low: 0.12, high: 0.3 },
    default: { low: 0.12, high: 0.35 },
  },
  crackfill: {
    residential: { low: 0.4, high: 1.0 },
    commercial: { low: 0.35, high: 0.9 },
    default: { low: 0.4, high: 1.0 },
  },
  parking_lot: {
    residential: { low: 3.0, high: 7.0 },
    commercial: { low: 3.0, high: 7.0 },
    default: { low: 3.0, high: 7.0 },
  },
  driveway: {
    residential: { low: 3.5, high: 7.5 },
    commercial: { low: 3.0, high: 6.5 },
    default: { low: 3.5, high: 7.5 },
  },
  maintenance: {
    residential: { low: 0.2, high: 0.4 },
    commercial: { low: 0.18, high: 0.4 },
    default: { low: 0.2, high: 0.45 },
  },
  // General Contracting — GC fee as a cost-per-sqft proxy for managed construction
  // (actual cost is project-specific; these are ballpark managed-build figures)
  general_contracting: {
    residential: { low: 85.0, high: 250.0 },
    commercial: { low: 75.0, high: 200.0 },
    default: { low: 80.0, high: 225.0 },
  },
  // Interior Design — per sq ft of designed space (furnishings & materials excluded)
  interior_design: {
    residential: { low: 5.0, high: 18.0 },
    commercial: { low: 8.0, high: 25.0 },
    default: { low: 5.0, high: 20.0 },
  },
  // Cobblestone & Brick Paver Patios — installed sq ft
  cobblestone_pavers: {
    residential: { low: 15.0, high: 55.0 },
    commercial: { low: 18.0, high: 60.0 },
    default: { low: 15.0, high: 55.0 },
  },
  // Stone Masonry — installed sq ft of wall / patio surface
  stone_masonry: {
    residential: { low: 30.0, high: 85.0 },
    commercial: { low: 35.0, high: 100.0 },
    default: { low: 30.0, high: 90.0 },
  },
  // ── 3D Visualizer build types ─────────────────────────────────────────
  // New Construction — full build cost per sq ft (site, foundation, structure, finish)
  new_construction_residential: {
    residential: { low: 120.0, high: 320.0 },
    commercial: { low: 110.0, high: 280.0 },
    default: { low: 120.0, high: 320.0 },
  },
  // Addition / Remodel — per sq ft of new added/renovated space
  addition: {
    residential: { low: 90.0, high: 250.0 },
    commercial: { low: 100.0, high: 275.0 },
    default: { low: 90.0, high: 250.0 },
  },
  // ADU (Accessory Dwelling Unit) — detached or attached unit, turnkey
  adu: {
    residential: { low: 150.0, high: 400.0 },
    commercial: { low: 140.0, high: 350.0 },
    default: { low: 150.0, high: 400.0 },
  },
  // Commercial New Build — shell + TI per sq ft
  commercial_build: {
    residential: { low: 100.0, high: 260.0 },
    commercial: { low: 90.0, high: 240.0 },
    default: { low: 90.0, high: 260.0 },
  },
}

/** Format a dollar value: round to nearest $50 for clarity */
function roundToFifty(n) {
  return Math.round(n / 50) * 50
}

function fmt(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

/**
 * @param {string}      serviceType  — e.g. 'paving', 'sealcoating'
 * @param {string}      propertyType — 'residential' | 'commercial'
 * @param {number|null} sqft         — project size in square feet
 * @param {string|null} stateCode    — optional 2-letter state abbr for regional adjustment
 * @returns {{ lowFmt, highFmt, disclaimer, stateNote?, multiplier? } | null}
 */
export function estimatePrice(serviceType, propertyType, sqft, stateCode = null) {
  const service = serviceType?.toLowerCase()
  const property = propertyType?.toLowerCase()
  const area = parseFloat(sqft)

  if (!service || !RATES[service] || !area || area <= 0) return null

  const rates = RATES[service][property] ?? RATES[service].default

  // Apply 50-state regional multiplier when a valid stateCode is provided
  const multiplier = stateCode ? getPriceMultiplier(stateCode.toUpperCase()) : 1.0
  const rawLow = rates.low * area * multiplier
  const rawHigh = rates.high * area * multiplier

  const low = roundToFifty(rawLow)
  const high = roundToFifty(rawHigh)

  const clampedLow = Math.max(low, 250)
  const clampedHigh = Math.max(high, 500)

  // Build optional state-specific note
  let stateNote = null
  if (stateCode) {
    const summary = getStateSummary(stateCode.toUpperCase())
    if (summary) stateNote = summary.pricingNote
  }

  return {
    lowFmt: fmt(clampedLow),
    highFmt: fmt(clampedHigh),
    multiplier,
    stateNote,
    disclaimer:
      'Ballpark estimate only — final price depends on site conditions, ' +
      'material costs, and access. Free on-site quote always included.',
  }
}
