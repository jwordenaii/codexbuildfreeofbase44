/**
 * BuildConfigurator — customer-facing property build configuration panel.
 *
 * Lets the customer choose:
 *   • Build type  (driveway, parking lot, new construction, addition, ADU, commercial)
 *   • Exterior / paving material  (asphalt, concrete, cobblestone, pavers, etc.)
 *   • Structural material  (brick, stucco, Hardie-plank, etc.)  — for builds
 *   • Number of floors  — for structures
 *   • Square footage  — drives live pricing via estimatePrice()
 *   • Property type  (residential / commercial)
 *
 * Calls `onChange(config)` whenever any option changes so the parent page can
 * feed the updated config into PropertyVisualizer and recalculate the estimate.
 */
import { useEffect } from 'react'
import { estimatePrice } from '../lib/pricing'
import { STATE_OPTIONS } from '../lib/states50'

// ── Option lists ──────────────────────────────────────────────────────────────

const BUILD_TYPES = [
  { value: 'driveway', label: '🚗 Driveway', category: 'paving' },
  { value: 'parking_lot', label: '🏢 Parking Lot', category: 'paving' },
  { value: 'new_construction_residential', label: '🏠 New Home Build', category: 'structure' },
  { value: 'addition', label: '➕ Addition / Remodel', category: 'structure' },
  { value: 'adu', label: '🏡 ADU / Guest House', category: 'structure' },
  { value: 'commercial_build', label: '🏗 Commercial Build', category: 'structure' },
]

const PAVING_MATERIALS = [
  { value: 'asphalt', label: 'Asphalt', color: '#2d2d2d' },
  { value: 'concrete', label: 'Concrete', color: '#b0aca4' },
  { value: 'cobblestone', label: 'Cobblestone', color: '#7a6a58' },
  { value: 'pavers', label: 'Brick Pavers', color: '#c8a87a' },
  { value: 'gravel', label: 'Gravel', color: '#9a9080' },
]

const EXTERIOR_MATERIALS = [
  { value: 'brick', label: 'Brick', color: '#b5563c' },
  { value: 'stucco', label: 'Stucco', color: '#e8dcc8' },
  { value: 'hardieplank', label: 'Hardie-Plank', color: '#5a7fa0' },
  { value: 'vinyl', label: 'Vinyl Siding', color: '#e8e4dc' },
  { value: 'stone', label: 'Stone Veneer', color: '#7a7062' },
]

const ROOF_COLORS = [
  { value: '#4a4a4a', label: 'Charcoal' },
  { value: '#6b3b2a', label: 'Terra Cotta' },
  { value: '#2c4a2e', label: 'Forest Green' },
  { value: '#8b7355', label: 'Tan / Beige' },
  { value: '#1a2e4a', label: 'Slate Blue' },
]

const PROPERTY_TYPES = [
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
]

const FLOOR_OPTIONS = [1, 2, 3, 4]

const SIZE_PRESETS = {
  paving: [
    { label: 'Small driveway', sqft: 700 },
    { label: 'Large driveway', sqft: 1400 },
    { label: 'Small lot', sqft: 10000 },
    { label: 'Medium lot', sqft: 40000 },
  ],
  structure: [
    { label: 'Starter (1,000 sf)', sqft: 1000 },
    { label: 'Mid (1,800 sf)', sqft: 1800 },
    { label: 'Large (3,000 sf)', sqft: 3000 },
    { label: 'Estate (5,000 sf)', sqft: 5000 },
  ],
}

// ── Sub-components ────────────────────────────────────────────────────────────

function OptionButton({ active, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-2 px-3 rounded-lg text-sm font-medium border-2 transition-all ${
        active
          ? 'border-brand-amber bg-brand-amber/10 text-brand-navy'
          : 'border-gray-200 text-brand-navy/60 hover:border-brand-amber/50'
      } ${className}`}
    >
      {children}
    </button>
  )
}

function ColorSwatch({ color, label, active, onClick }) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
        active ? 'border-brand-amber scale-110 shadow-md' : 'border-gray-200'
      }`}
      style={{ backgroundColor: color }}
      aria-label={label}
    />
  )
}

