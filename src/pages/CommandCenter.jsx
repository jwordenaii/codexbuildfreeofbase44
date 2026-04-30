import { lazy, Suspense, useState, useCallback } from 'react'

const RichmondGrid = lazy(() => import('../components/RichmondGrid'))

const CC_PASSWORD = import.meta.env.VITE_CC_PASSWORD || ''

const TABS = [
  { id: 'richmond-grid', label: 'Richmond Grid' },
  { id: 'kpi', label: 'KPI Wall' },
  { id: 'crm', label: 'CRM Leads' },
]

function PinGate({ onUnlock }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault()
      if (pin === CC_PASSWORD) {
        onUnlock()
      } else {
        setError(true)
        setPin('')
      }
    },
    [pin, onUnlock],
  )

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl border border-brand-navy/10 bg-white p-8 shadow-xl text-center">
        <div className="w-14 h-14 rounded-xl bg-brand-navy flex items-center justify-center text-brand-amber text-2xl mx-auto mb-6">
          🔒
        </div>
        <h2 className="font-display font-bold text-2xl text-brand-navy mb-2">Command Center</h2>
        <p className="text-brand-navy/55 text-sm mb-6">Enter your access PIN to continue.</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            autoComplete="current-password"
            placeholder="PIN"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value)
              setError(false)
            }}
            className="w-full rounded-lg border border-brand-navy/20 px-4 py-3 text-center tracking-widest text-lg focus:outline-none focus:ring-2 focus:ring-brand-amber"
          />
          {error && (
            <p className="text-red-500 text-sm">Incorrect PIN. Try again.</p>
          )}
          <button type="submit" className="btn-primary py-3">
            Unlock
          </button>
        </form>
      </div>
    </div>
  )
}

export default function CommandCenter() {
  const [activeTab, setActiveTab] = useState('richmond-grid')
  const [unlocked, setUnlocked] = useState(!CC_PASSWORD)

  const handleUnlock = useCallback(() => setUnlocked(true), [])

  return (
    <div className="min-h-screen bg-brand-navy text-white">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-white/10 bg-brand-navy/95 sticky top-0 z-30">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display font-black text-xl sm:text-2xl text-white leading-tight">
              JWordenAI Command Center
            </h1>
            <p className="text-white/40 text-xs mt-0.5">Internal operations dashboard</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/20 text-white/60 text-xs font-semibold px-3 py-1">
            Internal
          </span>
        </div>

        {/* ── Tab bar ──────────────────────────────────────────────────────── */}
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 flex gap-1 pb-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={[
                'shrink-0 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-brand-amber text-brand-amber'
                  : 'border-transparent text-white/50 hover:text-white/80',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">
        {!unlocked ? (
          <PinGate onUnlock={handleUnlock} />
        ) : (
          <>
            {activeTab === 'richmond-grid' && (
              <Suspense
                fallback={
                  <div className="flex items-center justify-center h-96 text-white/50">
                    Loading map…
                  </div>
                }
              >
                <RichmondGrid />
              </Suspense>
            )}

            {activeTab === 'kpi' && (
              <div className="flex items-center justify-center h-96 text-white/40">
                KPI Wall — coming soon
              </div>
            )}

            {activeTab === 'crm' && (
              <div className="flex items-center justify-center h-96 text-white/40">
                CRM Leads — coming soon
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
