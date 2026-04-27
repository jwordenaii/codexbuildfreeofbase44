/**
 * LienCalendarPanel — Mechanics lien deadline tracker panel for the Command Center.
 * Pulls from /api/v1/liens/* (Feature 12).
 */
import { useState, useEffect, useCallback } from 'react'
import { api } from '../../api/client'

const STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
]

function DeadlinePill({ label, date }) {
  if (!date) return null
  const d = new Date(date)
  const daysLeft = Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24))
  const urgent = daysLeft <= 14
  const overdue = daysLeft < 0
  return (
    <div className={`rounded-lg p-3 border text-xs ${
      overdue ? 'bg-red-50 border-red-200' :
      urgent ? 'bg-orange-50 border-orange-200' :
      'bg-gray-50 border-gray-200'
    }`}>
      <div className={`font-semibold mb-0.5 ${overdue ? 'text-red-700' : urgent ? 'text-orange-700' : 'text-brand-navy'}`}>
        {label}
      </div>
      <div className={`text-sm font-bold ${overdue ? 'text-red-600' : urgent ? 'text-orange-600' : 'text-brand-navy'}`}>
        {d.toLocaleDateString()}
      </div>
      <div className={`mt-0.5 ${overdue ? 'text-red-500' : urgent ? 'text-orange-500' : 'text-brand-navy/40'}`}>
        {overdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d remaining`}
      </div>
    </div>
  )
}

export default function LienCalendarPanel() {
  const [form, setForm] = useState({
    state_code: 'VA',
    project_start_date: '',
    last_furnishing_date: '',
    customer_name: '',
    project_address: '',
  })
  const [calc, setCalc] = useState(null)
  const [upcoming, setUpcoming] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  const loadUpcoming = useCallback(async () => {
    try {
      const res = await api.getUpcomingLiens(60)
      setUpcoming(res.entries || [])
    } catch {
      // silent — upcoming list is secondary
    }
  }, [])

  useEffect(() => { loadUpcoming() }, [loadUpcoming])

  const handleCalc = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setCalc(null)
    setSaved(false)
    try {
      const res = await api.calculateLienDeadlines({
        state_code: form.state_code,
        project_start_date: form.project_start_date,
        last_furnishing_date: form.last_furnishing_date,
      })
      setCalc(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleTrack = async () => {
    if (!form.customer_name || !form.project_address) {
      setError('Enter customer name and project address to save.')
      return
    }
    setSaving(true)
    try {
      await api.trackLienProject({
        customer_name: form.customer_name,
        project_address: form.project_address,
        state_code: form.state_code,
        project_start_date: form.project_start_date,
        last_furnishing_date: form.last_furnishing_date,
      })
      setSaved(true)
      loadUpcoming()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div className="space-y-6">
      {/* Calculator form */}
      <div className="card p-6">
        <h3 className="font-display font-bold text-brand-navy text-lg mb-4">
          📅 Lien Deadline Calculator
        </h3>
        <form onSubmit={handleCalc} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-brand-navy/60 mb-1">State</label>
            <select
              value={form.state_code}
              onChange={(e) => set('state_code', e.target.value)}
              className="input text-sm w-full"
            >
              {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Project Start Date</label>
              <input
                type="date"
                value={form.project_start_date}
                onChange={(e) => set('project_start_date', e.target.value)}
                required
                className="input text-sm w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Last Furnishing Date</label>
              <input
                type="date"
                value={form.last_furnishing_date}
                onChange={(e) => set('last_furnishing_date', e.target.value)}
                required
                className="input text-sm w-full"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Customer Name (to save)</label>
            <input
              type="text"
              value={form.customer_name}
              onChange={(e) => set('customer_name', e.target.value)}
              placeholder="ABC Properties"
              className="input text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Project Address (to save)</label>
            <input
              type="text"
              value={form.project_address}
              onChange={(e) => set('project_address', e.target.value)}
              placeholder="123 Main St, Richmond, VA"
              className="input text-sm w-full"
            />
          </div>
          <div className="sm:col-span-2 flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary text-sm !py-2 disabled:opacity-50"
            >
              {loading ? 'Calculating…' : 'Calculate Deadlines'}
            </button>
            {calc && (
              <button
                type="button"
                onClick={handleTrack}
                disabled={saving}
                className="btn-outline text-sm !py-2 disabled:opacity-50"
              >
                {saving ? 'Saving…' : '+ Save to Calendar'}
              </button>
            )}
          </div>
        </form>

        {error && <div className="mt-3 text-red-600 text-sm">{error}</div>}
        {saved && <div className="mt-3 text-green-600 text-sm font-semibold">✅ Saved to lien calendar.</div>}
      </div>

      {/* Calculated deadlines */}
      {calc && (
        <div className="card p-6">
          <h4 className="font-display font-semibold text-brand-navy mb-3">
            Deadlines for {form.state_code}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <DeadlinePill label="Preliminary Notice" date={calc.preliminary_notice_deadline} />
            <DeadlinePill label="Lien Filing" date={calc.lien_filing_deadline} />
            <DeadlinePill label="Foreclosure" date={calc.foreclosure_deadline} />
          </div>
          {calc.notes && (
            <div className="mt-3 text-xs text-brand-navy/50">{calc.notes}</div>
          )}
        </div>
      )}

      {/* Upcoming deadlines */}
      {upcoming.length > 0 && (
        <div className="card p-6">
          <h4 className="font-display font-semibold text-brand-navy mb-3">
            Upcoming Deadlines (next 60 days)
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-navy/10 text-xs text-brand-navy/50 font-semibold">
                  <th className="pb-2 text-left">Customer</th>
                  <th className="pb-2 text-left hidden sm:table-cell">Address</th>
                  <th className="pb-2 text-center">State</th>
                  <th className="pb-2 text-right">Lien Filing</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((e) => {
                  const d = e.lien_filing_deadline ? new Date(e.lien_filing_deadline) : null
                  const daysLeft = d ? Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24)) : null
                  return (
                    <tr key={e.id} className="border-b border-brand-navy/5">
                      <td className="py-2 font-semibold text-brand-navy">{e.customer_name}</td>
                      <td className="py-2 text-brand-navy/50 hidden sm:table-cell text-xs">{e.project_address}</td>
                      <td className="py-2 text-center">{e.state_code}</td>
                      <td className="py-2 text-right">
                        {d ? (
                          <span className={`text-xs font-bold ${daysLeft <= 7 ? 'text-red-600' : daysLeft <= 14 ? 'text-orange-600' : 'text-brand-navy'}`}>
                            {d.toLocaleDateString()} ({daysLeft}d)
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
