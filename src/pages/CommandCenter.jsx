/**
 * CommandCenter — JWordenAI proprietary operations dashboard.
 *
 * Panels:
 *  1. Permit Feed       — live Virginia VPT / DEQ / National permit leads
 *  2. Takeoff Tool      — Google Maps + Solar API + OpenCV photo measurement
 *  3. Analytics         — BI dashboard (leads, funnel, revenue forecast)
 *  4. CRM Pipeline      — lead stage management
 *  5. Weather           — 7-day paving suitability forecast
 *  6. Material Prices   — EIA asphalt price index
 *  7. Lien Calendar     — mechanics lien deadline tracker
 *  8. Subcontractors    — insurance/bond compliance monitor
 *  9. Market Intel      — competitor radar + market signals
 * 10. Proposals         — GPT-4o proposal generator with PDF download + email send
 * 11. Human Review      — AI decision review queue; approve/reject with feedback
 * 12. Documents         — Upload contracts/blueprints/permits for AI Vision analysis
 * 13. Voice Intake      — Upload audio / Twilio recording → transcript + lead
 * 14. Follow-Ups        — Scheduled follow-up task list with cancel support
 *
 * Protected by an optional pin gate (VITE_CC_PASSWORD env var).
 */

import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router-dom'
import SchemaMarkup from '../components/SchemaMarkup'
import PermitFeed from '../components/PermitFeed'
import AnalyticsPanel from '../components/commandCenter/AnalyticsPanel'
import CRMPanel from '../components/commandCenter/CRMPanel'
import WeatherPanel from '../components/commandCenter/WeatherPanel'
import MaterialsPanel from '../components/commandCenter/MaterialsPanel'
import LienCalendarPanel from '../components/commandCenter/LienCalendarPanel'
import SubcontractorPanel from '../components/commandCenter/SubcontractorPanel'
import MarketIntelPanel from '../components/commandCenter/MarketIntelPanel'
import ProposalsPanel from '../components/commandCenter/ProposalsPanel'
import HumanReviewPanel from '../components/commandCenter/HumanReviewPanel'
import DocumentsPanel from '../components/commandCenter/DocumentsPanel'
import VoicePanel from '../components/commandCenter/VoicePanel'
import FollowUpsPanel from '../components/commandCenter/FollowUpsPanel'
import SchedulingPanel from '../components/commandCenter/SchedulingPanel'
import JobCostingPanel from '../components/commandCenter/JobCostingPanel'
import RFIChangeOrderPanel from '../components/commandCenter/RFIChangeOrderPanel'
import RetrospectivesPanel from '../components/commandCenter/RetrospectivesPanel'
import SafetyPanel from '../components/commandCenter/SafetyPanel'
import CashFlowPanel from '../components/commandCenter/CashFlowPanel'
import ScorecardPanel from '../components/commandCenter/ScorecardPanel'
import WorkforcePanel from '../components/commandCenter/WorkforcePanel'
import BidIntelPanel from '../components/commandCenter/BidIntelPanel'
import KPIWallPanel from '../components/commandCenter/KPIWallPanel'
import InnovationPanel from '../components/commandCenter/InnovationPanel'
import IGradePanel from '../components/commandCenter/IGradePanel'

// Lazy-load TakeoffMap because @vis.gl/react-google-maps is a heavier dep
const TakeoffMap = lazy(() => import('../components/TakeoffMap'))

// ── Login Guard ───────────────────────────────────────────────────────────────
const CC_PASSWORD = import.meta.env.VITE_CC_PASSWORD || ''
const SESSION_KEY = 'jworden_cc_unlocked'

