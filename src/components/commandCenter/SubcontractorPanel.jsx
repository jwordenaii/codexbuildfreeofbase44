/**
 * SubcontractorPanel — Subcontractor compliance monitor panel for the Command Center.
 * Pulls from /api/v1/subcontractors/* (Feature 14).
 */
import { useState, useEffect, useCallback } from 'react'
import { api } from '../../api/client'

const STATES = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
]

function ExpiryBadge({ date }) {
  if (!date) return <span className="text-brand-navy/30 text-xs">—</span>
  const d = new Date(date)
  const daysLeft = Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24))
  const expired = daysLeft < 0
  const urgent = daysLeft <= 30 && !expired
  return (
    <div className="text-xs">
      <div
        className={`font-semibold ${expired ? 'text-red-600' : urgent ? 'text-orange-600' : 'text-brand-navy'}`}
      >
        {d.toLocaleDateString()}
      </div>
      <div
        className={`${expired ? 'text-red-500' : urgent ? 'text-orange-400' : 'text-brand-navy/30'}`}
      >
        {expired ? `${Math.abs(daysLeft)}d expired` : `${daysLeft}d left`}
      </div>
    </div>
  )
}

const BLANK = {
  name: '',
  company: '',
  email: '',
  phone: '',
  state_code: 'VA',
  license_number: '',
  license_expiry: '',
  insurance_expiry: '',
  bond_expiry: '',
  insurance_carrier: '',
}

