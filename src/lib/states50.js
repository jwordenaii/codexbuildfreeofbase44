/**
 * states50.js — Single canonical 50-state master data module.
 *
 * Every layer of the platform imports from here:
 *   - Pricing engine    (laborIndex × materialPremium)
 *   - Lead scoring      (qsrDensity, laborIndex)
 *   - Quote form        (state selector + live compliance notes)
 *   - Schema.org        (areaServed national coverage)
 *   - AI system prompt  (50-state context injection)
 *   - Advisory / legal  (hasPrevailingWage, hasStateLicensing, etc.)
 *   - Customer DB       (state field validation)
 *
 * Data sources:
 *   Compliance cols  → SupremeCourtAI._STATE_COMPLIANCE (ai_brain.py, mirrored here)
 *   laborIndex       → BLS Construction & Extraction Occupational Wages (2024)
 *   materialPremium  → NAPA/APA regional asphalt material cost indices (2024)
 *   asphaltMonths    → Industry consensus on good paving season length by climate
 *   qsrDensity       → QSR Magazine / Nation's Restaurant News restaurant count data
 *
 * lastVerified: 2026-04-25
 */

// prettier-ignore
const STATES = [
  // abbr | name                  | region        | laborIdx | matPrem | aspMonths | prevWage | stateLic | stateOsha | swpppAc | qsrDensity
  { abbr:'AL', name:'Alabama',        region:'Southeast',  laborIndex:0.82, materialPremium:0.92, asphaltMonths:9,  hasPrevailingWage:false, hasStateLicensing:true,  hasStateOsha:false, swpppAcres:1.0, qsrDensity:'medium' },
  { abbr:'AK', name:'Alaska',         region:'West',       laborIndex:1.40, materialPremium:1.35, asphaltMonths:4,  hasPrevailingWage:false, hasStateLicensing:false, hasStateOsha:true,  swpppAcres:1.0, qsrDensity:'low'    },
  { abbr:'AZ', name:'Arizona',        region:'Southwest',  laborIndex:0.92, materialPremium:0.96, asphaltMonths:10, hasPrevailingWage:false, hasStateLicensing:true,  hasStateOsha:true,  swpppAcres:1.0, qsrDensity:'medium' },
  { abbr:'AR', name:'Arkansas',       region:'Southeast',  laborIndex:0.80, materialPremium:0.91, asphaltMonths:8,  hasPrevailingWage:false, hasStateLicensing:true,  hasStateOsha:false, swpppAcres:1.0, qsrDensity:'medium' },
  { abbr:'CA', name:'California',     region:'West',       laborIndex:1.35, materialPremium:1.10, asphaltMonths:9,  hasPrevailingWage:true,  hasStateLicensing:true,  hasStateOsha:true,  swpppAcres:1.0, qsrDensity:'high'   },
  { abbr:'CO', name:'Colorado',       region:'West',       laborIndex:1.07, materialPremium:1.00, asphaltMonths:6,  hasPrevailingWage:false, hasStateLicensing:false, hasStateOsha:true,  swpppAcres:1.0, qsrDensity:'medium' },
  { abbr:'CT', name:'Connecticut',    region:'Northeast',  laborIndex:1.28, materialPremium:1.12, asphaltMonths:7,  hasPrevailingWage:true,  hasStateLicensing:true,  hasStateOsha:true,  swpppAcres:1.0, qsrDensity:'medium' },
  { abbr:'DE', name:'Delaware',       region:'Northeast',  laborIndex:1.03, materialPremium:1.02, asphaltMonths:8,  hasPrevailingWage:true,  hasStateLicensing:true,  hasStateOsha:true,  swpppAcres:1.0, qsrDensity:'low'    },
  { abbr:'FL', name:'Florida',        region:'Southeast',  laborIndex:0.90, materialPremium:0.95, asphaltMonths:11, hasPrevailingWage:false, hasStateLicensing:true,  hasStateOsha:false, swpppAcres:1.0, qsrDensity:'high'   },
  { abbr:'GA', name:'Georgia',        region:'Southeast',  laborIndex:0.87, materialPremium:0.93, asphaltMonths:9,  hasPrevailingWage:false, hasStateLicensing:true,  hasStateOsha:false, swpppAcres:1.0, qsrDensity:'high'   },
  { abbr:'HI', name:'Hawaii',         region:'West',       laborIndex:1.45, materialPremium:1.40, asphaltMonths:12, hasPrevailingWage:true,  hasStateLicensing:true,  hasStateOsha:true,  swpppAcres:1.0, qsrDensity:'low'    },
  { abbr:'ID', name:'Idaho',          region:'West',       laborIndex:0.88, materialPremium:0.97, asphaltMonths:6,  hasPrevailingWage:false, hasStateLicensing:true,  hasStateOsha:false, swpppAcres:1.0, qsrDensity:'low'    },
  { abbr:'IL', name:'Illinois',       region:'Midwest',    laborIndex:1.15, materialPremium:1.00, asphaltMonths:7,  hasPrevailingWage:true,  hasStateLicensing:false, hasStateOsha:true,  swpppAcres:1.0, qsrDensity:'high'   },
  { abbr:'IN', name:'Indiana',        region:'Midwest',    laborIndex:0.88, materialPremium:0.97, asphaltMonths:7,  hasPrevailingWage:false, hasStateLicensing:false, hasStateOsha:false, swpppAcres:1.0, qsrDensity:'medium' },
  { abbr:'IA', name:'Iowa',           region:'Midwest',    laborIndex:0.86, materialPremium:0.97, asphaltMonths:6,  hasPrevailingWage:false, hasStateLicensing:false, hasStateOsha:false, swpppAcres:1.0, qsrDensity:'medium' },
  { abbr:'KS', name:'Kansas',         region:'Midwest',    laborIndex:0.87, materialPremium:0.95, asphaltMonths:7,  hasPrevailingWage:false, hasStateLicensing:false, hasStateOsha:false, swpppAcres:1.0, qsrDensity:'medium' },
  { abbr:'KY', name:'Kentucky',       region:'Southeast',  laborIndex:0.86, materialPremium:0.95, asphaltMonths:8,  hasPrevailingWage:false, hasStateLicensing:true,  hasStateOsha:true,  swpppAcres:1.0, qsrDensity:'medium' },
  { abbr:'LA', name:'Louisiana',      region:'Southeast',  laborIndex:0.84, materialPremium:0.91, asphaltMonths:10, hasPrevailingWage:false, hasStateLicensing:true,  hasStateOsha:true,  swpppAcres:1.0, qsrDensity:'medium' },
  { abbr:'ME', name:'Maine',          region:'Northeast',  laborIndex:0.88, materialPremium:1.05, asphaltMonths:6,  hasPrevailingWage:false, hasStateLicensing:true,  hasStateOsha:false, swpppAcres:1.0, qsrDensity:'low'    },
  { abbr:'MD', name:'Maryland',       region:'Northeast',  laborIndex:1.12, materialPremium:1.02, asphaltMonths:8,  hasPrevailingWage:true,  hasStateLicensing:true,  hasStateOsha:true,  swpppAcres:1.0, qsrDensity:'high'   },
  { abbr:'MA', name:'Massachusetts',  region:'Northeast',  laborIndex:1.30, materialPremium:1.15, asphaltMonths:7,  hasPrevailingWage:true,  hasStateLicensing:true,  hasStateOsha:true,  swpppAcres:1.0, qsrDensity:'high'   },
  { abbr:'MI', name:'Michigan',       region:'Midwest',    laborIndex:0.95, materialPremium:0.97, asphaltMonths:6,  hasPrevailingWage:false, hasStateLicensing:true,  hasStateOsha:true,  swpppAcres:1.0, qsrDensity:'high'   },
  { abbr:'MN', name:'Minnesota',      region:'Midwest',    laborIndex:1.08, materialPremium:0.97, asphaltMonths:5,  hasPrevailingWage:true,  hasStateLicensing:false, hasStateOsha:true,  swpppAcres:1.0, qsrDensity:'medium' },
  { abbr:'MS', name:'Mississippi',    region:'Southeast',  laborIndex:0.78, materialPremium:0.90, asphaltMonths:9,  hasPrevailingWage:false, hasStateLicensing:true,  hasStateOsha:false, swpppAcres:1.0, qsrDensity:'medium' },
  { abbr:'MO', name:'Missouri',       region:'Midwest',    laborIndex:0.87, materialPremium:0.95, asphaltMonths:7,  hasPrevailingWage:false, hasStateLicensing:false, hasStateOsha:false, swpppAcres:1.0, qsrDensity:'medium' },
  { abbr:'MT', name:'Montana',        region:'West',       laborIndex:0.85, materialPremium:0.97, asphaltMonths:5,  hasPrevailingWage:false, hasStateLicensing:true,  hasStateOsha:false, swpppAcres:1.0, qsrDensity:'low'    },
  { abbr:'NE', name:'Nebraska',       region:'Midwest',    laborIndex:0.86, materialPremium:0.95, asphaltMonths:7,  hasPrevailingWage:false, hasStateLicensing:true,  hasStateOsha:false, swpppAcres:1.0, qsrDensity:'medium' },
  { abbr:'NV', name:'Nevada',         region:'West',       laborIndex:0.93, materialPremium:0.98, asphaltMonths:9,  hasPrevailingWage:false, hasStateLicensing:true,  hasStateOsha:true,  swpppAcres:0.25,qsrDensity:'medium' },
  { abbr:'NH', name:'New Hampshire',  region:'Northeast',  laborIndex:1.00, materialPremium:1.03, asphaltMonths:6,  hasPrevailingWage:false, hasStateLicensing:true,  hasStateOsha:false, swpppAcres:1.0, qsrDensity:'low'    },
  { abbr:'NJ', name:'New Jersey',     region:'Northeast',  laborIndex:1.25, materialPremium:1.12, asphaltMonths:7,  hasPrevailingWage:true,  hasStateLicensing:true,  hasStateOsha:true,  swpppAcres:1.0, qsrDensity:'high'   },
  { abbr:'NM', name:'New Mexico',     region:'Southwest',  laborIndex:0.83, materialPremium:0.95, asphaltMonths:9,  hasPrevailingWage:false, hasStateLicensing:true,  hasStateOsha:true,  swpppAcres:1.0, qsrDensity:'low'    },
  { abbr:'NY', name:'New York',       region:'Northeast',  laborIndex:1.38, materialPremium:1.18, asphaltMonths:7,  hasPrevailingWage:true,  hasStateLicensing:false, hasStateOsha:true,  swpppAcres:1.0, qsrDensity:'high'   },
  { abbr:'NC', name:'North Carolina', region:'Southeast',  laborIndex:0.88, materialPremium:0.93, asphaltMonths:8,  hasPrevailingWage:false, hasStateLicensing:true,  hasStateOsha:false, swpppAcres:1.0, qsrDensity:'high'   },
  { abbr:'ND', name:'North Dakota',   region:'Midwest',    laborIndex:0.88, materialPremium:0.97, asphaltMonths:5,  hasPrevailingWage:false, hasStateLicensing:true,  hasStateOsha:false, swpppAcres:1.0, qsrDensity:'low'    },
  { abbr:'OH', name:'Ohio',           region:'Midwest',    laborIndex:0.95, materialPremium:0.97, asphaltMonths:7,  hasPrevailingWage:false, hasStateLicensing:false, hasStateOsha:true,  swpppAcres:1.0, qsrDensity:'high'   },
  { abbr:'OK', name:'Oklahoma',       region:'South',      laborIndex:0.83, materialPremium:0.91, asphaltMonths:8,  hasPrevailingWage:false, hasStateLicensing:true,  hasStateOsha:false, swpppAcres:1.0, qsrDensity:'medium' },
  { abbr:'OR', name:'Oregon',         region:'West',       laborIndex:1.10, materialPremium:1.06, asphaltMonths:8,  hasPrevailingWage:true,  hasStateLicensing:true,  hasStateOsha:true,  swpppAcres:1.0, qsrDensity:'medium' },
  { abbr:'PA', name:'Pennsylvania',   region:'Northeast',  laborIndex:1.05, materialPremium:1.01, asphaltMonths:7,  hasPrevailingWage:true,  hasStateLicensing:false, hasStateOsha:true,  swpppAcres:1.0, qsrDensity:'high'   },
  { abbr:'RI', name:'Rhode Island',   region:'Northeast',  laborIndex:1.03, materialPremium:1.06, asphaltMonths:7,  hasPrevailingWage:true,  hasStateLicensing:true,  hasStateOsha:true,  swpppAcres:0.5, qsrDensity:'low'    },
  { abbr:'SC', name:'South Carolina', region:'Southeast',  laborIndex:0.85, materialPremium:0.92, asphaltMonths:9,  hasPrevailingWage:false, hasStateLicensing:true,  hasStateOsha:true,  swpppAcres:1.0, qsrDensity:'medium' },
  { abbr:'SD', name:'South Dakota',   region:'Midwest',    laborIndex:0.83, materialPremium:0.95, asphaltMonths:5,  hasPrevailingWage:false, hasStateLicensing:true,  hasStateOsha:false, swpppAcres:1.0, qsrDensity:'low'    },
  { abbr:'TN', name:'Tennessee',      region:'Southeast',  laborIndex:0.85, materialPremium:0.93, asphaltMonths:8,  hasPrevailingWage:false, hasStateLicensing:true,  hasStateOsha:true,  swpppAcres:1.0, qsrDensity:'medium' },
  { abbr:'TX', name:'Texas',          region:'South',      laborIndex:0.92, materialPremium:0.93, asphaltMonths:10, hasPrevailingWage:false, hasStateLicensing:false, hasStateOsha:false, swpppAcres:1.0, qsrDensity:'high'   },
  { abbr:'UT', name:'Utah',           region:'West',       laborIndex:0.92, materialPremium:0.96, asphaltMonths:7,  hasPrevailingWage:false, hasStateLicensing:true,  hasStateOsha:true,  swpppAcres:1.0, qsrDensity:'medium' },
  { abbr:'VT', name:'Vermont',        region:'Northeast',  laborIndex:0.90, materialPremium:1.05, asphaltMonths:6,  hasPrevailingWage:true,  hasStateLicensing:true,  hasStateOsha:true,  swpppAcres:0.5, qsrDensity:'low'    },
  { abbr:'VA', name:'Virginia',       region:'Southeast',  laborIndex:0.97, materialPremium:0.95, asphaltMonths:8,  hasPrevailingWage:true,  hasStateLicensing:true,  hasStateOsha:true,  swpppAcres:1.0, qsrDensity:'high'   },
  { abbr:'WA', name:'Washington',     region:'West',       laborIndex:1.22, materialPremium:1.08, asphaltMonths:7,  hasPrevailingWage:true,  hasStateLicensing:true,  hasStateOsha:true,  swpppAcres:0.2, qsrDensity:'medium' },
  { abbr:'WV', name:'West Virginia',  region:'Southeast',  laborIndex:0.82, materialPremium:0.93, asphaltMonths:7,  hasPrevailingWage:false, hasStateLicensing:true,  hasStateOsha:true,  swpppAcres:1.0, qsrDensity:'low'    },
  { abbr:'WI', name:'Wisconsin',      region:'Midwest',    laborIndex:0.93, materialPremium:0.97, asphaltMonths:6,  hasPrevailingWage:false, hasStateLicensing:false, hasStateOsha:true,  swpppAcres:1.0, qsrDensity:'medium' },
  { abbr:'WY', name:'Wyoming',        region:'West',       laborIndex:0.88, materialPremium:0.97, asphaltMonths:5,  hasPrevailingWage:false, hasStateLicensing:true,  hasStateOsha:false, swpppAcres:1.0, qsrDensity:'low'    },
  { abbr:'DC', name:'Washington DC',  region:'Northeast',  laborIndex:1.35, materialPremium:1.05, asphaltMonths:8,  hasPrevailingWage:true,  hasStateLicensing:true,  hasStateOsha:true,  swpppAcres:1.0, qsrDensity:'high'   },
]