function LoginGate({ children }) {
  const [unlocked, setUnlocked] = useState(
    !CC_PASSWORD || sessionStorage.getItem(SESSION_KEY) === '1',
  )
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  if (unlocked) return children

  const handleSubmit = (e) => {
    e.preventDefault()
    if (pin === CC_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, '1')
      setUnlocked(true)
    } else {
      setError(true)
      setPin('')
    }
  }

  return (
    <div className="min-h-screen bg-brand-navy flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-sm w-full text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h2 className="font-display font-black text-2xl text-brand-navy mb-2">
          Command Center
        </h2>
        <p className="text-brand-navy/50 text-sm mb-6">
          Enter the access PIN to continue.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={pin}
            onChange={(e) => { setPin(e.target.value); setError(false) }}
            placeholder="Access PIN"
            autoFocus
            className="w-full border border-gray-200 rounded-lg px-4 py-3 text-brand-navy text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-amber/50 focus:border-brand-amber"
          />
          {error && (
            <p className="text-red-500 text-xs">Incorrect PIN. Try again.</p>
          )}
          <button type="submit" className="btn-primary w-full">
            Unlock →
          </button>
        </form>
      </div>
    </div>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-colors ${
        active
          ? 'bg-brand-amber text-brand-navy shadow'
          : 'text-white/70 hover:text-white hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  )
}

function MapLoader() {
  return (
    <div className="flex items-center justify-center h-64 text-brand-navy/40 text-sm">
      <span className="w-6 h-6 border-2 border-brand-amber border-t-transparent rounded-full animate-spin mr-3" />
      Loading map…
    </div>
  )
}

const FEED_TABS = [
  { id: 'vpt',      label: '🏗 VPT Permits',      source: 'vpt',      keyword: 'paving' },
  { id: 'deq',      label: '💧 DEQ Permits',      source: 'deq',      keyword: '' },
  { id: 'national', label: '🌎 National Permits',  source: 'national', keyword: 'asphalt' },
]

const PANELS = [
  { id: 'permits',       label: '📋 Permit Feed' },
  { id: 'takeoff',       label: '📐 Takeoff Tool' },
  { id: 'analytics',     label: '📊 Analytics' },
  { id: 'crm',           label: '👥 CRM Pipeline' },
  { id: 'weather',       label: '🌤 Weather' },
  { id: 'materials',     label: '💰 Materials' },
  { id: 'lien-calendar', label: '📅 Lien Calendar' },
  { id: 'subcontractors',label: '🏗 Subs' },
  { id: 'market-intel',  label: '🔍 Market Intel' },
  { id: 'proposals',     label: '📄 Proposals' },
  { id: 'human-review',  label: '🧠 Human Review' },
  { id: 'documents',     label: '📁 Documents' },
  { id: 'voice',         label: '🎙 Voice Intake' },
  { id: 'follow-ups',    label: '🔔 Follow-Ups' },
  { id: 'scheduling',    label: '🗓 Scheduling' },
  { id: 'job-costing',   label: '💰 Job Costing' },
  { id: 'rfi-co',        label: '📝 RFI / Change Orders' },
  { id: 'retrospectives',label: '📚 Lessons Learned' },
  { id: 'safety',        label: '🦺 Safety' },
  { id: 'cashflow',      label: '💵 Cash Flow' },
  { id: 'scorecard',     label: '🏆 Scorecard' },
  { id: 'workforce',     label: '👷 Workforce' },
  { id: 'bid-intel',     label: '🎯 Bid Intel' },
  { id: 'kpi-wall',      label: '📈 KPI Wall' },
  { id: 'innovations',   label: '🔬 Innovation Lab' },
  { id: 'igrade',        label: '🎓 iGrade Engine' },
]

export default function CommandCenter() {
  return (
    <LoginGate>
      <CommandCenterInner />
    </LoginGate>
  )
}

function CommandCenterInner() {
  const [activePanel, setActivePanel] = useState('permits')
  const [activeFeed, setActiveFeed]   = useState('vpt')
  const [vptKeyword, setVptKeyword]   = useState('paving')
  const [natKeyword, setNatKeyword]   = useState('asphalt')
  const [natStates, setNatStates]     = useState('VA,TX,FL,NC,GA,NY,NJ,MI')

  const currentFeed = FEED_TABS.find((t) => t.id === activeFeed)

  return (
    <>
      <SchemaMarkup
        title="JWordenAI Command Center"
        description="Proprietary operations dashboard for J. Worden & Sons — live Virginia permit leads, area takeoffs, analytics, CRM, weather, material prices, lien calendar, subcontractor monitor, and market intelligence."
        canonical="/command-center"
        breadcrumb={[
          { name: 'Home', path: '/' },
          { name: 'Command Center', path: '/command-center' },
        ]}
      />

      {/* ── Header ── */}
      <div className="bg-brand-navy pt-32 pb-10 text-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="mb-6">
            <span className="inline-block bg-brand-amber/20 text-brand-amber text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-4">
              JWordenAI · Command Center
            </span>
            <h1 className="font-display font-black text-4xl md:text-5xl">
              Operations{' '}
              <span className="text-brand-amber">Dashboard</span>
            </h1>
            <p className="text-white/60 mt-2 max-w-xl">
              Permit leads, site takeoffs, analytics, CRM, weather, material prices, lien deadlines, and market intelligence — all in one place.
            </p>
          </div>

          {/* Scrollable panel tab bar */}
          <div className="overflow-x-auto pb-1">
            <div className="flex gap-1 bg-white/10 p-1 rounded-2xl w-max">
              {PANELS.map((p) => (
                <TabButton key={p.id} active={activePanel === p.id} onClick={() => setActivePanel(p.id)}>
                  {p.label}
                </TabButton>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* ── Permit Feed panel ── */}
        {activePanel === 'permits' && (
          <div className="space-y-6">

            {/* Source tabs + keyword filter */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex gap-2">
                {FEED_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveFeed(tab.id)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      activeFeed === tab.id
                        ? 'bg-brand-navy text-white border-brand-navy'
                        : 'border-gray-200 text-brand-navy/60 hover:border-brand-navy/40'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {activeFeed === 'vpt' && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-brand-navy/50 font-medium whitespace-nowrap">Keyword:</label>
                  <input
                    type="text"
                    value={vptKeyword}
                    onChange={(e) => setVptKeyword(e.target.value)}
                    placeholder="e.g. paving, asphalt…"
                    className="input text-sm py-1.5 w-40"
                  />
                </div>
              )}
              {activeFeed === 'national' && (
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-xs text-brand-navy/50 font-medium whitespace-nowrap">States:</label>
                  <input
                    type="text"
                    value={natStates}
                    onChange={(e) => setNatStates(e.target.value)}
                    placeholder="VA,TX,FL…"
                    className="input text-sm py-1.5 w-44"
                  />
                  <label className="text-xs text-brand-navy/50 font-medium whitespace-nowrap">Keyword:</label>
                  <input
                    type="text"
                    value={natKeyword}
                    onChange={(e) => setNatKeyword(e.target.value)}
                    placeholder="asphalt"
                    className="input text-sm py-1.5 w-32"
                  />
                </div>
              )}
            </div>

            {/* Feed */}
            <div className="card p-6">
              <PermitFeed
                key={`${activeFeed}-${vptKeyword}-${natKeyword}-${natStates}`}
                source={currentFeed?.source}
                keyword={activeFeed === 'national' ? natKeyword : vptKeyword}
                states={activeFeed === 'national' ? natStates : undefined}
                limit={50}
                pollIntervalMs={300_000}
              />
            </div>

            {/* Quick-links */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <a
                href="https://permits.virginia.gov"
                target="_blank"
                rel="noopener noreferrer"
                className="card p-4 hover:border-brand-amber transition-colors border-2 border-transparent"
              >
                <div className="font-bold text-brand-navy mb-1">Virginia Permit Transparency →</div>
                <div className="text-brand-navy/50 text-xs">permits.virginia.gov</div>
              </a>
              <a
                href="https://www.deq.virginia.gov/water/shortcuts/track-a-permit"
                target="_blank"
                rel="noopener noreferrer"
                className="card p-4 hover:border-brand-amber transition-colors border-2 border-transparent"
              >
                <div className="font-bold text-brand-navy mb-1">DEQ PEEP Tracker →</div>
                <div className="text-brand-navy/50 text-xs">deq.virginia.gov</div>
              </a>
              <a
                href="https://www.dpor.virginia.gov/RecordsandDocuments"
                target="_blank"
                rel="noopener noreferrer"
                className="card p-4 hover:border-brand-amber transition-colors border-2 border-transparent"
              >
                <div className="font-bold text-brand-navy mb-1">DPOR Public Records →</div>
                <div className="text-brand-navy/50 text-xs">dpor.virginia.gov</div>
              </a>
            </div>
          </div>
        )}

        {/* ── Takeoff Tool panel ── */}
        {activePanel === 'takeoff' && (
          <div className="space-y-6">
            <div className="card p-6">
              <div className="mb-5">
                <h2 className="font-display font-bold text-brand-navy text-xl mb-1">
                  Site Takeoff &amp; Visualization
                </h2>
                <p className="text-brand-navy/50 text-sm">
                  Enter an address to pull Solar API DSM data, view a 3D aerial video, or upload a
                  project photo for automatic polygon area measurement.
                </p>
              </div>
              <Suspense fallback={<MapLoader />}>
                <TakeoffMap />
              </Suspense>
            </div>

            {/* Info cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div className="card p-4 bg-blue-50 border-blue-100">
                <div className="font-bold text-blue-800 mb-1">☀️ Solar API</div>
                <div className="text-blue-700/70 text-xs">
                  DSM data, roof area, flux maps, and sunshine hours — ideal for precise site assessments.
                </div>
              </div>
              <div className="card p-4 bg-purple-50 border-purple-100">
                <div className="font-bold text-purple-800 mb-1">🎥 Aerial View API</div>
                <div className="text-purple-700/70 text-xs">
                  Cinematic 3D drone-like video for client presentations and project visualization.
                </div>
              </div>
              <div className="card p-4 bg-green-50 border-green-100">
                <div className="font-bold text-green-800 mb-1">📷 OpenCV Measure</div>
                <div className="text-green-700/70 text-xs">
                  Upload a job-site photo — edges are detected and polygon areas returned in square feet.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Analytics panel ── */}
        {activePanel === 'analytics' && <AnalyticsPanel />}

        {/* ── CRM Pipeline panel ── */}
        {activePanel === 'crm' && <CRMPanel />}

        {/* ── Weather panel ── */}
        {activePanel === 'weather' && <WeatherPanel />}

        {/* ── Material Prices panel ── */}
        {activePanel === 'materials' && <MaterialsPanel />}

        {/* ── Lien Calendar panel ── */}
        {activePanel === 'lien-calendar' && <LienCalendarPanel />}

        {/* ── Subcontractor Monitor panel ── */}
        {activePanel === 'subcontractors' && <SubcontractorPanel />}

        {/* ── Market Intelligence panel ── */}
        {activePanel === 'market-intel' && <MarketIntelPanel />}

        {/* ── Proposals panel ── */}
        {activePanel === 'proposals' && <ProposalsPanel />}

        {/* ── Human Review Queue panel ── */}
        {activePanel === 'human-review' && <HumanReviewPanel />}

        {/* ── Documents panel ── */}
        {activePanel === 'documents' && <DocumentsPanel />}

        {/* ── Voice Intake panel ── */}
        {activePanel === 'voice' && <VoicePanel />}

        {/* ── Follow-Ups panel ── */}
        {activePanel === 'follow-ups' && <FollowUpsPanel />}

        {/* ── Scheduling (CPM) panel ── */}
        {activePanel === 'scheduling' && <SchedulingPanel />}

        {/* ── Job Costing panel ── */}
        {activePanel === 'job-costing' && <JobCostingPanel />}

        {/* ── RFI / Change Orders panel ── */}
        {activePanel === 'rfi-co' && <RFIChangeOrderPanel />}

        {/* ── Lessons Learned / Retrospectives panel ── */}
        {activePanel === 'retrospectives' && <RetrospectivesPanel />}

        {/* ── Safety Culture Dashboard panel ── */}
        {activePanel === 'safety' && <SafetyPanel />}

        {/* ── Cash Flow Projection panel ── */}
        {activePanel === 'cashflow' && <CashFlowPanel />}

        {/* ── Project Scorecard panel ── */}
        {activePanel === 'scorecard' && <ScorecardPanel />}

        {/* ── Workforce / Crew Skills Matrix panel ── */}
        {activePanel === 'workforce' && <WorkforcePanel />}

        {/* ── Bid Intelligence / Win-Rate Optimizer panel ── */}
        {activePanel === 'bid-intel' && <BidIntelPanel />}

        {/* ── KPI Wall panel ── */}
        {activePanel === 'kpi-wall' && <KPIWallPanel />}

        {/* ── Innovation Lab panel ── */}
        {activePanel === 'innovations' && <InnovationPanel />}

        {/* ── iGrade Engine panel ── */}
        {activePanel === 'igrade' && <IGradePanel />}

        {/* ── Bottom CTA ── */}
        <section className="mt-12 bg-brand-navy rounded-2xl p-8 text-center text-white">
          <h2 className="font-display font-black text-2xl mb-3">Ready to Convert a Lead?</h2>
          <p className="text-white/70 mb-6 max-w-xl mx-auto text-sm">
            Use the permit feed to find new prospects, measure their site, and send a quote — all from
            the JWordenAI Command Center.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/quote" className="btn-primary">Get a Project Quote</Link>
            <Link to="/contact" className="btn-outline">Contact Our Team</Link>
          </div>
        </section>
      </div>
    </>
  )
}
