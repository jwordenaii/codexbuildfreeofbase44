/**
 * StateCompare — side-by-side comparison of 2–3 states across licensing,
 * lien law, prompt payment, utilities, permits, safety, prevailing wage,
 * roads, and environmental.
 *
 * Data is loaded dynamically when the user clicks "Compare" to keep the
 * initial bundle small.
 */
import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import SchemaMarkup from '../../components/SchemaMarkup'
import DisclaimerBanner from '../../components/advisory/DisclaimerBanner'
import StateComparison from '../../components/advisory/StateComparison'
import StateSelector from '../../components/advisory/StateSelector'
import states from '../../data/legal/states'

const CATEGORY_OPTIONS = [
  {
    id: 'licensing',
    label: '📋 Licensing',
    loader: () => import('../../data/legal/constructionLicensing'),
  },
  {
    id: 'liens',
    label: '⚖️ Mechanics Liens',
    loader: () => import('../../data/legal/mechanicsLienLaws'),
  },
  {
    id: 'payment',
    label: '💳 Prompt Payment',
    loader: () => import('../../data/legal/promptPaymentLaws'),
  },
  {
    id: 'utilities',
    label: '🔌 Utilities / 811',
    loader: () => import('../../data/legal/utilitiesOneCall'),
  },
  {
    id: 'permits',
    label: '🏗️ Building Permits',
    loader: () => import('../../data/legal/buildingPermits'),
  },
  { id: 'safety', label: '🦺 OSHA Safety', loader: () => import('../../data/legal/workersSafety') },
  {
    id: 'prevwage',
    label: '💰 Prevailing Wage',
    loader: () => import('../../data/legal/prevailingWage'),
  },
  {
    id: 'roads',
    label: '🛣️ Roads & Paving',
    loader: () => import('../../data/legal/roadsAndPavingRegulations'),
  },
  {
    id: 'env',
    label: '🌱 Environmental',
    loader: () => import('../../data/legal/environmentalPermits'),
  },
]

