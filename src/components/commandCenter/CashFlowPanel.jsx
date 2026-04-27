/**
 * CashFlowPanel — 13-Week Rolling Cash Flow Projection.
 * Pulls from /api/v1/cashflow/*
 */
import { useState, useEffect, useCallback } from 'react'
import { api } from '../../api/client'

const BLANK = { entry_type: 'income', amount: '', expected_date: '', category: '', description: '' }

function WeekBar({ week }) {
  const isNegative = week.net < 0
  const color = week.cumulative < 0 ? 'bg-red-500' : week.net >= 0 ? 'bg-green-500' : 'bg-red-400'
  const maxAbs = 50000 // scale bar
  const pct = Math.min(Math.abs(week.net) / maxAbs * 100, 100)
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="w-14 text-right text-brand-navy/50 shrink-0">{week.label}</div>
      <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden relative">
        {pct > 0 && (
          <div
            className={`h-full ${color} rounded-full transition-all`}
            style={{ width: `${pct}%`, marginLeft: isNegative ? 'auto' : 0 }}
          />
        )}
      </div>
      <div className={`w-20 text-right font-semibold ${week.net >= 0 ? 'text-green-700' : 'text-red-600'}`}>
        {week.net >= 0 ? '+' : ''}{week.net.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })}
      </div>
      <div className={`w-20 text-right text-xs ${week.cumulative >= 0 ? 'text-brand-navy/50' : 'text-red-500 font-bold'}`}>
        {week.cumulative.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })}
      </div>
    </div>
  )
}

