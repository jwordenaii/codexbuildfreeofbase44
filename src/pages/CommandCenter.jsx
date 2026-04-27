/**
 * CommandCenter — JWordenAI 4D Virtual Foreman Command Center.
 *
 * A tabbed dashboard integrating all Phase 1–4 features:
 *
 *   Tab 1 — Richmond Grid:   Leaflet map with leaflet-draw polygon tool,
 *                             20-mile service radius, site + permit lead markers
 *   Tab 2 — Virtual Foreman: LangChain RAG chat for sites/leads/logistics/law
 *   Tab 3 — Live Field Feed: TF.js on-device + PyTorch server-side measurement
 *   Tab 4 — Dashboard:       Real-time exec summary (trucks, leads, sites)
 *                             with WebSocket-pushed KPIs + permit lead table
 */

import { lazy, Suspense, useState, useEffect } from 'react'

const RichmondGrid   = lazy(() => import('../components/RichmondGrid'))
const VirtualForeman = lazy(() => import('../components/VirtualForeman'))
const LiveFieldFeed  = lazy(() => import('../components/LiveFieldFeed'))
const TruckTracker   = lazy(() => import('../components/TruckTracker'))

const TABS = [
  { id: 'grid',    label: 'Richmond Grid',   icon: '🗺️',  desc: 'Site mapping + auto-takeoff' },
  { id: 'foreman', label: 'Virtual Foreman', icon: '🏗️',  desc: 'AI Q&A — sites, leads, logistics' },
  { id: 'field',   label: 'Field Feed',      icon: '📷',  desc: 'Live lot measurement (TF.js)' },
  { id: 'dash',    label: 'Dashboard',       icon: '📊',  desc: 'Fleet + lead pipeline KPIs' },
]