export default function SubcontractorPanel() {
  const [subs, setSubs] = useState([])
  const [expiring, setExpiring] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('all')

  // Performance history state
  const [selectedSubId, setSelectedSubId] = useState(null)
  const [perfData, setPerfData] = useState(null)
  const [perfLoading, setPerfLoading] = useState(false)
  const [showPerfAdd, setShowPerfAdd] = useState(false)
  const [perfForm, setPerfForm] = useState({
    project_name: '',
    scope: '',
    on_time: '1',
    quality_rating: '4',
    payment_dispute: '0',
    rehire_recommended: '1',
    notes: '',
    project_date: '',
  })
  const [perfSaving, setPerfSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [allRes, expRes] = await Promise.all([
        api.getSubcontractors(),
        api.getExpiringCerts(45),
      ])
      setSubs(allRes.subcontractors || [])
      setExpiring(expRes.expiring || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const loadPerf = useCallback(async (subId) => {
    setPerfLoading(true)
    setPerfData(null)
    try {
      const d = await api.getSubcontractorPerformance(subId)
      setPerfData(d)
    } catch (e) {
      setError(e.message)
    } finally {
      setPerfLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'performance' && selectedSubId) {
      loadPerf(selectedSubId)
    }
  }, [tab, selectedSubId, loadPerf])

  const handleAdd = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.addSubcontractor(form)
      setForm(BLANK)
      setShowAdd(false)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handlePerfSave = async (e) => {
    e.preventDefault()
    setPerfSaving(true)
    try {
      await api.addSubcontractorPerformance(selectedSubId, {
        ...perfForm,
        on_time: Number(perfForm.on_time),
        quality_rating: Number(perfForm.quality_rating),
        payment_dispute: Number(perfForm.payment_dispute),
        rehire_recommended: Number(perfForm.rehire_recommended),
      })
      setPerfForm({
        project_name: '',
        scope: '',
        on_time: '1',
        quality_rating: '4',
        payment_dispute: '0',
        rehire_recommended: '1',
        notes: '',
        project_date: '',
      })
      setShowPerfAdd(false)
      loadPerf(selectedSubId)
    } catch (err) {
      setError(err.message)
    } finally {
      setPerfSaving(false)
    }
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const setP = (k, v) => setPerfForm((f) => ({ ...f, [k]: v }))

  const displayed = tab === 'expiring' ? expiring : subs

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setTab('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              tab === 'all'
                ? 'bg-brand-navy text-white border-brand-navy'
                : 'border-gray-200 text-brand-navy/60'
            }`}
          >
            All ({subs.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('expiring')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              tab === 'expiring'
                ? expiring.length > 0
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-brand-navy text-white border-brand-navy'
                : expiring.length > 0
                  ? 'border-orange-300 text-orange-600 bg-orange-50'
                  : 'border-gray-200 text-brand-navy/60'
            }`}
          >
            ⚠️ Expiring Soon ({expiring.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('performance')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              tab === 'performance'
                ? 'bg-brand-navy text-white border-brand-navy'
                : 'border-gray-200 text-brand-navy/60'
            }`}
          >
            📊 Performance
          </button>
        </div>
        {tab !== 'performance' && (
          <button
            type="button"
            onClick={() => setShowAdd(!showAdd)}
            className="btn-primary text-xs !py-1.5"
          >
            + Add Subcontractor
          </button>
        )}
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="card p-6">
          <h4 className="font-display font-semibold text-brand-navy mb-4">Add Subcontractor</h4>
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              ['name', 'Contact Name', 'text', true],
              ['company', 'Company', 'text', true],
              ['email', 'Email', 'email', false],
              ['phone', 'Phone', 'tel', false],
              ['license_number', 'License #', 'text', false],
              ['insurance_carrier', 'Insurance Carrier', 'text', false],
            ].map(([key, label, type, req]) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-brand-navy/60 mb-1">
                  {label}
                </label>
                <input
                  type={type}
                  value={form[key]}
                  onChange={(e) => set(key, e.target.value)}
                  required={req}
                  className="input text-sm w-full"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">State</label>
              <select
                value={form.state_code}
                onChange={(e) => set('state_code', e.target.value)}
                className="input text-sm w-full"
              >
                {STATES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            {[
              ['license_expiry', 'License Expiry'],
              ['insurance_expiry', 'Insurance Expiry'],
              ['bond_expiry', 'Bond Expiry'],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-brand-navy/60 mb-1">
                  {label}
                </label>
                <input
                  type="date"
                  value={form[key]}
                  onChange={(e) => set(key, e.target.value)}
                  className="input text-sm w-full"
                />
              </div>
            ))}
            <div className="sm:col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary text-sm !py-2 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Subcontractor'}
              </button>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="btn-outline text-sm !py-2"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {error && (
        <div className="card p-4 bg-red-50 border-red-200 text-red-700 text-sm">
          {error}
          <button type="button" onClick={load} className="ml-3 underline text-xs">
            Retry
          </button>
        </div>
      )}

      {tab !== 'performance' && (
        <div className="card p-6">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-brand-navy/40 text-sm gap-3">
              <span className="w-5 h-5 border-2 border-brand-amber border-t-transparent rounded-full animate-spin" />
              Loading…
            </div>
          ) : displayed.length === 0 ? (
            <div className="text-center text-brand-navy/40 py-10 text-sm">
              {tab === 'expiring'
                ? 'No certifications expiring in the next 45 days. ✅'
                : 'No subcontractors added yet.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-navy/10 text-xs text-brand-navy/50 font-semibold text-left">
                    <th className="pb-2 pr-3">Name / Company</th>
                    <th className="pb-2 pr-3 hidden sm:table-cell">State</th>
                    <th className="pb-2 pr-3">Insurance</th>
                    <th className="pb-2 pr-3 hidden md:table-cell">Bond</th>
                    <th className="pb-2">License</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-brand-navy/5 cursor-pointer hover:bg-gray-50"
                      onClick={() => {
                        setSelectedSubId(s.id)
                        setTab('performance')
                      }}
                    >
                      <td className="py-2.5 pr-3">
                        <div className="font-semibold text-brand-navy">{s.name}</div>
                        <div className="text-brand-navy/40 text-xs">{s.company}</div>
                      </td>
                      <td className="py-2.5 pr-3 hidden sm:table-cell text-brand-navy/60">
                        {s.state_code}
                      </td>
                      <td className="py-2.5 pr-3">
                        <ExpiryBadge date={s.insurance_expiry} />
                      </td>
                      <td className="py-2.5 pr-3 hidden md:table-cell">
                        <ExpiryBadge date={s.bond_expiry} />
                      </td>
                      <td className="py-2.5">
                        <ExpiryBadge date={s.license_expiry} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-brand-navy/30 mt-2">
                Click a row to view performance history.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Performance History Tab ── */}
      {tab === 'performance' && (
        <div className="space-y-4">
          {/* Sub selector */}
          <div className="card p-4 flex items-center gap-3 flex-wrap">
            <label className="text-xs font-semibold text-brand-navy/60">Subcontractor:</label>
            <select
              value={selectedSubId || ''}
              onChange={(e) => {
                const { value } = e.target
                setSelectedSubId(value === '' ? null : Number(value))
              }}
              className="input text-sm flex-1 max-w-xs"
            >
              <option value="">— select subcontractor —</option>
              {subs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.company}
                </option>
              ))}
            </select>
            {selectedSubId && (
              <button
                onClick={() => setShowPerfAdd(!showPerfAdd)}
                className="btn-primary text-xs !py-1.5"
              >
                + Add Record
              </button>
            )}
          </div>

          {showPerfAdd && selectedSubId && (
            <div className="card p-6">
              <h4 className="font-semibold text-brand-navy mb-4">Add Performance Record</h4>
              <form onSubmit={handlePerfSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-brand-navy/60 mb-1">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={perfForm.project_name}
                    onChange={(e) => setP('project_name', e.target.value)}
                    required
                    className="input text-sm w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-navy/60 mb-1">
                    Scope
                  </label>
                  <input
                    type="text"
                    value={perfForm.scope}
                    onChange={(e) => setP('scope', e.target.value)}
                    placeholder="milling, paving…"
                    className="input text-sm w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-navy/60 mb-1">
                    On Time?
                  </label>
                  <select
                    value={perfForm.on_time}
                    onChange={(e) => setP('on_time', e.target.value)}
                    className="input text-sm w-full"
                  >
                    <option value="1">Yes</option>
                    <option value="0">No</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-navy/60 mb-1">
                    Quality (1–5)
                  </label>
                  <select
                    value={perfForm.quality_rating}
                    onChange={(e) => setP('quality_rating', e.target.value)}
                    className="input text-sm w-full"
                  >
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {n} {'★'.repeat(n)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-navy/60 mb-1">
                    Payment Dispute?
                  </label>
                  <select
                    value={perfForm.payment_dispute}
                    onChange={(e) => setP('payment_dispute', e.target.value)}
                    className="input text-sm w-full"
                  >
                    <option value="0">No</option>
                    <option value="1">Yes</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-navy/60 mb-1">
                    Re-hire?
                  </label>
                  <select
                    value={perfForm.rehire_recommended}
                    onChange={(e) => setP('rehire_recommended', e.target.value)}
                    className="input text-sm w-full"
                  >
                    <option value="1">Yes</option>
                    <option value="0">No</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-navy/60 mb-1">
                    Project Date
                  </label>
                  <input
                    type="date"
                    value={perfForm.project_date}
                    onChange={(e) => setP('project_date', e.target.value)}
                    className="input text-sm w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-navy/60 mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={perfForm.notes}
                    onChange={(e) => setP('notes', e.target.value)}
                    className="input text-sm w-full"
                  />
                </div>
                <div className="sm:col-span-2 flex gap-3">
                  <button
                    type="submit"
                    disabled={perfSaving}
                    className="btn-primary text-sm !py-2 disabled:opacity-50"
                  >
                    {perfSaving ? 'Saving…' : 'Save Record'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPerfAdd(false)}
                    className="btn-outline text-sm !py-2"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {selectedSubId && (
            <div className="card p-6">
              {perfLoading ? (
                <div className="flex items-center justify-center h-20 text-brand-navy/40 text-sm gap-3">
                  <span className="w-5 h-5 border-2 border-brand-amber border-t-transparent rounded-full animate-spin" />{' '}
                  Loading…
                </div>
              ) : !perfData ? null : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      ['Projects', perfData.total_projects],
                      ['On-Time', perfData.on_time_pct != null ? `${perfData.on_time_pct}%` : '—'],
                      [
                        'Avg Quality',
                        perfData.avg_quality_rating ? `${perfData.avg_quality_rating}/5` : '—',
                      ],
                      ['Disputes', perfData.payment_disputes],
                    ].map(([l, v]) => (
                      <div key={l} className="text-center bg-gray-50 rounded-xl py-3">
                        <div className="font-display font-bold text-xl text-brand-navy">
                          {v ?? '—'}
                        </div>
                        <div className="text-xs text-brand-navy/50 mt-0.5">{l}</div>
                      </div>
                    ))}
                  </div>
                  {perfData.rehire_pct != null && (
                    <div
                      className={`text-sm font-semibold px-4 py-2 rounded-lg ${perfData.rehire_pct >= 80 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                    >
                      {perfData.rehire_pct >= 80 ? '✅' : '⚠️'} Re-hire recommended on{' '}
                      {perfData.rehire_pct}% of projects
                    </div>
                  )}
                  {perfData.history.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-brand-navy/10 text-xs text-brand-navy/50 font-semibold text-left">
                            <th className="pb-2 pr-3">Project</th>
                            <th className="pb-2 pr-3 hidden sm:table-cell">Scope</th>
                            <th className="pb-2 pr-3">On Time</th>
                            <th className="pb-2 pr-3">Quality</th>
                            <th className="pb-2">Re-hire</th>
                          </tr>
                        </thead>
                        <tbody>
                          {perfData.history.map((p) => (
                            <tr key={p.id} className="border-b border-brand-navy/5">
                              <td className="py-2.5 pr-3 font-semibold text-brand-navy">
                                {p.project_name}
                              </td>
                              <td className="py-2.5 pr-3 text-xs text-brand-navy/60 hidden sm:table-cell">
                                {p.scope || '—'}
                              </td>
                              <td className="py-2.5 pr-3">
                                <span
                                  className={`text-xs font-bold ${p.on_time ? 'text-green-600' : 'text-red-600'}`}
                                >
                                  {p.on_time ? '✓' : '✗'}
                                </span>
                              </td>
                              <td className="py-2.5 pr-3 text-xs">
                                {p.quality_rating ? '★'.repeat(p.quality_rating) : '—'}
                              </td>
                              <td className="py-2.5">
                                <span
                                  className={`text-xs font-bold ${p.rehire_recommended ? 'text-green-600' : 'text-red-600'}`}
                                >
                                  {p.rehire_recommended ? '✓ Yes' : '✗ No'}
                                </span>
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
          )}
        </div>
      )}
    </div>
  )
}
