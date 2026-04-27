/**
 * SafetyPanel — Safety Culture Dashboard for the Command Center.
 * Pulls from /api/v1/safety/*
 */
import { useState, useEffect, useCallback } from 'react'
import { api } from '../../api/client'

const TALK_BLANK = { job_site: '', talk_date: '', topic: '', foreman: '', crew_count: '0', signed_off: '0', notes: '' }
const INC_BLANK = {
  job_site: '', incident_date: '', incident_type: 'near-miss',
  root_cause: '', description: '', corrective_action: '', osha_recordable: '0', days_away: '0',
}

function StatCard({ label, value, sub, color = 'text-brand-amber' }) {
  return (
    <div className="card p-5 text-center">
      <div className={`font-display font-black text-3xl ${color}`}>{value ?? '—'}</div>
      <div className="text-brand-navy font-semibold text-sm mt-1">{label}</div>
      {sub && <div className="text-brand-navy/40 text-xs mt-0.5">{sub}</div>}
    </div>
  )
}

function ScoreBar({ score }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-400' : 'bg-red-500'
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-sm font-bold text-brand-navy w-12 text-right">{score}</span>
    </div>
  )
}

export default function SafetyPanel() {
  const [tab, setTab] = useState('talks')
  const [talks, setTalks] = useState([])
  const [incidents, setIncidents] = useState([])
  const [oshaRate, setOshaRate] = useState(null)
  const [scores, setScores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [talkForm, setTalkForm] = useState(TALK_BLANK)
  const [incForm, setIncForm] = useState(INC_BLANK)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [t, i, o, s] = await Promise.all([
        api.listToolboxTalks(),
        api.listIncidents(),
        api.getOshaRate(),
        api.getSafetyScores(),
      ])
      setTalks(t.talks || [])
      setIncidents(i.incidents || [])
      setOshaRate(o)
      setScores(s.sites || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSaveTalk = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.createToolboxTalk({ ...talkForm, crew_count: Number(talkForm.crew_count), signed_off: Number(talkForm.signed_off) })
      setTalkForm(TALK_BLANK)
      setShowAdd(false)
      load()
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const handleSaveInc = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.createIncident({ ...incForm, osha_recordable: Number(incForm.osha_recordable), days_away: Number(incForm.days_away) })
      setIncForm(INC_BLANK)
      setShowAdd(false)
      load()
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const setT = (k, v) => setTalkForm((f) => ({ ...f, [k]: v }))
  const setI = (k, v) => setIncForm((f) => ({ ...f, [k]: v }))

  const TABS = [
    { id: 'talks', label: '📋 Toolbox Talks' },
    { id: 'incidents', label: '⚠️ Incidents' },
    { id: 'osha', label: '📊 OSHA Rate' },
    { id: 'scores', label: '🏆 Site Scores' },
  ]

  if (loading) return (
    <div className="flex items-center justify-center h-32 text-brand-navy/40 text-sm gap-3">
      <span className="w-5 h-5 border-2 border-brand-amber border-t-transparent rounded-full animate-spin" />
      Loading safety data…
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Sub-tab bar */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setTab(t.id); setShowAdd(false) }}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              tab === t.id ? 'bg-brand-navy text-white border-brand-navy' : 'border-gray-200 text-brand-navy/60 hover:border-brand-navy/40'
            }`}
          >
            {t.label}
          </button>
        ))}
        {(tab === 'talks' || tab === 'incidents') && (
          <button
            type="button"
            onClick={() => setShowAdd(!showAdd)}
            className="btn-primary text-xs !py-1.5 ml-auto"
          >
            + Log {tab === 'talks' ? 'Talk' : 'Incident'}
          </button>
        )}
      </div>

      {error && (
        <div className="card p-4 bg-red-50 border-red-200 text-red-700 text-sm">
          {error} <button type="button" onClick={load} className="ml-2 underline text-xs">Retry</button>
        </div>
      )}

      {/* ── Toolbox Talks ── */}
      {tab === 'talks' && (
        <>
          {showAdd && (
            <div className="card p-6">
              <h4 className="font-semibold text-brand-navy mb-4">Log Toolbox Talk</h4>
              <form onSubmit={handleSaveTalk} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[['job_site','Job Site','text',true],['topic','Topic','text',true],['foreman','Foreman','text',false]].map(([k,l,type,req]) => (
                  <div key={k}>
                    <label className="block text-xs font-semibold text-brand-navy/60 mb-1">{l}</label>
                    <input type={type} value={talkForm[k]} onChange={(e) => setT(k, e.target.value)} required={req} className="input text-sm w-full" />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Date</label>
                  <input type="date" value={talkForm.talk_date} onChange={(e) => setT('talk_date', e.target.value)} required className="input text-sm w-full" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Crew Count</label>
                  <input type="number" min="0" value={talkForm.crew_count} onChange={(e) => setT('crew_count', e.target.value)} className="input text-sm w-full" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Crew Signed Off?</label>
                  <select value={talkForm.signed_off} onChange={(e) => setT('signed_off', e.target.value)} className="input text-sm w-full">
                    <option value="1">Yes</option>
                    <option value="0">No</option>
                  </select>
                </div>
                <div className="sm:col-span-2 flex gap-3">
                  <button type="submit" disabled={saving} className="btn-primary text-sm !py-2 disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button type="button" onClick={() => setShowAdd(false)} className="btn-outline text-sm !py-2">Cancel</button>
                </div>
              </form>
            </div>
          )}
          <div className="card p-6">
            {talks.length === 0 ? (
              <p className="text-center text-brand-navy/30 py-8 text-sm">No toolbox talks logged yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-navy/10 text-xs text-brand-navy/50 font-semibold text-left">
                      <th className="pb-2 pr-3">Date</th>
                      <th className="pb-2 pr-3">Site</th>
                      <th className="pb-2 pr-3">Topic</th>
                      <th className="pb-2 pr-3 hidden sm:table-cell">Foreman</th>
                      <th className="pb-2">Crew</th>
                    </tr>
                  </thead>
                  <tbody>
                    {talks.map((t) => (
                      <tr key={t.id} className="border-b border-brand-navy/5">
                        <td className="py-2.5 pr-3 text-brand-navy/60 text-xs">{new Date(t.talk_date).toLocaleDateString()}</td>
                        <td className="py-2.5 pr-3 font-semibold text-brand-navy">{t.job_site}</td>
                        <td className="py-2.5 pr-3 text-brand-navy/70">{t.topic}</td>
                        <td className="py-2.5 pr-3 text-brand-navy/60 hidden sm:table-cell">{t.foreman || '—'}</td>
                        <td className="py-2.5">
                          <span className="text-brand-navy/60">{t.crew_count}</span>
                          {t.signed_off && <span className="ml-2 text-green-600 text-xs">✓</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Incidents ── */}
      {tab === 'incidents' && (
        <>
          {showAdd && (
            <div className="card p-6">
              <h4 className="font-semibold text-brand-navy mb-4">Log Incident</h4>
              <form onSubmit={handleSaveInc} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Job Site</label>
                  <input type="text" value={incForm.job_site} onChange={(e) => setI('job_site', e.target.value)} required className="input text-sm w-full" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Date</label>
                  <input type="date" value={incForm.incident_date} onChange={(e) => setI('incident_date', e.target.value)} required className="input text-sm w-full" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Incident Type</label>
                  <select value={incForm.incident_type} onChange={(e) => setI('incident_type', e.target.value)} className="input text-sm w-full">
                    <option value="near-miss">Near Miss</option>
                    <option value="first-aid">First Aid</option>
                    <option value="recordable">Recordable</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-navy/60 mb-1">OSHA Recordable?</label>
                  <select value={incForm.osha_recordable} onChange={(e) => setI('osha_recordable', e.target.value)} className="input text-sm w-full">
                    <option value="0">No</option>
                    <option value="1">Yes</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Root Cause</label>
                  <input type="text" value={incForm.root_cause} onChange={(e) => setI('root_cause', e.target.value)} className="input text-sm w-full" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Days Away</label>
                  <input type="number" min="0" value={incForm.days_away} onChange={(e) => setI('days_away', e.target.value)} className="input text-sm w-full" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Description</label>
                  <textarea value={incForm.description} onChange={(e) => setI('description', e.target.value)} rows={2} className="input text-sm w-full" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Corrective Action</label>
                  <textarea value={incForm.corrective_action} onChange={(e) => setI('corrective_action', e.target.value)} rows={2} className="input text-sm w-full" />
                </div>
                <div className="sm:col-span-2 flex gap-3">
                  <button type="submit" disabled={saving} className="btn-primary text-sm !py-2 disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button type="button" onClick={() => setShowAdd(false)} className="btn-outline text-sm !py-2">Cancel</button>
                </div>
              </form>
            </div>
          )}
          <div className="card p-6">
            {incidents.length === 0 ? (
              <p className="text-center text-brand-navy/30 py-8 text-sm">No incidents logged. ✅</p>
            ) : (
              <div className="space-y-3">
                {incidents.map((i) => (
                  <div key={i.id} className={`rounded-xl p-4 text-sm border ${
                    i.osha_recordable ? 'bg-red-50 border-red-200' : i.incident_type === 'near-miss' ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <span className="font-bold text-brand-navy">{i.job_site}</span>
                        <span className="ml-3 text-xs text-brand-navy/50">{new Date(i.incident_date).toLocaleDateString()}</span>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        i.osha_recordable ? 'bg-red-200 text-red-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {i.incident_type}{i.osha_recordable ? ' · OSHA' : ''}
                      </span>
                    </div>
                    {i.root_cause && <p className="text-brand-navy/60 mt-1 text-xs">Root cause: {i.root_cause}</p>}
                    {i.description && <p className="text-brand-navy/70 mt-1 text-xs">{i.description}</p>}
                    {i.corrective_action && <p className="text-green-700 mt-1 text-xs">✅ Action: {i.corrective_action}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── OSHA Rate ── */}
      {tab === 'osha' && oshaRate && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="TRIR" value={oshaRate.trir} sub="per 100 workers" color={oshaRate.trir <= 3.4 ? 'text-green-600' : 'text-red-600'} />
            <StatCard label="Recordables" value={oshaRate.recordable_incidents} />
            <StatCard label="Industry Avg" value={oshaRate.benchmark_industry_avg} sub="BLS construction" color="text-brand-navy/60" />
            <StatCard
              label="Status"
              value={oshaRate.status === 'below_benchmark' ? '✅ Good' : '⚠️ High'}
              color={oshaRate.status === 'below_benchmark' ? 'text-green-600' : 'text-red-600'}
            />
          </div>
          <div className="card p-5 text-sm text-brand-navy/70">
            <p><strong>OSHA TRIR Formula:</strong> (Recordable Incidents × 200,000) / Total Hours Worked</p>
            <p className="mt-1">Based on {oshaRate.total_hours_worked.toLocaleString()} estimated hours. Industry average: {oshaRate.benchmark_industry_avg} per 100 workers.</p>
          </div>
        </div>
      )}

      {/* ── Site Scores ── */}
      {tab === 'scores' && (
        <div className="card p-6">
          {scores.length === 0 ? (
            <p className="text-center text-brand-navy/30 py-8 text-sm">No site data yet. Log talks and incidents to generate scores.</p>
          ) : (
            <div className="space-y-4">
              {scores.map((s) => (
                <div key={s.job_site}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-brand-navy">{s.job_site}</span>
                    <span className="text-brand-navy/50 text-xs">{s.talks} talks · {s.incidents} incidents · {s.recordables} recordable</span>
                  </div>
                  <ScoreBar score={s.score} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
