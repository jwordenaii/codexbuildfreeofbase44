/**
 * BidIntelPanel — AI Bid Win-Rate Optimizer for the Command Center.
 * Pulls from /api/v1/bid-intelligence/*
 */
import { useState, useEffect, useCallback } from 'react'
import { api } from '../../api/client'

const BLANK = {
  lead_id: '', lead_name: '', service_type: '', region: '',
  proposal_amount_low: '', proposal_amount_high: '',
  outcome: 'won', competitor_name: '', competitor_price: '', notes: '',
}

function OutcomeTag({ outcome }) {
  const styles = {
    won: 'bg-green-100 text-green-700',
    lost: 'bg-red-100 text-red-700',
    'no-decision': 'bg-gray-100 text-gray-600',
  }
  return (
    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${styles[outcome] || styles['no-decision']}`}>
      {outcome}
    </span>
  )
}

export default function BidIntelPanel() {
  const [outcomes, setOutcomes] = useState([])
  const [summary, setSummary] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('overview')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [o, s] = await Promise.all([api.listBidOutcomes(), api.getBidSummary()])
      setOutcomes(o.outcomes || [])
      setSummary(s)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form }
      ;['lead_id','proposal_amount_low','proposal_amount_high','competitor_price'].forEach((k) => {
        payload[k] = form[k] !== '' ? Number(form[k]) : null
      })
      await api.recordBidOutcome(payload)
      setForm(BLANK)
      setShowAdd(false)
      load()
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const handleAnalyze = async () => {
    setAnalyzing(true)
    setAnalysis(null)
    try {
      const d = await api.getBidWinAnalysis()
      setAnalysis(d)
    } catch (err) { setError(err.message) } finally { setAnalyzing(false) }
  }

  const handleDelete = async (id) => {
    await api.deleteBidOutcome(id)
    load()
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  if (loading) return (
    <div className="flex items-center justify-center h-32 text-brand-navy/40 text-sm gap-3">
      <span className="w-5 h-5 border-2 border-brand-amber border-t-transparent rounded-full animate-spin" /> Loading…
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 flex-wrap items-center justify-between">
        <div className="flex gap-2">
          {[{ id: 'overview', label: '📊 Overview' }, { id: 'history', label: `📋 History (${outcomes.length})` }].map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                tab === t.id ? 'bg-brand-navy text-white border-brand-navy' : 'border-gray-200 text-brand-navy/60 hover:border-brand-navy/40'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setShowAdd(!showAdd)} className="btn-primary text-xs !py-1.5">
          + Record Outcome
        </button>
      </div>

      {error && (
        <div className="card p-4 bg-red-50 border-red-200 text-red-700 text-sm">
          {error} <button type="button" onClick={load} className="ml-2 underline text-xs">Retry</button>
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="card p-6">
          <h4 className="font-semibold text-brand-navy mb-4">Record Bid Outcome</h4>
          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Lead Name / Project</label>
              <input type="text" value={form.lead_name} onChange={(e) => set('lead_name', e.target.value)} required className="input text-sm w-full" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Outcome</label>
              <select value={form.outcome} onChange={(e) => set('outcome', e.target.value)} className="input text-sm w-full">
                <option value="won">Won</option>
                <option value="lost">Lost</option>
                <option value="no-decision">No Decision</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Service Type</label>
              <input type="text" value={form.service_type} onChange={(e) => set('service_type', e.target.value)} placeholder="paving, sealcoat…" className="input text-sm w-full" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Region</label>
              <input type="text" value={form.region} onChange={(e) => set('region', e.target.value)} placeholder="Richmond VA, Raleigh NC…" className="input text-sm w-full" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Our Bid Low ($)</label>
              <input type="number" min="0" step="any" value={form.proposal_amount_low} onChange={(e) => set('proposal_amount_low', e.target.value)} className="input text-sm w-full" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Our Bid High ($)</label>
              <input type="number" min="0" step="any" value={form.proposal_amount_high} onChange={(e) => set('proposal_amount_high', e.target.value)} className="input text-sm w-full" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Competitor Name</label>
              <input type="text" value={form.competitor_name} onChange={(e) => set('competitor_name', e.target.value)} className="input text-sm w-full" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Competitor Price ($)</label>
              <input type="number" min="0" step="any" value={form.competitor_price} onChange={(e) => set('competitor_price', e.target.value)} className="input text-sm w-full" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Notes</label>
              <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} className="input text-sm w-full" />
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary text-sm !py-2 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save Outcome'}
              </button>
              <button type="button" onClick={() => setShowAdd(false)} className="btn-outline text-sm !py-2">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Overview ── */}
      {tab === 'overview' && summary && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card p-5 text-center">
              <div className="font-display font-black text-3xl text-brand-amber">{summary.total_bids}</div>
              <div className="text-brand-navy text-sm font-semibold mt-1">Total Bids</div>
            </div>
            <div className="card p-5 text-center">
              <div className="font-display font-black text-3xl text-green-600">{summary.win_rate_pct}%</div>
              <div className="text-brand-navy text-sm font-semibold mt-1">Win Rate</div>
            </div>
            <div className="card p-5 text-center">
              <div className="font-display font-black text-3xl text-brand-navy">{summary.won}</div>
              <div className="text-brand-navy text-sm font-semibold mt-1">Won</div>
            </div>
            <div className="card p-5 text-center">
              <div className="font-display font-black text-3xl text-red-500">{summary.lost}</div>
              <div className="text-brand-navy text-sm font-semibold mt-1">Lost</div>
            </div>
          </div>

          {/* By service */}
          {summary.by_service?.length > 0 && (
            <div className="card p-6">
              <h3 className="font-display font-bold text-brand-navy mb-4">Win Rate by Service</h3>
              <div className="space-y-3">
                {summary.by_service.map((s) => (
                  <div key={s.service}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-brand-navy">{s.service}</span>
                      <span className="font-bold text-brand-navy">{s.win_rate_pct}% ({s.won}/{s.total})</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${s.win_rate_pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Analysis */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-brand-navy">🤖 AI Win-Rate Insights</h3>
              <button onClick={handleAnalyze} disabled={analyzing} className="btn-primary text-xs !py-1.5 disabled:opacity-50">
                {analyzing ? 'Analyzing…' : 'Analyze'}
              </button>
            </div>
            {analysis ? (
              <div className="space-y-2">
                <p className="text-xs text-brand-navy/50 mb-3">{analysis.analysis}</p>
                {analysis.insights.map((insight, i) => (
                  <div key={i} className="flex gap-3 bg-amber-50 rounded-lg px-3 py-2">
                    <span className="text-brand-amber font-bold">→</span>
                    <span className="text-sm text-brand-navy/80">{insight}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-brand-navy/40">Click &quot;Analyze&quot; to get AI-powered win/loss insights based on your bid history.</p>
            )}
          </div>
        </div>
      )}

      {/* ── History ── */}
      {tab === 'history' && (
        <div className="card p-6">
          {outcomes.length === 0 ? (
            <p className="text-center text-brand-navy/30 py-8 text-sm">No bid outcomes recorded yet. Start tracking to unlock AI insights.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-navy/10 text-xs text-brand-navy/50 font-semibold text-left">
                    <th className="pb-2 pr-3">Date</th>
                    <th className="pb-2 pr-3">Lead / Project</th>
                    <th className="pb-2 pr-3">Outcome</th>
                    <th className="pb-2 pr-3 hidden sm:table-cell">Service</th>
                    <th className="pb-2 pr-3 hidden md:table-cell">Our Bid</th>
                    <th className="pb-2 hidden md:table-cell">Competitor</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {outcomes.map((o) => (
                    <tr key={o.id} className="border-b border-brand-navy/5">
                      <td className="py-2.5 pr-3 text-xs text-brand-navy/50">{new Date(o.outcome_recorded_at).toLocaleDateString()}</td>
                      <td className="py-2.5 pr-3 font-semibold text-brand-navy">{o.lead_name || `Lead #${o.lead_id}`}</td>
                      <td className="py-2.5 pr-3"><OutcomeTag outcome={o.outcome} /></td>
                      <td className="py-2.5 pr-3 text-brand-navy/60 text-xs hidden sm:table-cell">{o.service_type || '—'}</td>
                      <td className="py-2.5 pr-3 text-brand-navy/60 text-xs hidden md:table-cell">
                        {o.proposal_amount_low ? `$${o.proposal_amount_low.toLocaleString()}` : '—'}
                      </td>
                      <td className="py-2.5 text-brand-navy/60 text-xs hidden md:table-cell">
                        {o.competitor_name || '—'}{o.competitor_price ? ` @ $${o.competitor_price.toLocaleString()}` : ''}
                      </td>
                      <td className="py-2.5">
                        <button onClick={() => handleDelete(o.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