export default function CashFlowPanel() {
  const [forecast, setForecast] = useState(null)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('forecast')
  const [threshold, setThreshold] = useState('')
  const [savingThreshold, setSavingThreshold] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [fc, ent, alert] = await Promise.all([
        api.getCashFlowForecast(),
        api.listCashFlowEntries(),
        api.getCashFlowAlert(),
      ])
      setForecast(fc)
      setEntries(ent.entries || [])
      setThreshold(String(alert.threshold_amount || 10000))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleAdd = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.createCashFlowEntry({ ...form, amount: Number(form.amount) })
      setForm(BLANK)
      setShowAdd(false)
      load()
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const handleDeleteEntry = async (id) => {
    await api.deleteCashFlowEntry(id)
    load()
  }

  const handleSaveThreshold = async () => {
    setSavingThreshold(true)
    try {
      await api.setCashFlowAlert({ threshold_amount: Number(threshold) })
      load()
    } catch (err) { setError(err.message) } finally { setSavingThreshold(false) }
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const totalIncome = entries.filter((e) => e.entry_type === 'income').reduce((s, e) => s + e.amount, 0)
  const totalExpense = entries.filter((e) => e.entry_type === 'expense').reduce((s, e) => s + e.amount, 0)

  if (loading) return (
    <div className="flex items-center justify-center h-32 text-brand-navy/40 text-sm gap-3">
      <span className="w-5 h-5 border-2 border-brand-amber border-t-transparent rounded-full animate-spin" /> Loading…
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Alert banner */}
      {forecast?.alert_triggered && (
        <div className="card p-4 bg-red-50 border-red-300 text-red-700 flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <div className="font-bold">Cash Alert: Projected balance dips below ${Number(threshold).toLocaleString()}</div>
            <div className="text-sm">Min projected: {forecast.min_projected_balance.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })}</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'forecast', label: '📈 13-Week Forecast' },
          { id: 'entries', label: `📋 Entries (${entries.length})` },
          { id: 'settings', label: '⚙️ Alert Settings' },
        ].map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              tab === t.id ? 'bg-brand-navy text-white border-brand-navy' : 'border-gray-200 text-brand-navy/60 hover:border-brand-navy/40'
            }`}>
            {t.label}
          </button>
        ))}
        {(tab === 'entries') && (
          <button type="button" onClick={() => setShowAdd(!showAdd)} className="btn-primary text-xs !py-1.5 ml-auto">
            + Add Entry
          </button>
        )}
      </div>

      {error && (
        <div className="card p-4 bg-red-50 border-red-200 text-red-700 text-sm">
          {error} <button type="button" onClick={load} className="ml-2 underline text-xs">Retry</button>
        </div>
      )}

      {/* ── Forecast ── */}
      {tab === 'forecast' && forecast && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4 text-center">
              <div className="font-display font-black text-2xl text-green-600">
                {totalIncome.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })}
              </div>
              <div className="text-xs text-brand-navy/60 mt-1">Scheduled Income</div>
            </div>
            <div className="card p-4 text-center">
              <div className="font-display font-black text-2xl text-red-600">
                {totalExpense.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })}
              </div>
              <div className="text-xs text-brand-navy/60 mt-1">Scheduled Expenses</div>
            </div>
            <div className="card p-4 text-center">
              <div className={`font-display font-black text-2xl ${forecast.min_projected_balance >= 0 ? 'text-brand-amber' : 'text-red-600'}`}>
                {forecast.min_projected_balance.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })}
              </div>
              <div className="text-xs text-brand-navy/60 mt-1">Min Projected Balance</div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex justify-between text-xs text-brand-navy/50 mb-3 px-16 pr-0">
              <span>Week</span>
              <div className="flex gap-20 pr-2">
                <span>Weekly Net</span>
                <span>Cumulative</span>
              </div>
            </div>
            <div className="space-y-2">
              {forecast.weeks.map((w) => <WeekBar key={w.label} week={w} />)}
            </div>
            <div className="mt-4 text-xs text-brand-navy/40 text-right">
              Alert threshold: {Number(threshold).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })}
            </div>
          </div>
        </div>
      )}

      {/* ── Entries ── */}
      {tab === 'entries' && (
        <>
          {showAdd && (
            <div className="card p-6">
              <h4 className="font-semibold text-brand-navy mb-4">Add Cash Flow Entry</h4>
              <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Type</label>
                  <select value={form.entry_type} onChange={(e) => set('entry_type', e.target.value)} className="input text-sm w-full">
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Amount ($)</label>
                  <input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => set('amount', e.target.value)} required className="input text-sm w-full" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Expected Date</label>
                  <input type="date" value={form.expected_date} onChange={(e) => set('expected_date', e.target.value)} required className="input text-sm w-full" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Category</label>
                  <select value={form.category} onChange={(e) => set('category', e.target.value)} className="input text-sm w-full">
                    <option value="">— select —</option>
                    <option value="contract">Contract Payment</option>
                    <option value="payroll">Payroll</option>
                    <option value="materials">Materials</option>
                    <option value="equipment">Equipment</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Description</label>
                  <input type="text" value={form.description} onChange={(e) => set('description', e.target.value)} className="input text-sm w-full" />
                </div>
                <div className="sm:col-span-2 flex gap-3">
                  <button type="submit" disabled={saving} className="btn-primary text-sm !py-2 disabled:opacity-50">
                    {saving ? 'Saving…' : 'Add Entry'}
                  </button>
                  <button type="button" onClick={() => setShowAdd(false)} className="btn-outline text-sm !py-2">Cancel</button>
                </div>
              </form>
            </div>
          )}
          <div className="card p-6">
            {entries.length === 0 ? (
              <p className="text-center text-brand-navy/30 py-8 text-sm">No entries yet. Add income and expenses to build the forecast.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-navy/10 text-xs text-brand-navy/50 font-semibold text-left">
                      <th className="pb-2 pr-3">Date</th>
                      <th className="pb-2 pr-3">Type</th>
                      <th className="pb-2 pr-3">Amount</th>
                      <th className="pb-2 pr-3 hidden sm:table-cell">Category</th>
                      <th className="pb-2">Description</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.id} className="border-b border-brand-navy/5">
                        <td className="py-2.5 pr-3 text-xs text-brand-navy/60">{new Date(e.expected_date).toLocaleDateString()}</td>
                        <td className="py-2.5 pr-3">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${e.entry_type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {e.entry_type}
                          </span>
                        </td>
                        <td className={`py-2.5 pr-3 font-semibold ${e.entry_type === 'income' ? 'text-green-700' : 'text-red-600'}`}>
                          {e.entry_type === 'income' ? '+' : '-'}${e.amount.toLocaleString()}
                        </td>
                        <td className="py-2.5 pr-3 text-brand-navy/60 text-xs hidden sm:table-cell">{e.category || '—'}</td>
                        <td className="py-2.5 text-brand-navy/70 text-xs">{e.description || '—'}</td>
                        <td className="py-2.5">
                          <button onClick={() => handleDeleteEntry(e.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
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

      {/* ── Settings ── */}
      {tab === 'settings' && (
        <div className="card p-6 max-w-sm">
          <h4 className="font-semibold text-brand-navy mb-4">Cash Alert Threshold</h4>
          <p className="text-sm text-brand-navy/60 mb-4">
            Trigger an alert when the 13-week projected cumulative cash balance drops below this amount.
          </p>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Threshold ($)</label>
              <input type="number" min="0" step="100" value={threshold} onChange={(e) => setThreshold(e.target.value)} className="input text-sm w-full" />
            </div>
            <button onClick={handleSaveThreshold} disabled={savingThreshold} className="btn-primary text-sm !py-2.5 disabled:opacity-50">
              {savingThreshold ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
