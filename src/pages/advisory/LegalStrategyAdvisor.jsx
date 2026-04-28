/**
 * LegalStrategyAdvisor — Lawyer / Negotiation Recommender page.
 *
 * Uses the lawyerRecommender.js lib + existing legal data files to score
 * each state's legal environment and produce actionable strategy recommendations
 * for the selected dispute type and contractor role.
 *
 * Route: /advisory/legal-strategy
 */
import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import SchemaMarkup from '../../components/SchemaMarkup'
import DisclaimerBanner from '../../components/advisory/DisclaimerBanner'
import StateSelector from '../../components/advisory/StateSelector'
import {
  recommendStrategy,
  rankStatesByDispute,
  DISPUTE_TYPES,
  ROLES,
} from '../../lib/lawyerRecommender'

// ── Lazy data loaders ─────────────────────────────────────────────────────────

async function loadLegalData() {
  const [lien, pay, contract] = await Promise.all([
    import('../../data/legal/mechanicsLienLaws'),
    import('../../data/legal/promptPaymentLaws'),
    import('../../data/legal/contractLaw'),
  ])
  return {
    lienData: lien.default,
    payData: pay.default,
    contractData: contract.default,
  }
}

// ── Score badge helper ────────────────────────────────────────────────────────

function ScoreBadge({ score, label }) {
  const colorClass =
    score >= 75
      ? 'bg-green-100 text-green-800 border-green-200'
      : score >= 55
        ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
        : 'bg-red-100 text-red-800 border-red-200'
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${colorClass}`}
    >
      {score}/100 · {label}
    </span>
  )
}

function ScoreBar({ score, label, color }) {
  const barColor =
    color === 'green' ? 'bg-green-500' : color === 'yellow' ? 'bg-yellow-400' : 'bg-red-500'
  return (
    <div>
      <div className="flex justify-between text-xs font-medium text-brand-navy/60 mb-1">
        <span>{label}</span>
        <span>{score}/100</span>
      </div>
      <div className="h-2 bg-brand-navy/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}

// ── Top states table ──────────────────────────────────────────────────────────

function TopStatesTable({ states }) {
  if (!states || states.length === 0) return null
  return (
    <div className="overflow-x-auto rounded-xl border border-brand-navy/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-brand-navy/5 text-brand-navy/60 text-left">
            <th className="px-4 py-2 font-semibold">Rank</th>
            <th className="px-4 py-2 font-semibold">State</th>
            <th className="px-4 py-2 font-semibold">Score</th>
            <th className="px-4 py-2 font-semibold">Strength</th>
          </tr>
        </thead>
        <tbody>
          {states.slice(0, 10).map((s, i) => (
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
              <td className="px-4 py-2">{s.weighted ?? s.composite ?? 0}/100</td>
              <td className="px-4 py-2">
                <ScoreBadge
                  score={s.weighted ?? s.composite ?? 0}
                  label={
                    (s.weighted ?? s.composite ?? 0) >= 75
                      ? 'STRONG'
                      : (s.weighted ?? s.composite ?? 0) >= 55
                        ? 'MODERATE'
                        : 'WEAK'
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LegalStrategyAdvisor() {
  const [legalData, setLegalData] = useState(null)
  const [loading, setLoading] = useState(true)

  const [selectedState, setSelectedState] = useState('CA')
  const [disputeType, setDisputeType] = useState('lien')
  const [role, setRole] = useState('gc')
  const [analyzed, setAnalyzed] = useState(false)

  useEffect(() => {
    loadLegalData().then((data) => {
      setLegalData(data)
      setLoading(false)
    })
  }, [])

  const allRanked = useMemo(() => {
    if (!legalData) return []
    return rankStatesByDispute(
      disputeType,
      legalData.lienData,
      legalData.payData,
      legalData.contractData
    )
  }, [legalData, disputeType])

  const recommendation = useMemo(() => {
    if (!legalData || !selectedState || !analyzed) return null
    const abbr = selectedState
    const lienEntry = legalData.lienData.find((e) => e.abbr === abbr)
    const payEntry = legalData.payData.find((e) => e.abbr === abbr)
    const contractEntry = legalData.contractData.find((e) => e.abbr === abbr)
    return recommendStrategy(
      abbr,
      disputeType,
      role,
      { lienEntry, payEntry, contractEntry },
      allRanked
    )
  }, [legalData, selectedState, disputeType, role, analyzed, allRanked])

  const handleAnalyze = () => setAnalyzed(true)

  return (
    <>
      <SchemaMarkup
        title="Legal Strategy Advisor — Contractor Negotiation Recommender"
        description="Score your state's legal environment and get actionable negotiation strategy recommendations for mechanics liens, payment disputes, and contract breach across all 50 states."
        canonical="/advisory/legal-strategy"
        breadcrumb={[
          { name: 'Home', path: '/' },
          { name: 'Advisory Board', path: '/advisory' },
          { name: 'Legal Strategy Advisor', path: '/advisory/legal-strategy' },
        ]}
      />

      {/* Header */}
      <div className="bg-brand-navy pt-32 pb-20 text-white text-center">
        <div className="max-w-4xl mx-auto px-4">
          <span className="inline-block bg-brand-amber/20 text-brand-amber text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-6">
            Legal Strategy Advisor · All 50 States
          </span>
          <h1 className="font-display font-black text-5xl md:text-6xl mb-4">
            Negotiation &amp; <span className="text-brand-amber">Legal Strategy</span>
          </h1>
          <p className="text-white/70 text-xl max-w-3xl mx-auto">
            Score your state&apos;s legal environment, identify your strongest negotiating position,
            and get dispute-specific strategy recommendations.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
        <DisclaimerBanner />

        {/* Input form */}
        <div className="card p-6 bg-white">
          <h2 className="font-display font-bold text-brand-navy text-xl mb-6">
            Analyze Your Legal Position
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
            {/* State */}
            <StateSelector
              value={selectedState}
              onChange={(v) => {
                setSelectedState(v)
                setAnalyzed(false)
              }}
              label="Project State"
            />

            {/* Dispute type */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-brand-navy">
                Dispute / Situation Type
              </label>
              <select
                value={disputeType}
                onChange={(e) => {
                  setDisputeType(e.target.value)
                  setAnalyzed(false)
                }}
                className="block w-full px-3 py-2 border border-brand-navy/20 rounded-lg bg-white text-brand-navy text-sm focus:outline-none focus:ring-2 focus:ring-brand-amber"
              >
                {DISPUTE_TYPES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Role */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-brand-navy">Your Role</label>
              <select
                value={role}
                onChange={(e) => {
                  setRole(e.target.value)
                  setAnalyzed(false)
                }}
                className="block w-full px-3 py-2 border border-brand-navy/20 rounded-lg bg-white text-brand-navy text-sm focus:outline-none focus:ring-2 focus:ring-brand-amber"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={loading || !selectedState}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Loading legal data…' : 'Analyze My Position →'}
          </button>
        </div>

        {/* Results */}
        {recommendation && (
          <>
            {/* Strength overview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Score card */}
              <div className="card p-6 space-y-4 col-span-1">
                <h3 className="font-display font-bold text-brand-navy text-lg">
                  {recommendation.scores.abbr} · Legal Strength
                </h3>
                <div className="text-center py-4">
                  <div
                    className={`text-5xl font-black mb-1 ${
                      recommendation.strengthColor === 'green'
                        ? 'text-green-600'
                        : recommendation.strengthColor === 'yellow'
                          ? 'text-yellow-600'
                          : 'text-red-600'
                    }`}
                  >
                    {recommendation.composite}
                  </div>
                  <div className="text-sm text-brand-navy/60">out of 100</div>
                  <ScoreBadge
                    score={recommendation.composite}
                    label={recommendation.strengthLabel}
                  />
                </div>
                <div className="space-y-3">
                  <ScoreBar
                    score={recommendation.scores.lien}
                    label="Lien Law"
                    color={
                      recommendation.scores.lien >= 75
                        ? 'green'
                        : recommendation.scores.lien >= 55
                          ? 'yellow'
                          : 'red'
                    }
                  />
                  <ScoreBar
                    score={recommendation.scores.payment}
                    label="Prompt Pay"
                    color={
                      recommendation.scores.payment >= 75
                        ? 'green'
                        : recommendation.scores.payment >= 55
                          ? 'yellow'
                          : 'red'
                    }
                  />
                  <ScoreBar
                    score={recommendation.scores.contract}
                    label="Contract Law"
                    color={
                      recommendation.scores.contract >= 75
                        ? 'green'
                        : recommendation.scores.contract >= 55
                          ? 'yellow'
                          : 'red'
                    }
                  />
                </div>
              </div>

              {/* Strategy card */}
              <div className="card p-6 col-span-1 lg:col-span-2 space-y-4">
                <h3 className="font-display font-bold text-brand-navy text-lg">
                  {recommendation.strategy.title}
                </h3>
                <p className="text-brand-navy/70 text-sm leading-relaxed">
                  {recommendation.strategy.description}
                </p>

                <div>
                  <h4 className="text-sm font-bold text-brand-navy mb-2">Key Actions</h4>
                  <ul className="space-y-1">
                    {recommendation.strategy.keyActions.map((action, i) => (
                      <li key={i} className="flex gap-2 text-sm text-brand-navy/80">
                        <span className="text-brand-amber font-bold flex-shrink-0">{i + 1}.</span>
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-brand-navy mb-2">
                    Your Leverage ({ROLES.find((r) => r.value === recommendation.role)?.label})
                  </h4>
                  <ul className="space-y-1">
                    {recommendation.strategy.roleLeverage.map((point, i) => (
                      <li key={i} className="flex gap-2 text-sm text-brand-navy/80">
                        <span className="text-green-500 flex-shrink-0">✓</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>

                {recommendation.strategy.weakPositionAdvice && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-xs font-bold text-yellow-800 mb-1">
                      ⚠️ If in a Weak Position
                    </p>
                    <p className="text-xs text-yellow-700">
                      {recommendation.strategy.weakPositionAdvice}
                    </p>
                  </div>
                )}

                <p className="text-xs text-brand-navy/40 italic">
                  {recommendation.strategy.citationNote}
                </p>
              </div>
            </div>

            {/* Top states for this dispute */}
            <div className="card p-6">
              <h3 className="font-display font-bold text-brand-navy text-lg mb-2">
                Strongest States for{' '}
                {DISPUTE_TYPES.find((d) => d.value === recommendation.disputeType)?.label}
              </h3>
              <p className="text-brand-navy/60 text-sm mb-4">
                When jurisdiction is negotiable, these states offer the strongest contractor
                protections for this dispute type. Consider specifying governing law in your
                contract accordingly.
              </p>
              <TopStatesTable states={allRanked} />
            </div>
          </>
        )}

        {/* Bottom CTA */}
        <section className="bg-brand-navy rounded-2xl p-8 text-center text-white">
          <h2 className="font-display font-black text-2xl mb-3">Need a Contractor Ranking Tool?</h2>
          <p className="text-white/70 mb-6 max-w-xl mx-auto">
            Compare and rank contractor bids by price, licensing, bonding, and experience to make
            confident hiring decisions.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/advisory/contractor-ranker" className="btn-primary">
              Open Contractor Ranker →
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