// ── Lookup helpers ─────────────────────────────────────────────────────────────

/** O(1) lookup by abbreviation */
export const STATE_MAP = Object.fromEntries(STATES.map(s => [s.abbr, s]))

/** Sorted option list for <select> elements */
export const STATE_OPTIONS = STATES.map(s => ({ value: s.abbr, label: `${s.name} (${s.abbr})` }))

/** States where J. Worden & Sons has verified completed work */
export const WORDEN_ACTIVE_STATES = [
  'VA','NC','GA','FL','MI','TX','KS','MO','IA','MN','NY','NJ',
]

/**
 * Returns state-adjusted pricing multiplier.
 * combined = (laborIndex * 0.65) + (materialPremium * 0.35)
 * i.e. 65% of cost variance is labor, 35% is material
 */
export function getPriceMultiplier(abbr) {
  const s = STATE_MAP[abbr]
  if (!s) return 1.0
  return (s.laborIndex * 0.65) + (s.materialPremium * 0.35)
}

/**
 * Returns a plain-English compliance summary for a given state.
 * Used by Quote form and AI system prompt.
 */
export function getStateSummary(abbr) {
  const s = STATE_MAP[abbr]
  if (!s) return null
  const notes = []
  if (s.hasStateLicensing)    notes.push('State contractor license required')
  if (s.hasPrevailingWage)    notes.push('Prevailing wage law applies to public work')
  if (s.hasStateOsha)         notes.push('State OSHA plan (may exceed federal)')
  if (s.swpppAcres < 1.0)     notes.push(`SWPPP required for disturbances ≥ ${s.swpppAcres} acre`)
  return {
    ...s,
    priceMultiplier: getPriceMultiplier(abbr),
    complianceNotes: notes,
    pricingNote: getPriceMultiplier(abbr) > 1.05
      ? `Labor and material costs in ${s.name} run above the national average.`
      : getPriceMultiplier(abbr) < 0.90
      ? `${s.name} has below-average labor costs — favorable for project budgets.`
      : `${s.name} is near the national average for paving costs.`,
    seasonNote: s.asphaltMonths >= 10
      ? 'Year-round paving favorable.'
      : s.asphaltMonths <= 5
      ? `Limited paving season (~${s.asphaltMonths} months). Schedule early.`
      : `Paving season approx. ${s.asphaltMonths} months.`,
  }
}

/**
 * Returns a compact AI prompt fragment for a state, injected into
 * the JWordenAI system prompt for state-specific conversations.
 */
export function getStatePromptFragment(abbr) {
  const s = getStateSummary(abbr)
  if (!s) return ''
  return (
    `[${abbr} context: ` +
    `License required: ${s.hasStateLicensing ? 'YES' : 'NO'}, ` +
    `Prevailing wage: ${s.hasPrevailingWage ? 'YES (public work)' : 'NO'}, ` +
    `State OSHA: ${s.hasStateOsha ? 'YES' : 'NO'}, ` +
    `SWPPP threshold: ${s.swpppAcres} ac, ` +
    `Price index: ${getPriceMultiplier(abbr).toFixed(2)}x national avg, ` +
    `Season: ${s.asphaltMonths} months, ` +
    `QSR density: ${s.qsrDensity}]`
  )
}

export default STATES