function TabLoader() {
  return (
    <div className="flex items-center justify-center min-h-64 text-white/30">
      <div className="w-8 h-8 border-2 border-brand-amber border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

// ── Executive KPI panel (Dashboard tab) ────────────────────────────────────────

function KpiCard({ icon, label, value, sub, accent = false }) {
  return (
    <div className={`bg-white/5 border rounded-xl p-5 ${accent ? 'border-brand-amber/40' : 'border-white/10'}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-white/50 text-xs uppercase tracking-wide">{label}</span>
      </div>
      <div className={`font-black font-display text-3xl ${accent ? 'text-brand-amber' : 'text-white'}`}>
        {value}
      </div>
      {sub && <div className="text-white/40 text-xs mt-1">{sub}</div>}
    </div>
  )
}

function DashboardTab() {
  const [status, setStatus] = useState(null)
  const [permitLeads, setPermitLeads] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchStatus = async () => {
    try {
      const BASE = import.meta.env.VITE_API_BASE_URL || ''
      const [statusRes, leadsRes] = await Promise.all([
        fetch(`${BASE}/api/v1/foreman/status`, { signal: AbortSignal.timeout(8_000) }),
        fetch(`${BASE}/api/v1/geo/permit-leads?label=HOT&limit=20`, { signal: AbortSignal.timeout(8_000) }),
      ])
      if (statusRes.ok) setStatus(await statusRes.json())
      if (leadsRes.ok) setPermitLeads(await leadsRes.json())
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 60_000)
    return () => clearInterval(interval)
  }, [])

  if (loading) return <TabLoader />

  const s = status || {}
  const sites  = s.sites || {}
  const leads  = s.leads || {}
  const perms  = s.permit_leads || {}
  const trucks = s.trucks || {}

  return (
    <div className="space-y-8">
      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon="📍" label="Active Sites"    value={sites.by_status?.active ?? '—'} sub={`${sites.total ?? 0} total sites`} accent />
        <KpiCard icon="🔥" label="HOT Leads"       value={leads.by_label?.HOT ?? '—'}    sub={`${leads.total ?? 0} in pipeline`} accent />
        <KpiCard icon="📋" label="HOT Permits"     value={perms.by_label?.HOT ?? '—'}    sub={`${perms.total ?? 0} scraped`} />
        <KpiCard icon="🚛" label="Trucks Online"   value={trucks.total ?? '—'}            sub={`${trucks.by_status?.on_site ?? 0} on-site`} />
      </div>

      {/* Lead pipeline breakdown */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
          <span>🎯</span> Lead Pipeline
        </h3>
        <div className="grid grid-cols-3 gap-4">
          {['HOT', 'WARM', 'COOL'].map((label) => {
            const count = leads.by_label?.[label] ?? 0
            const total = leads.total || 1
            const pct = Math.round((count / total) * 100)
            const colors = { HOT: 'bg-red-500', WARM: 'bg-brand-amber', COOL: 'bg-blue-500' }
            const text = { HOT: 'text-red-400', WARM: 'text-brand-amber', COOL: 'text-blue-400' }
            return (
              <div key={label}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-bold ${text[label]}`}>{label}</span>
                  <span className="text-white/60 text-xs">{count}</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className={`h-full ${colors[label]} rounded-full`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* HOT permit leads table */}
      {permitLeads.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-white font-bold flex items-center gap-2">
              <span>🔥</span> HOT Permit Leads
            </h3>
            <span className="text-white/40 text-xs">{permitLeads.length} leads</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  {['Address', 'Type', 'Value', 'Sqft', 'Scraped'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-white/40 font-medium text-xs uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permitLeads.map((lead) => (
                  <tr key={lead.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-white text-xs max-w-xs truncate">{lead.property_address}</td>
                    <td className="px-4 py-3 text-white/70 text-xs">{lead.permit_type}</td>
                    <td className="px-4 py-3 text-brand-amber text-xs font-bold">
                      {lead.project_value ? `$${lead.project_value.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-white/70 text-xs">
                      {lead.estimated_sqft ? lead.estimated_sqft.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-white/40 text-xs">
                      {lead.scraped_at ? new Date(lead.scraped_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Truck tracker */}
      <Suspense fallback={<TabLoader />}>
        <TruckTracker />
      </Suspense>
    </div>
  )
}

// ── Grid tab — lazy-loads Leaflet only when needed ────────────────────────────

function GridTab() {
  const [sites, setSites]             = useState([])
  const [permitLeads, setPermitLeads] = useState([])
  const [scraping, setScraping]       = useState(false)
  const [scrapeMsg, setScrapeMsg]     = useState(null)

  useEffect(() => {
    const BASE = import.meta.env.VITE_API_BASE_URL || ''
    Promise.all([
      fetch(`${BASE}/api/v1/geo/sites`).then((r) => r.json()).catch(() => []),
      fetch(`${BASE}/api/v1/geo/radius-query`).then((r) => r.json()).catch(() => ({ permit_leads: [] })),
    ]).then(([sitesData, radiusData]) => {
      setSites(Array.isArray(sitesData) ? sitesData : [])
      setPermitLeads(radiusData.permit_leads || [])
    })
  }, [])

  const triggerScrape = async () => {
    setScraping(true)
    setScrapeMsg(null)
    try {
      const BASE = import.meta.env.VITE_API_BASE_URL || ''
      const res = await fetch(`${BASE}/api/v1/geo/permit-leads/scrape?max_pages=3`, { method: 'POST' })
      const data = await res.json()
      setScrapeMsg({ type: 'success', text: data.message || 'Scrape started' })
    } catch {
      setScrapeMsg({ type: 'error', text: 'Could not start scrape — is the backend online?' })
    } finally {
      setScraping(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold">Richmond Grid</h2>
          <p className="text-white/50 text-sm">
            {sites.length} sites · {permitLeads.length} permit leads within 20 miles
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={triggerScrape}
            disabled={scraping}
            className="bg-white/10 text-white border border-white/20 font-bold px-4 py-2 rounded-lg text-sm disabled:opacity-40 hover:bg-white/20 transition-colors flex items-center gap-2"
          >
            <span>📡</span> {scraping ? 'Scraping…' : 'Scrape VA Permits'}
          </button>
        </div>
      </div>

      {scrapeMsg && (
        <p className={`text-sm px-3 py-2 rounded-lg ${scrapeMsg.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
          {scrapeMsg.text}
        </p>
      )}

      <Suspense fallback={<TabLoader />}>
        <RichmondGrid
          sites={sites}
          permitLeads={permitLeads}
          onPolygonSaved={(site) => setSites((prev) => [site, ...prev])}
        />
      </Suspense>
    </div>
  )
}

// ── Main CommandCenter component ──────────────────────────────────────────────

export default function CommandCenter() {
  const [activeTab, setActiveTab] = useState('grid')

  return (
    <div className="min-h-screen bg-brand-navy pt-16">
      {/* Page header */}
      <div className="bg-brand-navy/95 border-b border-white/10 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div>
              <h1 className="font-display font-black text-white text-xl leading-tight">
                JWordenAI <span className="text-brand-amber">Command Center</span>
              </h1>
              <p className="text-white/40 text-xs mt-0.5">4D Virtual Foreman · Real-time Operations</p>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-white/30">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Systems Online
            </div>
          </div>

          {/* Tab bar */}
          <nav className="flex gap-1 overflow-x-auto pb-0 -mb-px" aria-label="Command center sections">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-brand-amber text-brand-amber'
                    : 'border-transparent text-white/50 hover:text-white hover:border-white/30'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'grid' && (
          <Suspense fallback={<TabLoader />}>
            <GridTab />
          </Suspense>
        )}

        {activeTab === 'foreman' && (
          <div className="max-w-3xl mx-auto" style={{ height: '70vh' }}>
            <Suspense fallback={<TabLoader />}>
              <VirtualForeman />
            </Suspense>
          </div>
        )}

        {activeTab === 'field' && (
          <div className="max-w-2xl mx-auto">
            <div className="mb-4">
              <h2 className="text-white font-bold">Live Field Feed</h2>
              <p className="text-white/50 text-sm">
                Real-time lot measurement via TF.js (on-device) or PyTorch (server-side).
              </p>
            </div>
            <Suspense fallback={<TabLoader />}>
              <LiveFieldFeed />
            </Suspense>
          </div>
        )}

        {activeTab === 'dash' && <DashboardTab />}
      </div>
    </div>
  )
}