// Field definitions per category
const FIELDS = {
  licensing: [
    {
      label: 'License Required',
      key: 'stateLicenseRequired',
      render: (v) => (v == null ? '—' : v ? 'Yes' : 'No'),
    },
    {
      label: 'License Classes',
      key: 'licenseClasses',
      render: (v) => (Array.isArray(v) ? v.join(', ') : v || '—'),
    },
    {
      label: 'Bond (Residential)',
      key: 'bondMinResidential',
      render: (v) => (v ? `$${v.toLocaleString()}` : '—'),
    },
    {
      label: 'Bond (Commercial)',
      key: 'bondMinCommercial',
      render: (v) => (v ? `$${v.toLocaleString()}` : '—'),
    },
    {
      label: 'GL Insurance Min',
      key: 'glInsuranceMin',
      render: (v) => (v ? `$${v.toLocaleString()}` : '—'),
    },
    {
      label: 'Workers Comp Req.',
      key: 'workersCompRequired',
      render: (v) => (v == null ? '—' : v ? 'Yes' : 'No'),
    },
    {
      label: 'License Renewal',
      key: 'licenseRenewalYears',
      render: (v) => (v ? `Every ${v} yr(s)` : '—'),
    },
    { label: 'CE Hours', key: 'ceHoursRequired', render: (v) => v ?? '—' },
    {
      label: 'Reciprocity States',
      key: 'reciprocityStates',
      render: (v) => (Array.isArray(v) ? v.join(', ') || 'None' : v || '—'),
    },
  ],
  liens: [
    {
      label: 'Prelim. Notice Req.',
      key: 'preliminaryNoticeRequired',
      render: (v) => (v == null ? '—' : v ? 'Yes' : 'No'),
    },
    { label: 'Prelim. Deadline', key: 'preliminaryNoticeDeadline', render: (v) => v || '—' },
    {
      label: 'Lien Filing (days)',
      key: 'lienFilingDeadlineDays',
      render: (v) => (v ? `${v} days` : '—'),
    },
    {
      label: 'Foreclosure (days)',
      key: 'lienForeClosureDeadlineDays',
      render: (v) => (v ? `${v} days` : '—'),
    },
    {
      label: 'Notice of Intent',
      key: 'noticeOfIntentRequired',
      render: (v) => (v == null ? '—' : v ? 'Yes' : 'No'),
    },
  ],
  payment: [
    { label: 'Owner → GC (days)', key: 'ownerToGcDays', render: (v) => (v ? `${v} days` : '—') },
    { label: 'GC → Sub (days)', key: 'gcToSubDays', render: (v) => (v ? `${v} days` : '—') },
    { label: 'Retainage Max', key: 'retainageMaxPercent', render: (v) => (v ? `${v}%` : '—') },
    { label: 'Pay-if-Paid', key: 'payIfPaidEnforceable', render: (v) => v || '—' },
    {
      label: 'Public Covered',
      key: 'publicProjectsCovered',
      render: (v) => (v == null ? '—' : v ? 'Yes' : 'No'),
    },
  ],
  utilities: [
    { label: '811 Center', key: 'oneCallCenterName', render: (v) => v || '—' },
    { label: 'Notice Period', key: 'noticePeriodNote', render: (v) => v || '—' },
    { label: 'Tolerance Zone', key: 'toleranceZoneInches', render: (v) => (v ? `±${v}"` : '—') },
    {
      label: 'White-Line Req.',
      key: 'whiteLiningRequired',
      render: (v) => (v == null ? '—' : v ? 'Yes' : 'No'),
    },
    { label: 'Civil Penalty', key: 'penaltyCivil', render: (v) => v || '—' },
  ],
  permits: [
    { label: 'IBC Edition', key: 'ibcEditionAdopted', render: (v) => v || '—' },
    { label: 'NEC Edition', key: 'necEditionAdopted', render: (v) => v || '—' },
    {
      label: 'Statewide Code',
      key: 'statewideBuildingCode',
      render: (v) => (v == null ? '—' : v ? 'Yes' : 'No'),
    },
    {
      label: 'Local Amendments',
      key: 'localAmendmentsAllowed',
      render: (v) => (v == null ? '—' : v ? 'Yes' : 'No'),
    },
    {
      label: '3rd-Party Inspection',
      key: 'thirdPartyInspectionAllowed',
      render: (v) => (v == null ? '—' : v ? 'Yes' : 'No'),
    },
  ],
  safety: [
    {
      label: 'State OSHA Plan',
      key: 'statePlanState',
      render: (v) => (v == null ? '—' : v ? 'Yes' : 'No'),
    },
    { label: 'Plan Agency', key: 'oshAuthority', render: (v) => v || '—' },
    {
      label: 'Fall Protection Thresh.',
      key: 'fallProtectionThresholdFt',
      render: (v) => (v ? `${v} ft` : '—'),
    },
    {
      label: 'Workers Comp Req.',
      key: 'workerCompProgramRequired',
      render: (v) => (v == null ? '—' : v ? 'Yes' : 'No'),
    },
    {
      label: 'Public Sector Only',
      key: 'publicSectorOnly',
      render: (v) => (v == null ? '—' : v ? 'Yes' : 'No'),
    },
  ],
  prevwage: [
    {
      label: 'State PW Law',
      key: 'prevailingWageLaw',
      render: (v) => (v == null ? '—' : v ? 'Yes' : 'No'),
    },
    { label: 'Law Scope', key: 'lawScope', render: (v) => v || '—' },
    { label: 'Coverage Threshold', key: 'thresholdForPublicWorks', render: (v) => v || '—' },
    { label: 'Administered By', key: 'administeredBy', render: (v) => v || '—' },
    {
      label: 'Davis-Bacon Applies',
      key: 'davisBaconApplies',
      render: (v) => (v == null ? '—' : v ? 'Yes' : 'No'),
    },
  ],
  roads: [
    { label: 'DOT Specs Pub.', key: 'dotSpecsPublication', render: (v) => v || '—' },
    { label: 'Mix Design Standard', key: 'mixDesignStandard', render: (v) => v || '—' },
    {
      label: 'Compaction Density',
      key: 'compactionDensityPercent',
      render: (v) => (v ? `${v}%` : '—'),
    },
    { label: 'HMA Min Temp (°F)', key: 'hmaMinLaydownTempF', render: (v) => (v ? `${v}°F` : '—') },
    {
      label: 'PROWAG Adopted',
      key: 'prowagAdopted',
      render: (v) => (v == null ? '—' : v ? 'Yes' : 'No'),
    },
  ],
  env: [
    { label: 'NPDES Authority', key: 'npdesAuthority', render: (v) => v || '—' },
    {
      label: 'Land Disturbance',
      key: 'landDisturbanceThresholdAcres',
      render: (v) => (v ? `${v} acre(s)` : '—'),
    },
    {
      label: 'SWPPP Required',
      key: 'swpppRequired',
      render: (v) => (v == null ? '—' : v ? 'Yes' : 'No'),
    },
    { label: 'Wetland Setback', key: 'wetlandSetbackFt', render: (v) => (v ? `${v} ft` : '—') },
    { label: 'State Env Agency', key: 'stateEnvAgency', render: (v) => v || '—' },
  ],
}

