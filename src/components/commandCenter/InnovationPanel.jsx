/**
 * InnovationPanel — Innovation Lab Tracker for the Command Center.
 * Pulls from /api/v1/innovations/*
 */
import { useState, useEffect, useCallback } from 'react'
import { api } from '../../api/client'

const BLANK = {
  method_name: '', job_site: '', date_tested: '',
  cost_to_test: '', result: 'pass', category: '', notes: '',
}

const RESULT_STYLES = {
  adopted: 'bg-green-100 text-green-700',
  pass: 'bg-blue-100 text-blue-700',
  fail: 'bg-red-100 text-red-700',
}

const CATEGORIES = ['drone', 'materials', 'robotics', 'process', 'other']

export default function InnovationPanel() {
  const [innovations, setInnovations] = useState([])
  const [adopted, setAdopted] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('log')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [filterCat, setFilterCat] = useState('')
  const [filterResult, setFilterResult] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [inv, adp] = await Promise.all([api.listInnovations(), api.getAdoptedMethods()])
      setInnovations(inv.innovations || [])
      setAdopted(adp)
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
      await api.createInnovation({ ...form, cost_to_test: form.cost_to_test !== '' ? Number(form.cost_to_test) : null })
      setForm(BLANK)
      setShowAdd(false)
      load()
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this entry?')) return
    await api.deleteInnovation(id)
    load()
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const filtered = innovations.filter((i) =>
    (!filterCat || i.category === filterCat) &&
    (!filterResult || i.result === filterResult)
  )

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
          {[{ id: 'log', label: `🧪 Lab Log (${innovations.length})` }, { id: 'adopted', label: `✅ Adopted (${adopted?.total_adopted ?? 0})` }].map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                tab === t.id ? 'bg-brand-navy text-white border-brand-navy' : 'border-gray-200 text-brand-navy/60 hover:border-brand-navy/40'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'log' && (
          <button type="button" onClick={() => setShowAdd(!showAdd)} className="btn-primary text-xs !py-1.5">
            + Log Trial
          </button>
        )}
      </div>

      {error && (
        <div className="card p-4 bg-red-50 border-red-200 text-red-700 text-sm">
          {error} <button type="button" onClick={load} className="ml-2 underline text-xs">Retry</button>
        </div>
      )}

      {/* ── Add form ── */}
      {tab === 'log' && showAdd && (
        <div className="card p-6">
          <h4 className="font-semibold text-brand-navy mb-4">Log Innovation Trial</h4>
          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Method / Tool Name</label>
              <input type="text" value={form.method_name} onChange={(e) => set('method_name', e.target.value)} required placeholder="e.g. Drone Survey, 3D Paver Control" className="input text-sm w-full" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Category</label>
              <select value={form.category} onChange={(e) => set('category', e.target.value)} className="input text-sm w-full">
                <option value="">— select —</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Job Site</label>
              <input type="text" value={form.job_site} onChange={(e) => set('job_site', e.target.value)} className="input text-sm w-full" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Date Tested</label>
              <input type="date" value={form.date_tested} onChange={(e) => set('date_tested', e.target.value)} className="input text-sm w-full" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Cost to Test ($)</label>
              <input type="number" min="0" step="any" value={form.cost_to_test} onChange={(e) => set('cost_to_test', e.target.value)} className="input text-sm w-full" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Result</label>
              <select value={form.result} onChange={(e) => set('result', e.target.value)} className="input text-sm w-full">
                <option value="pass">Pass</option>
                <option value="fail">Fail</option>
                <option value="adopted">Adopted</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Notes</label>
              <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} className="input text-sm w-full" />
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary text-sm !py-2 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save Trial'}
              </button>
              <button type="button" onClick={() => setShowAdd(false)} className="btn-outline text-sm !py-2">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Lab Log ── */}
      {tab === 'log' && (
        <>
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="input text-xs !py-1.5">
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filterResult} onChange={(e) => setFilterResult(e.target.value)} className="input text-xs !py-1.5">
              <option value="">All Results</option>
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
              <option value="adopted">Adopted</option>
            </select>
          </div>
          <div className="card p-6">
            {filtered.length === 0 ? (
              <p className="text-center text-brand-navy/30 py-8 text-sm">
                {innovations.length === 0 ? 'No trials logged yet. Start your innovation lab.' : 'No matches for current filters.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-navy/10 text-xs text-brand-navy/50 font-semibold text-left">
                      <th className="pb-2 pr-3">Method</th>
                      <th className="pb-2 pr-3 hidden sm:table-cell">Category</th>
                      <th className="pb-2 pr-3 hidden sm:table-cell">Site</th>
                      <th className="pb-2 pr-3">Result</th>
                      <th className="pb-2 pr-3 hidden md:table-cell">Cost</th>
                      <th className="pb-2 hidden md:table-cell">Date</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((i) => (
                      <tr key={i.id} className="border-b border-brand-navy/5">
                        <td className="py-2.5 pr-3">
                          <div className="font-semibold text-brand-navy">{i.method_name}</div>
                          {i.notes && <div className="text-xs text-brand-navy/40 truncate max-w-xs">{i.notes}</div>}
                        </td>
                        <td className="py-2.5 pr-3 text-xs text-brand-navy/60 hidden sm:table-cell">{i.category || '—'}</td>
                        <td className="py-2.5 pr-3 text-xs text-brand-navy/60 hidden sm:table-cell">{i.job_site || '—'}</td>
                        <td className="py-2.5 pr-3">
                          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${RESULT_STYLES[i.result] || 'bg-gray-100 text-gray-600'}`}>
                            {i.result}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-xs text-brand-navy/60 hidden md:table-cell">
                          {i.cost_to_test != null ? `$${i.cost_to_test.toLocaleString()}` : '—'}
                        </td>
                        <td className="py-2.5 text-xs text-brand-navy/60 hidden md:table-cell">
                          {i.date_tested ? new Date(i.date_tested).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-2.5">
                          <button onClick={() => handleDelete(i.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
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

      {/* ── Adopted Methods ── */}
      {tab === 'adopted' && adopted && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="card p-5 text-center">
              <div className="font-display font-black text-3xl text-green-600">{adopted.total_adopted}</div>
              <div className="text-sm text-brand-navy font-semibold mt-1">Methods Adopted</div>
            </div>
            <div className="card p-5 text-center">
              <div className="font-display font-black text-3xl text-brand-amber">
                ${(adopted.total_test_investment || 0).toLocaleString()}
              </div>
              <div className="text-sm text-brand-navy font-semibold mt-1">Total R&D Investment</div>
            </div>
          </div>

          {Object.entries(adopted.by_category || {}).length > 0 && (
            <div className="card p-6">
              <h3 className="font-display font-bold text-brand-navy mb-4">Adopted by Category</h3>
              <div className="space-y-3">
                {Object.entries(adopted.by_category).map(([cat, methods]) => (
                  <div key={cat} className="bg-green-50 rounded-xl px-4 py-3">
                    <div className="text-xs font-bold text-brand-navy/60 uppercase mb-2">{cat}</div>
                    <div className="flex flex-wrap gap-1">
                      {methods.map((m) => (
                        <span key={m} className="bg-green-200 text-green-800 text-xs font-semibold px-2 py-0.5 rounded-full">{m}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {adopted.methods?.length === 0 && (
            <div className="text-center py-12 text-brand-navy/30 text-sm">
              No methods adopted yet. Mark trials as &quot;adopted&quot; to build your competitive intelligence asset.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