function SectionLabel({ children }) {
  return <label className="block text-sm font-semibold text-brand-navy mb-2">{children}</label>
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BuildConfigurator({ config, onChange }) {
  const {
    buildType = 'driveway',
    sqft = 2000,
    propertyType = 'residential',
    groundMaterial = 'asphalt',
    exteriorMaterial = 'brick',
    roofColor = '#4a4a4a',
    floors = 1,
    stateCode = '',
  } = config

  const selectedBuild = BUILD_TYPES.find((b) => b.value === buildType) ?? BUILD_TYPES[0]
  const isStructure = selectedBuild.category === 'structure'
  const presets = isStructure ? SIZE_PRESETS.structure : SIZE_PRESETS.paving

  // Resolve effective service type for pricing (structures use buildType directly)
  const pricingService = buildType

  const estimate = estimatePrice(pricingService, propertyType, sqft, stateCode || null)

  // Notify parent whenever any config key changes
  const update = (patch) => onChange({ ...config, ...patch })

  // Reset material to sensible default when build category flips
  useEffect(() => {
    if (isStructure && !EXTERIOR_MATERIALS.find((m) => m.value === exteriorMaterial)) {
      update({ exteriorMaterial: 'brick' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStructure])

  return (
    <div className="space-y-5">
      {/* ── Build Type ──────────────────────────────────────────────────── */}
      <div>
        <SectionLabel>Build Type</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {BUILD_TYPES.map((bt) => (
            <OptionButton
              key={bt.value}
              active={buildType === bt.value}
              onClick={() => update({ buildType: bt.value })}
            >
              {bt.label}
            </OptionButton>
          ))}
        </div>
      </div>

      {/* ── Property Type ───────────────────────────────────────────────── */}
      <div>
        <SectionLabel>Property Type</SectionLabel>
        <div className="flex gap-3">
          {PROPERTY_TYPES.map((p) => (
            <OptionButton
              key={p.value}
              active={propertyType === p.value}
              onClick={() => update({ propertyType: p.value })}
              className="flex-1"
            >
              {p.label}
            </OptionButton>
          ))}
        </div>
      </div>

      {/* ── Square Footage ──────────────────────────────────────────────── */}
      <div>
        <SectionLabel>Project Size (sq ft)</SectionLabel>
        <div className="flex flex-wrap gap-2 mb-2">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => update({ sqft: p.sqft })}
              className="text-xs bg-gray-100 text-brand-navy/60 hover:bg-brand-amber/10 hover:text-brand-navy px-3 py-1.5 rounded-full transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
        <input
          type="number"
          min="100"
          value={sqft}
          onChange={(e) => update({ sqft: Math.max(100, parseInt(e.target.value, 10) || 100) })}
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-amber/50"
        />
      </div>

      {/* ── Paving Material (paving builds) ─────────────────────────────── */}
      {!isStructure && (
        <div>
          <SectionLabel>Paving / Ground Material</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {PAVING_MATERIALS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => update({ groundMaterial: m.value })}
                className={`flex items-center gap-2 py-1.5 px-3 rounded-full text-sm border-2 transition-all ${
                  groundMaterial === m.value
                    ? 'border-brand-amber bg-brand-amber/10 text-brand-navy'
                    : 'border-gray-200 text-brand-navy/60 hover:border-brand-amber/40'
                }`}
              >
                <span
                  className="w-4 h-4 rounded-full flex-shrink-0 border border-white/50"
                  style={{ backgroundColor: m.color }}
                />
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Exterior Material (structure builds) ────────────────────────── */}
      {isStructure && (
        <>
          <div>
            <SectionLabel>Exterior Finish</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {EXTERIOR_MATERIALS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => update({ exteriorMaterial: m.value })}
                  className={`flex items-center gap-2 py-1.5 px-3 rounded-full text-sm border-2 transition-all ${
                    exteriorMaterial === m.value
                      ? 'border-brand-amber bg-brand-amber/10 text-brand-navy'
                      : 'border-gray-200 text-brand-navy/60 hover:border-brand-amber/40'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full flex-shrink-0 border border-white/50"
                    style={{ backgroundColor: m.color }}
                  />
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <SectionLabel>Roof Color</SectionLabel>
            <div className="flex gap-2 flex-wrap">
              {ROOF_COLORS.map((rc) => (
                <div key={rc.value} className="flex flex-col items-center gap-1">
                  <ColorSwatch
                    color={rc.value}
                    label={rc.label}
                    active={roofColor === rc.value}
                    onClick={() => update({ roofColor: rc.value })}
                  />
                  <span className="text-[10px] text-brand-navy/50">{rc.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <SectionLabel>Stories / Floors</SectionLabel>
            <div className="flex gap-2">
              {FLOOR_OPTIONS.map((f) => (
                <OptionButton
                  key={f}
                  active={floors === f}
                  onClick={() => update({ floors: f })}
                  className="flex-1"
                >
                  {f}
                </OptionButton>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── State selector ──────────────────────────────────────────────── */}
      <div>
        <SectionLabel>
          State{' '}
          <span className="font-normal text-brand-navy/40">(optional — refines estimate)</span>
        </SectionLabel>
        <select
          value={stateCode}
          onChange={(e) => update({ stateCode: e.target.value })}
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-amber/50"
        >
          <option value="">Select a state…</option>
          {STATE_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* ── Live Estimate ────────────────────────────────────────────────── */}
      <div className="rounded-xl bg-brand-amber/10 border border-brand-amber/30 p-4">
        <div className="text-brand-navy/60 text-xs font-semibold uppercase tracking-wide mb-1 text-center">
          Live Estimate
        </div>
        {estimate ? (
          <>
            <div className="font-display font-black text-brand-navy text-2xl text-center">
              {estimate.lowFmt} – {estimate.highFmt}
            </div>
            {estimate.stateNote && (
              <div className="text-brand-navy/50 text-xs text-center mt-1">
                {estimate.stateNote}
              </div>
            )}
            <p className="text-brand-navy/40 text-[11px] text-center mt-2 leading-relaxed">
              {estimate.disclaimer}
            </p>
          </>
        ) : (
          <div className="text-brand-navy/40 text-sm text-center py-1">
            Enter a project size to see an estimate
          </div>
        )}
      </div>
    </div>
  )
}
