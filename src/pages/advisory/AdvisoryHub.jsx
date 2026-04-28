import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import SchemaMarkup from '../../components/SchemaMarkup'
import DisclaimerBanner from '../../components/advisory/DisclaimerBanner'
import StateSelector from '../../components/advisory/StateSelector'

const CATEGORIES = [
  {
    to: '/advisory/licensing',
    icon: '📋',
    title: 'Contractor Licensing',
    desc: 'License classes, bonding requirements, reciprocity agreements, and CE hours for all 50 states.',
    color: 'bg-blue-50 border-blue-200',
    accent: 'text-blue-700',
  },
  {
    to: '/advisory/construction-law',
    icon: '⚖️',
    title: 'Construction Law',
    desc: 'Mechanics lien laws, prompt payment rules, contract statutes of limitations, and right-to-cure laws.',
    color: 'bg-purple-50 border-purple-200',
    accent: 'text-purple-700',
  },
  {
    to: '/advisory/utilities',
    icon: '🔌',
    title: 'Utilities & 811',
    desc: 'One-call center rules, notice periods, tolerance zones, utility depth clearances, and dig penalties.',
    color: 'bg-yellow-50 border-yellow-200',
    accent: 'text-yellow-700',
  },
  {
    to: '/advisory/safety',
    icon: '🦺',
    title: 'Safety & OSHA',
    desc: 'State OSHA plans, trenching supplements, fall protection rules, and heat illness prevention.',
    color: 'bg-red-50 border-red-200',
    accent: 'text-red-700',
  },
  {
    to: '/advisory/contracts',
    icon: '📝',
    title: 'Contract Law',
    desc: 'Statutes of repose, arbitration enforceability, anti-indemnity statutes, and no-damages-for-delay rules.',
    color: 'bg-green-50 border-green-200',
    accent: 'text-green-700',
  },
  {
    to: '/advisory/prevailing-wage',
    icon: '💰',
    title: 'Prevailing Wage',
    desc: 'State prevailing wage laws, coverage thresholds, certified payroll rules, and apprenticeship requirements.',
    color: 'bg-orange-50 border-orange-200',
    accent: 'text-orange-700',
  },
  {
    to: '/advisory/environmental',
    icon: '🌱',
    title: 'Environmental Permits',
    desc: 'NPDES stormwater permits, SWPPP requirements, land disturbance thresholds, and wetland setbacks.',
    color: 'bg-teal-50 border-teal-200',
    accent: 'text-teal-700',
  },
  {
    to: '/advisory/building-codes',
    icon: '🏗️',
    title: 'Building Codes & Permits',
    desc: 'IBC / NEC / IFC edition years by state, ADA supplements, third-party inspection rules.',
    color: 'bg-indigo-50 border-indigo-200',
    accent: 'text-indigo-700',
  },
  {
    to: '/advisory/roads-paving',
    icon: '🛣️',
    title: 'Roads & Paving Regs',
    desc: 'DOT specs, Superpave mix designs, compaction density standards, and HMA temperature requirements.',
    color: 'bg-stone-50 border-stone-200',
    accent: 'text-stone-700',
  },
  {
    to: '/advisory/compare',
    icon: '⚖️',
    title: 'Compare States',
    desc: 'Pick any 2–3 states and compare licensing, lien laws, utilities, safety, permits, and more side by side.',
    color: 'bg-brand-amber/10 border-brand-amber/30',
    accent: 'text-brand-navy',
  },
  {
    to: '/advisory/legal-strategy',
    icon: '🤝',
    title: 'Legal Strategy Advisor',
    desc: "Score your state's negotiation strength, identify your strongest legal position, and get dispute-specific strategy for liens, payment, and contract breach.",
    color: 'bg-violet-50 border-violet-200',
    accent: 'text-violet-700',
  },
  {
    to: '/advisory/contractor-ranker',
    icon: '🏗️',
    title: 'Contractor Ranker',
    desc: 'Rank contractor bids by price, licensing tier, bonding, and experience. Plus: find the best base license state and strongest lien jurisdiction.',
    color: 'bg-emerald-50 border-emerald-200',
    accent: 'text-emerald-700',
  },
]

export default function AdvisoryHub() {
  const [selectedState, setSelectedState] = useState(null)
  const navigate = useNavigate()

  const handleStateGo = () => {
    if (selectedState) navigate(`/advisory/state/${selectedState}`)
  }

  return (
    <>
      <SchemaMarkup
        title="Legal & Construction Advisory Board — All 50 States"
        description="Comprehensive construction law reference covering contractor licensing, mechanics liens, utilities/811 rules, OSHA safety, contract law, and prevailing wage for all 50 states."
        canonical="/advisory"
        breadcrumb={[
          { name: 'Home', path: '/' },
          { name: 'Advisory Board', path: '/advisory' },
        ]}
      />

      {/* Header */}
      <div className="bg-brand-navy pt-32 pb-20 text-white text-center">
        <div className="max-w-4xl mx-auto px-4">
          <span className="inline-block bg-brand-amber/20 text-brand-amber text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-6">
            Advisory Board · All 50 States
          </span>
          <h1 className="font-display font-black text-5xl md:text-6xl mb-4">
            Legal &amp; Construction <span className="text-brand-amber">Reference Board</span>
          </h1>
          <p className="text-white/70 text-xl max-w-3xl mx-auto">
            A contractor&apos;s field guide to licensing, lien law, utilities, safety, permits, and
            contract law — covering every state in the US.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        {/* Disclaimer */}
        <DisclaimerBanner />

        {/* State Quick-Jump */}
        <div className="card p-6">
          <h2 className="font-display font-bold text-brand-navy text-xl mb-4">Jump to a State</h2>
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1">
              <StateSelector
                value={selectedState}
                onChange={setSelectedState}
                label="Select a state to view its full profile:"
              />
            </div>
            <button
              type="button"
              onClick={handleStateGo}
              disabled={!selectedState}
              className="btn-primary whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
            >
              View State Profile →
            </button>
          </div>
        </div>

        {/* Category Cards */}
        <section>
          <h2 className="font-display font-bold text-brand-navy text-2xl mb-6">
            Browse by Category
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.to}
                to={cat.to}
                className={`card p-6 group border-2 hover:border-brand-amber transition-colors ${cat.color}`}
              >
                <div className="text-4xl mb-3">{cat.icon}</div>
                <h3
                  className={`font-display font-bold text-lg mb-2 group-hover:text-brand-amber transition-colors ${cat.accent}`}
                >
                  {cat.title}
                </h3>
                <p className="text-brand-navy/60 text-sm leading-relaxed">{cat.desc}</p>
                <div className="mt-4 text-brand-amber text-xs font-semibold">
                  View all 50 states →
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="bg-brand-navy rounded-2xl p-8 text-center text-white">
          <h2 className="font-display font-black text-2xl mb-3">Need Project-Specific Guidance?</h2>
          <p className="text-white/70 mb-6 max-w-xl mx-auto">
            This advisory board is a starting point. For project compliance, contact J. Worden &amp;
            Sons or consult a licensed attorney in your state.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/contact" className="btn-primary">
              Contact Our Team
            </Link>
            <Link to="/quote" className="btn-outline">
              Get a Project Quote
            </Link>
          </div>
        </section>
      </div>
    </>
  )
}