export default function StateCompare() {
  const [picks, setPicks] = useState([null, null, null])
  const [category, setCategory] = useState('licensing')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const dataCache = useRef({})

  const selectedAbbrs = picks.filter(Boolean)

  const setPick = (index, val) => {
    setPicks((prev) => {
      const next = [...prev]
      next[index] = val
      return next
    })
    setResult(null)
  }

  const handleCompare = async () => {
    if (selectedAbbrs.length < 2) return
    const cat = CATEGORY_OPTIONS.find((c) => c.id === category)
    if (!cat) return

    setLoading(true)
    try {
      let dataset
      if (dataCache.current[category]) {
        dataset = dataCache.current[category]
      } else {
        const mod = await cat.loader()
        dataset = mod.default
        dataCache.current[category] = dataset
      }
      const stateRows = selectedAbbrs.map((abbr) => {
        const stateInfo = states.find((s) => s.abbr === abbr) || {}
        const legalRow = dataset.find((r) => r.abbr === abbr) || {}
        return { ...stateInfo, ...legalRow }
      })
      setResult({ rows: stateRows, catId: category })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <SchemaMarkup
        title="Compare Construction Law by State — JWordenAI Advisory"
        description="Side-by-side comparison of contractor licensing, lien laws, utilities, OSHA safety, permits, and more across any 2–3 US states."
        canonical="/advisory/compare"
        breadcrumb={[
          { name: 'Home', path: '/' },
          { name: 'Advisory Board', path: '/advisory' },
          { name: 'Compare States', path: '/advisory/compare' },
        ]}
      />

      <div className="bg-brand-navy pt-32 pb-16 text-white text-center">
        <div className="max-w-4xl mx-auto px-4">
          <Link to="/advisory" className="text-brand-amber text-sm hover:underline">
            ← Advisory Board
          </Link>
          <h1 className="font-display font-black text-5xl mt-3 mb-3">
            ⚖️ Compare <span className="text-brand-amber">States</span>
          </h1>
          <p className="text-white/70 text-lg">
            Side-by-side construction law comparison for any 2–3 states.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <DisclaimerBanner />

        {/* Controls */}
        <div className="card p-6 space-y-6">
          <h2 className="font-display font-bold text-brand-navy text-xl">Build Your Comparison</h2>

          {/* State pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {picks.map((val, i) => (
              <div key={i}>
                <label className="block text-xs font-semibold text-brand-navy/60 uppercase tracking-wide mb-1.5">
                  State {i + 1}
                  {i === 0 || i === 1 ? ' *' : ' (optional)'}
                </label>
                <StateSelector value={val} onChange={(abbr) => setPick(i, abbr)} />
              </div>
            ))}
          </div>

          {/* Category picker */}
          <div>
            <label className="block text-xs font-semibold text-brand-navy/60 uppercase tracking-wide mb-2">
              Category to Compare
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setCategory(cat.id)
                    setResult(null)
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    category === cat.id
                      ? 'bg-brand-amber text-brand-navy'
                      : 'bg-brand-navy/5 text-brand-navy hover:bg-brand-navy/10'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleCompare}
              disabled={selectedAbbrs.length < 2 || loading}
              className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading…' : 'Compare States →'}
            </button>
          </div>
        </div>

        {/* Results */}
        {result && result.catId === category && (
          <div className="space-y-4">
            <h2 className="font-display font-bold text-brand-navy text-xl">
              {CATEGORY_OPTIONS.find((c) => c.id === category)?.label} — Comparison
            </h2>
            <StateComparison
              states={result.rows}
              fields={FIELDS[category] || []}
              title={`${CATEGORY_OPTIONS.find((c) => c.id === category)?.label} — ${result.rows.map((r) => r.abbr).join(' vs ')}`}
            />
            <div className="flex flex-wrap gap-3 pt-2">
              {result.rows.map((r) => (
                <Link
                  key={r.abbr}
                  to={`/advisory/state/${r.abbr}`}
                  className="text-brand-amber text-sm hover:underline"
                >
                  View full {r.state} profile →
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Empty state hint */}
        {!result && (
          <div className="text-center text-brand-navy/40 py-12 text-sm">
            Select 2–3 states and a category above, then click <strong>Compare States</strong>.
          </div>
        )}
      </div>
    </>
  )
}
