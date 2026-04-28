/**
 * ContractorRanker — Contractor Quality Ranking page.
 *
 * Three sections:
 *   1. Bid Comparison — input multiple contractor bids and rank them by
 *      price, licensing, bonding, experience, and compliance.
 *   2. State License Optimizer — rank all 50 states by how beneficial a
 *      contractor license there is (reciprocity × scope × low bond).
 *   3. Lien Law Leverage — rank states by how strong a contractor's lien
 *      rights are, for choosing contract jurisdiction.
 *
 * Route: /advisory/contractor-ranker
 */
import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import SchemaMarkup from '../../components/SchemaMarkup'
import DisclaimerBanner from '../../components/advisory/DisclaimerBanner'
import {
  rankContractorBids,
  optimizeLicenseStates,
  getLienLeverageByState,
} from '../../lib/contractorRanker'

// ── Score bar helper ──────────────────────────────────────────────────────────

function MiniBar({ score, max = 100 }) {
  const pct = Math.round((score / max) * 100)
  const color = pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-brand-navy/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-brand-navy/60 w-6 text-right">{score}</span>
    </div>
  )
}

function RankBadge({ label }) {
  const cls =
    label === 'BEST VALUE'
      ? 'bg-green-100 text-green-800 border-green-200'
      : label === 'STRONG'
        ? 'bg-blue-100 text-blue-800 border-blue-200'
        : label === 'ACCEPTABLE'
          ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
          : 'bg-red-100 text-red-800 border-red-200'
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border ${cls}`}>
      {label}
    </span>
  )
}

// ── Default blank bid ─────────────────────────────────────────────────────────

const BLANK_BID = {
  name: '',
  bidAmount: '',
  licenseState: '',
  licenseClasses: '',
  bondAmount: '',
  yearsExperience: '',
  hasInsurance: true,
  workersComp: true,
  notes: '',
}

// ── Bid input form ────────────────────────────────────────────────────────────

function BidForm({ bid, index, onChange, onRemove }) {
  const update = (field, value) => onChange(index, { ...bid, [field]: value })

  return (
    <div className="bg-brand-navy/5 rounded-xl p-4 space-y-3 relative">
      <div className="flex items-start justify-between gap-2">
        <span className="font-bold text-brand-navy text-sm">Contractor #{index + 1}</span>
        {index > 0 && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="text-xs text-red-500 hover:text-red-700 font-medium"
          >
            Remove
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-brand-navy/70 mb-1">
            Company Name *
          </label>
          <input
            type="text"
            value={bid.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Acme Paving Co."
            className="w-full px-3 py-2 text-sm border border-brand-navy/20 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-amber"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-brand-navy/70 mb-1">
            Bid Amount ($) *
          </label>
          <input
            type="number"
            value={bid.bidAmount}
            onChange={(e) => update('bidAmount', e.target.value)}
            placeholder="85000"
            min="0"
            className="w-full px-3 py-2 text-sm border border-brand-navy/20 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-amber"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-brand-navy/70 mb-1">License State</label>
          <input
            type="text"
            value={bid.licenseState}
            onChange={(e) => update('licenseState', e.target.value.toUpperCase().slice(0, 2))}
            placeholder="CA"
            maxLength={2}
            className="w-full px-3 py-2 text-sm border border-brand-navy/20 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-amber uppercase"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-brand-navy/70 mb-1">
            License Classes
          </label>
          <input
            type="text"
            value={bid.licenseClasses}
            onChange={(e) => update('licenseClasses', e.target.value)}
            placeholder="Class A, Class B"
            className="w-full px-3 py-2 text-sm border border-brand-navy/20 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-amber"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-brand-navy/70 mb-1">
            Surety Bond ($)
          </label>
          <input
            type="number"
            value={bid.bondAmount}
            onChange={(e) => update('bondAmount', e.target.value)}
            placeholder="50000"
            min="0"
            className="w-full px-3 py-2 text-sm border border-brand-navy/20 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-amber"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-brand-navy/70 mb-1">
            Years in Business
          </label>
          <input
            type="number"
            value={bid.yearsExperience}
            onChange={(e) => update('yearsExperience', e.target.value)}
            placeholder="10"
            min="0"
            className="w-full px-3 py-2 text-sm border border-brand-navy/20 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-amber"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-4 pt-1">
        <label className="flex items-center gap-2 text-xs font-medium text-brand-navy cursor-pointer">
          <input
            type="checkbox"
            checked={bid.hasInsurance}
            onChange={(e) => update('hasInsurance', e.target.checked)}
            className="accent-brand-amber"
          />
          General Liability Insurance
        </label>
        <label className="flex items-center gap-2 text-xs font-medium text-brand-navy cursor-pointer">
          <input
            type="checkbox"
            checked={bid.workersComp}
            onChange={(e) => update('workersComp', e.target.checked)}
            className="accent-brand-amber"
          />
          Workers Comp
        </label>
      </div>
    </div>
  )
}

// ── Ranked results table ──────────────────────────────────────────────────────

function RankedResults({ results }) {
  if (!results || results.length === 0) return null
  return (
    <div className="space-y-4">
      {results.map((r) => (
        <div
          key={r.rank}
          className={`card p-5 border-l-4 ${
            r.rankColor === 'green'
              ? 'border-green-500'
              : r.rankColor === 'blue'
                ? 'border-blue-500'
                : r.rankColor === 'yellow'
                  ? 'border-yellow-400'
                  : 'border-red-400'
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl font-black text-brand-navy/30">#{r.rank}</span>
                <span className="font-display font-bold text-brand-navy text-lg">{r.name}</span>
                <RankBadge label={r.rankLabel} />
              </div>
              <p className="text-sm text-brand-navy/70">{r.recommendation}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-brand-navy">
                ${Number(r.bidAmount).toLocaleString()}
              </div>
              <div className="text-xs text-brand-navy/50">bid amount</div>
            </div>
          </div>

          {/* Score bars */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
            {[
              { label: 'Bid Value', key: 'bid' },
              { label: 'License', key: 'license' },
              { label: 'Bond', key: 'bond' },
              { label: 'Experience', key: 'experience' },
              { label: 'Compliance', key: 'compliance' },
            ].map(({ label, key }) => (
              <div key={key}>
                <div className="text-xs font-medium text-brand-navy/60 mb-1">{label}</div>
                <MiniBar score={r.scores[key]} />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-brand-navy/60">
              Composite Score:{' '}
              <span className="text-brand-navy text-sm">{r.scores.composite}/100</span>
            </div>
          </div>

          {r.flags.length > 0 && (
            <div className="mt-3 space-y-1">
              {r.flags.map((flag, i) => (
                <p key={i} className="text-xs text-yellow-700 bg-yellow-50 rounded px-2 py-1">
                  {flag}
                </p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ContractorRanker() {
  const [activeTab, setActiveTab] = useState('bids')

  // Bid comparison state
  const [bids, setBids] = useState([{ ...BLANK_BID }, { ...BLANK_BID }])
  const [estimateLow, setEstimateLow] = useState('')
  const [estimateHigh, setEstimateHigh] = useState('')
  const [rankedBids, setRankedBids] = useState(null)

  // License optimizer state
  const [licensingData, setLicensingData] = useState(null)
  const [lienData, setLienData] = useState(null)
  const [dataLoading, setDataLoading] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)

  async function loadOptimizerData() {
    if (dataLoaded) return
    setDataLoading(true)
    const [lic, lien] = await Promise.all([
      import('../../data/legal/constructionLicensing'),
      import('../../data/legal/mechanicsLienLaws'),
    ])
    setLicensingData(lic.default)
    setLienData(lien.default)
    setDataLoaded(true)
    setDataLoading(false)
  }

  useEffect(() => {
    if (activeTab === 'optimizer' || activeTab === 'lien') loadOptimizerData()
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  const optimizedStates = useMemo(
    () => (licensingData ? optimizeLicenseStates(licensingData) : []),
    [licensingData]
  )

  const lienLeverage = useMemo(() => (lienData ? getLienLeverageByState(lienData) : []), [lienData])

  // Bid handlers
  const updateBid = (i, bid) => setBids((prev) => prev.map((b, idx) => (idx === i ? bid : b)))
  const removeBid = (i) => setBids((prev) => prev.filter((_, idx) => idx !== i))
  const addBid = () => setBids((prev) => [...prev, { ...BLANK_BID }])

  const handleRank = () => {
    const parsedBids = bids
      .filter((b) => b.name.trim() && b.bidAmount)
      .map((b) => ({
        ...b,
        bidAmount: parseFloat(b.bidAmount) || 0,
        bondAmount: parseFloat(b.bondAmount) || 0,
        yearsExperience: parseInt(b.yearsExperience) || 0,
        licenseClasses: b.licenseClasses ? b.licenseClasses.split(',').map((s) => s.trim()) : [],
      }))
    if (parsedBids.length === 0) return
    const results = rankContractorBids(
      parsedBids,
      parseFloat(estimateLow) || 0,
      parseFloat(estimateHigh) || 0
    )
    setRankedBids(results)
  }

  const TABS = [
    { id: 'bids', label: '📋 Rank Bids', desc: 'Compare contractor bids' },
    { id: 'optimizer', label: '🏆 License Optimizer', desc: 'Best states for base license' },
    { id: 'lien', label: '⚖️ Lien Leverage', desc: 'Strongest lien law states' },
  ]

  return (
    <>
      <SchemaMarkup
        title="Contractor Ranker — Bid Comparison & License Optimizer"
        description="Rank and compare contractor bids by price, licensing, bonding, and experience. Find the best base license state and strongest lien law jurisdiction."
        canonical="/advisory/contractor-ranker"
        breadcrumb={[
          { name: 'Home', path: '/' },
          { name: 'Advisory Board', path: '/advisory' },
          { name: 'Contractor Ranker', path: '/advisory/contractor-ranker' },
        ]}
      />

      {/* Header */}
      <div className="bg-brand-navy pt-32 pb-20 text-white text-center">
        <div className="max-w-4xl mx-auto px-4">
          <span className="inline-block bg-brand-amber/20 text-brand-amber text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-6">
            Contractor Intelligence · All 50 States
          </span>
          <h1 className="font-display font-black text-5xl md:text-6xl mb-4">
            Contractor <span className="text-brand-amber">Ranker</span>
          </h1>
          <p className="text-white/70 text-xl max-w-3xl mx-auto">
            Rank contractor bids by quality, optimize your license strategy, and identify the states
            with the strongest contractor legal protections.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <DisclaimerBanner />

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                activeTab === tab.id
                  ? 'bg-brand-amber text-brand-navy shadow-md'
                  : 'bg-white border border-brand-navy/15 text-brand-navy hover:bg-brand-amber/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Bid Comparison ── */}
        {activeTab === 'bids' && (
          <div className="space-y-6">
            <div className="card p-6 bg-white">
              <h2 className="font-display font-bold text-brand-navy text-xl mb-2">
                Bid Comparison
              </h2>
              <p className="text-brand-navy/60 text-sm mb-6">
                Enter contractor bids to rank them by composite quality score. Include your project
                estimate to score bid competitiveness.
              </p>

              {/* Estimate range */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 p-4 bg-brand-amber/5 rounded-xl border border-brand-amber/20">
                <div>
                  <label className="block text-xs font-medium text-brand-navy/70 mb-1">
                    Project Estimate — Low ($)
                  </label>
                  <input
                    type="number"
                    value={estimateLow}
                    onChange={(e) => setEstimateLow(e.target.value)}
                    placeholder="75000"
                    min="0"
                    className="w-full px-3 py-2 text-sm border border-brand-navy/20 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-amber"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-brand-navy/70 mb-1">
                    Project Estimate — High ($)
                  </label>
                  <input
                    type="number"
                    value={estimateHigh}
                    onChange={(e) => setEstimateHigh(e.target.value)}
                    placeholder="100000"
                    min="0"
                    className="w-full px-3 py-2 text-sm border border-brand-navy/20 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-amber"
                  />
                </div>
              </div>

              {/* Bid forms */}
              <div className="space-y-4 mb-6">
                {bids.map((bid, i) => (
                  <BidForm key={i} bid={bid} index={i} onChange={updateBid} onRemove={removeBid} />
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                {bids.length < 8 && (
                  <button type="button" onClick={addBid} className="btn-outline text-sm">
                    + Add Contractor
                  </button>
                )}
                <button type="button" onClick={handleRank} className="btn-primary">
                  Rank Contractors →
                </button>
              </div>
            </div>

            {rankedBids && (
              <div>
                <h3 className="font-display font-bold text-brand-navy text-lg mb-4">
                  Ranked Results
                  <span className="ml-2 text-sm font-normal text-brand-navy/50">
                    ({rankedBids.length} contractor{rankedBids.length !== 1 ? 's' : ''} ranked)
                  </span>
                </h3>
                <RankedResults results={rankedBids} />
              </div>
            )}
          </div>
        )}

        {/* ── Tab: License Optimizer ── */}
        {activeTab === 'optimizer' && (
          <div className="card p-6 bg-white">
            <h2 className="font-display font-bold text-brand-navy text-xl mb-2">
              State License Optimizer
            </h2>
            <p className="text-brand-navy/60 text-sm mb-6">
              Ranks all 50 states by how beneficial a contractor license there is — weighing
              reciprocity breadth (40%), license class scope (40%), and low bond requirements (20%).
              A high score means your license opens the most doors.
            </p>

            {dataLoading && (
              <div className="flex items-center justify-center py-12 text-brand-navy/50">
                <div className="w-6 h-6 border-2 border-brand-amber border-t-transparent rounded-full animate-spin mr-2" />
                Loading licensing data…
              </div>
            )}

            {!dataLoading && optimizedStates.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-brand-navy/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-brand-navy/5 text-brand-navy/60 text-left">
                      <th className="px-4 py-2 font-semibold">Rank</th>
                      <th className="px-4 py-2 font-semibold">State</th>
                      <th className="px-4 py-2 font-semibold">Optimizer Score</th>
                      <th className="px-4 py-2 font-semibold">Reciprocity</th>
                      <th className="px-4 py-2 font-semibold">Class Scope</th>
                      <th className="px-4 py-2 font-semibold">Min Bond (Com.)</th>
                      <th className="px-4 py-2 font-semibold">License Req.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {optimizedStates.map((s, i) => (
                      <tr
                        key={s.abbr}
                        className="border-t border-brand-navy/5 hover:bg-brand-amber/5 transition-colors"
                      >
                        <td className="px-4 py-2 text-brand-navy/50 font-medium">#{i + 1}</td>
                        <td className="px-4 py-2 font-medium text-brand-navy">
                          <Link to={`/advisory/state/${s.abbr}`} className="hover:text-brand-amber">
                            {s.state} ({s.abbr})
                          </Link>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-brand-navy">{s.optimizerScore}</span>
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                s.optimizerLabel === 'OPTIMAL'
                                  ? 'bg-green-100 text-green-700'
                                  : s.optimizerLabel === 'GOOD'
                                    ? 'bg-blue-100 text-blue-700'
                                    : s.optimizerLabel === 'AVERAGE'
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {s.optimizerLabel}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          {s.reciprocityCount > 0 ? (
                            <span className="text-green-700 font-medium">
                              {s.reciprocityCount} state{s.reciprocityCount !== 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="text-brand-navy/30">None</span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <MiniBar score={s.classScope} />
                        </td>
                        <td className="px-4 py-2 text-brand-navy/70">
                          {s.bondMinCommercial > 0
                            ? `$${s.bondMinCommercial.toLocaleString()}`
                            : '—'}
                        </td>
                        <td className="px-4 py-2">
                          {s.stateLicenseRequired ? (
                            <span className="text-xs text-green-700">✅ Yes</span>
                          ) : (
                            <span className="text-xs text-brand-navy/40">❌ No (local)</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Lien Leverage ── */}
        {activeTab === 'lien' && (
          <div className="card p-6 bg-white">
            <h2 className="font-display font-bold text-brand-navy text-xl mb-2">
              Lien Law Leverage by State
            </h2>
            <p className="text-brand-navy/60 text-sm mb-6">
              Ranks all 50 states by the strength of contractor lien rights. When negotiating
              contract jurisdiction, favor states at the top of this list — your lien rights are
              strongest there. Scored on filing deadlines, notice simplicity, and enforcement scope.
            </p>

            {dataLoading && (
              <div className="flex items-center justify-center py-12 text-brand-navy/50">
                <div className="w-6 h-6 border-2 border-brand-amber border-t-transparent rounded-full animate-spin mr-2" />
                Loading lien data…
              </div>
            )}

            {!dataLoading && lienLeverage.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-brand-navy/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-brand-navy/5 text-brand-navy/60 text-left">
                      <th className="px-4 py-2 font-semibold">Rank</th>
                      <th className="px-4 py-2 font-semibold">State</th>
                      <th className="px-4 py-2 font-semibold">Lien Score</th>
                      <th className="px-4 py-2 font-semibold">Filing Deadline</th>
                      <th className="px-4 py-2 font-semibold">Prelim. Notice</th>
                      <th className="px-4 py-2 font-semibold">Intent Notice</th>
                      <th className="px-4 py-2 font-semibold">Res. Exceptions</th>
                      <th className="px-4 py-2 font-semibold">Citation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lienLeverage.map((s, i) => (
                      <tr
                        key={s.abbr}
                        className="border-t border-brand-navy/5 hover:bg-brand-amber/5 transition-colors"
                      >
                        <td className="px-4 py-2 text-brand-navy/50">#{i + 1}</td>
                        <td className="px-4 py-2 font-medium text-brand-navy">
                          <Link to={`/advisory/state/${s.abbr}`} className="hover:text-brand-amber">
                            {s.state} ({s.abbr})
                          </Link>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{s.lienScore}</span>
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                s.lienLabel === 'STRONG'
                                  ? 'bg-green-100 text-green-700'
                                  : s.lienLabel === 'MODERATE'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-red-100 text-red-600'
                              }`}
                            >
                              {s.lienLabel}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-brand-navy/70">
                          {s.lienFilingDeadlineDays ? `${s.lienFilingDeadlineDays} days` : '—'}
                        </td>
                        <td className="px-4 py-2">
                          {s.preliminaryNoticeRequired ? (
                            <span className="text-yellow-600 text-xs">⚠️ Required</span>
                          ) : (
                            <span className="text-green-600 text-xs">✅ Not req.</span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {s.noticeOfIntentRequired ? (
                            <span className="text-yellow-600 text-xs">⚠️ Required</span>
                          ) : (
                            <span className="text-green-600 text-xs">✅ Not req.</span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {s.residentialExceptions ? (
                            <span className="text-yellow-600 text-xs">⚠️ Yes</span>
                          ) : (
                            <span className="text-green-600 text-xs">✅ No</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs text-brand-navy/50">
                          {s.citation || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Bottom CTA */}
        <section className="bg-brand-navy rounded-2xl p-8 text-center text-white">
          <h2 className="font-display font-black text-2xl mb-3">Need Legal Strategy Guidance?</h2>
          <p className="text-white/70 mb-6 max-w-xl mx-auto">
            Get negotiation strength scores and dispute-specific strategy for any state.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/advisory/legal-strategy" className="btn-primary">
              Open Legal Strategy Advisor →
            </Link>
            <Link to="/advisory" className="btn-outline">
              Back to Advisory Board
            </Link>
          </div>
        </section>
      </div>
    </>
  )
}
