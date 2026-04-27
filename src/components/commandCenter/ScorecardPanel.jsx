/**
 * ScorecardPanel — Project Performance Scorecard / Reputation Engine.
 * Pulls from /api/v1/project-metrics/*
 */
import { useState, useEffect, useCallback } from 'react'
import { api } from '../../api/client'

const BLANK = {
  project_name: '', lead_id: '', actual_cost: '', estimated_cost: '',
  scheduled_days: '', actual_days: '', client_nps: '', punch_list_items: '0',
  punch_list_closed: '0', completion_date: '',
}

function MetricBar({ label, value, color = 'bg-brand-amber' }) {
  if (value == null) return null
  const pct = Math.min(Math.max(value, 0), 100)
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-brand-navy/60">{label}</span>
        <span className="font-bold text-brand-navy">{value}%</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function NPSBar({ value }) {
  if (value == null) return null
  const pct = (value / 10) * 100
  const color = value >= 8 ? 'bg-green-500' : value >= 6 ? 'bg-yellow-400' : 'bg-red-400'
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-brand-navy/60">Client NPS</span>
        <span className="font-bold text-brand-navy">{value}/10</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function ScorecardPanel() {
  const [metrics, setMetrics] = useState([])
  const [trends, setTrends] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('portfolio')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [generatingStudy, setGeneratingStudy] = useState(null)
  const [caseStudy, setCaseStudy] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [m, t] = await Promise.all([api.listProjectMetrics(), api.getProjectMetricTrends()])
      setMetrics(m.metrics || [])
      setTrends(t)
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
      ;['lead_id','actual_cost','estimated_cost','scheduled_days','actual_days','client_nps','punch_list_items','punch_list_closed'].forEach((k) => {
        payload[k] = form[k] !== '' ? Number(form[k]) : null
      })
      await api.createProjectMetric(payload)
      setForm(BLANK)
      setShowAdd(false)
      load()
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const handleGenerateCase = async (id) => {
    setGeneratingStudy(id)
    setCaseStudy(null)
    try {
      const d = await api.generateCaseStudy(id)
      setCaseStudy(d.case_study_text)
      load()
    } catch (err) { setError(err.message) } finally { setGeneratingStudy(null) }
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const avgs = trends?.averages || {}

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
          {[{ id: 'portfolio', label: '📊 Portfolio Trends' }, { id: 'projects', label: `📋 Projects (${metrics.length})` }].map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                tab === t.id ? 'bg-brand-navy text-white border-brand-navy' : 'border-gray-200 text-brand-navy/60 hover:border-brand-navy/40'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setShowAdd(!showAdd)} className="btn-primary text-xs !py-1.5">
          + Add Scorecard
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
          <h4 className="font-semibold text-brand-navy mb-4">Add Project Scorecard</h4>
          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Project Name</label>
              <input type="text" value={form.project_name} onChange={(e) => set('project_name', e.target.value)} required className="input text-sm w-full" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Completion Date</label>
              <input type="date" value={form.completion_date} onChange={(e) => set('completion_date', e.target.value)} className="input text-sm w-full" />
            </div>
            {[
              ['estimated_cost', 'Estimated Cost ($)'],
              ['actual_cost', 'Actual Cost ($)'],
              ['scheduled_days', 'Scheduled Days'],
              ['actual_days', 'Actual Days'],
              ['client_nps', 'Client NPS (0–10)'],
              ['punch_list_items', 'Punch List Items'],
              ['punch_list_closed', 'Punch List Closed'],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-brand-navy/60 mb-1">{label}</label>
                <input type="number" min="0" step="any" value={form[key]} onChange={(e) => set(key, e.target.value)} className="input text-sm w-full" />
              </div>
            ))}
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary text-sm !py-2 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save Scorecard'}
              </button>
              <button type="button" onClick={() => setShowAdd(false)} className="btn-outline text-sm !py-2">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Portfolio Trends ── */}
      {tab === 'portfolio' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              ['Projects Scored', trends?.count ?? '—', 'text-brand-amber'],
              ['Cost Accuracy', avgs.cost_accuracy_pct != null ? `${avgs.cost_accuracy_pct}%` : '—', 'text-blue-600'],
              ['On-Time Rate', avgs.schedule_adherence_pct != null ? `${avgs.schedule_adherence_pct}%` : '—', 'text-green-600'],
              ['Avg Client NPS', avgs.avg_client_nps != null ? `${avgs.avg_client_nps}/10` : '—', 'text-purple-600'],
            ].map(([label, value, color]) => (
              <div key={label} className="card p-5 text-center">
                <div className={`font-display font-black text-3xl ${color}`}>{value}</div>
                <div className="text-brand-navy font-semibold text-sm mt-1">{label}</div>
              </div>
            ))}
          </div>
          <div className="card p-6 space-y-4">
            <h3 className="font-display font-bold text-brand-navy text-lg">Portfolio KPI Bars</h3>
            <MetricBar label="Cost Accuracy" value={avgs.cost_accuracy_pct} color="bg-blue-500" />
            <MetricBar label="Schedule Adherence" value={avgs.schedule_adherence_pct} color="bg-green-500" />
            <MetricBar label="Punch List Closure" value={avgs.punch_closure_pct} color="bg-brand-amber" />
            <NPSBar value={avgs.avg_client_nps} />
          </div>
        </div>
      )}

      {/* ── Projects list ── */}
      {tab === 'projects' && (
        <div className="space-y-4">
          {caseStudy && (
            <div className="card p-5 bg-amber-50 border-amber-200">
              <div className="font-bold text-brand-navy mb-2">📄 Generated Case Study</div>
              <p className="text-sm text-brand-navy/80 whitespace-pre-wrap">{caseStudy}</p>
              <div className="flex gap-3 mt-3">
                <button onClick={() => navigator.clipboard?.writeText(caseStudy)} className="text-xs px-3 py-1 bg-white rounded-full border border-brand-navy/20 text-brand-navy hover:bg-gray-50">
                  📋 Copy
                </button>
                <button onClick={() => setCaseStudy(null)} className="text-xs text-brand-navy/40 underline">Dismiss</button>
              </div>
            </div>
          )}
          {metrics.length === 0 ? (
            <div className="text-center py-16 text-brand-navy/30 text-sm">No scorecards yet. Add your first completed project.</div>
          ) : (
            metrics.map((m) => (
              <div key={m.id} className="card p-5 space-y-3">
                <div className="flex justify-between items-start flex-wrap gap-2">
                  <div>
                    <div className="font-display font-bold text-brand-navy">{m.project_name}</div>
                    {m.completion_date && (
                      <div className="text-xs text-brand-navy/40">{new Date(m.completion_date).toLocaleDateString()}</div>
                    )}
                  </div>
                  <button
                    onClick={() => handleGenerateCase(m.id)}
                    disabled={generatingStudy === m.id}
                    className="text-xs px-3 py-1 bg-brand-amber/20 text-brand-navy rounded-full font-semibold hover:bg-brand-amber/30 disabled:opacity-50"
                  >
                    {generatingStudy === m.id ? '…' : '✨ Case Study'}
                  </button>
                </div>
                <MetricBar label="Cost Accuracy" value={m.cost_accuracy_pct} color="bg-blue-500" />
                <MetricBar label="Schedule Adherence" value={m.schedule_adherence_pct} color="bg-green-500" />
                <MetricBar label="Punch List Closure" value={m.punch_closure_pct} color="bg-brand-amber" />
                <NPSBar value={m.client_nps} />
                {m.case_study_published && m.case_study_text && (
                  <div className="text-xs text-brand-navy/50 bg-gray-50 rounded-lg px-3 py-2 line-clamp-2">{m.case_study_text}</div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
