/**
 * WorkforcePanel — Crew & Skills Matrix for the Command Center.
 * Pulls from /api/v1/workforce/*
 */
import { useState, useEffect, useCallback } from 'react'
import { api } from '../../api/client'

const BLANK = {
  name: '',
  member_type: 'employee',
  trade: '',
  available: '1',
  phone: '',
  email: '',
  notes: '',
}

function CertBadge({ cert, now }) {
  const expiryStr = cert.expiry_date
  if (!expiryStr) return <span className="text-xs text-brand-navy/40">{cert.cert}</span>
  const expiry = new Date(expiryStr)
  const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24))
  const expired = daysLeft < 0
  const soon = !expired && daysLeft <= 30
  const warning = !expired && !soon && daysLeft <= 90
  return (
    <span
      className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mr-1 mb-1 ${
        expired
          ? 'bg-red-100 text-red-700'
          : soon
            ? 'bg-orange-100 text-orange-700'
            : warning
              ? 'bg-yellow-100 text-yellow-700'
              : 'bg-green-100 text-green-700'
      }`}
    >
      {cert.cert}
      {expired ? ` (exp ${Math.abs(daysLeft)}d ago)` : ` (${daysLeft}d)`}
    </span>
  )
}

export default function WorkforcePanel() {
  const [members, setMembers] = useState([])
  const [expiring, setExpiring] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('roster')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [certsInput, setCertsInput] = useState('') // JSON textarea
  const [saving, setSaving] = useState(false)
  const [queryScope, setQueryScope] = useState('')
  const [queryResult, setQueryResult] = useState(null)
  const [querying, setQuerying] = useState(false)
  const now = new Date()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [w, e] = await Promise.all([api.listWorkforce(), api.getExpiringWorkforceCerts()])
      setMembers(w.members || [])
      setExpiring(e.alerts || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleSave = async (evt) => {
    evt.preventDefault()
    setSaving(true)
    try {
      let certs = []
      if (certsInput.trim()) {
        try {
          certs = JSON.parse(certsInput)
        } catch {
          certs = []
        }
      }
      await api.addWorkforceMember({
        ...form,
        available: Number(form.available),
        certifications: certs,
        skill_ratings: {},
      })
      setForm(BLANK)
      setCertsInput('')
      setShowAdd(false)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleQuery = async () => {
    setQuerying(true)
    setQueryResult(null)
    try {
      const d = await api.queryAvailableWorkforce(queryScope)
      setQueryResult(d)
    } catch (err) {
      setError(err.message)
    } finally {
      setQuerying(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this member?')) return
    await api.deleteWorkforceMember(id)
    load()
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const TABS = [
    { id: 'roster', label: `👷 Roster (${members.length})` },
    { id: 'expiring', label: `⚠️ Expiring Certs (${expiring.length})` },
    { id: 'query', label: '🔍 Find Qualified' },
  ]

  if (loading)
    return (
      <div className="flex items-center justify-center h-32 text-brand-navy/40 text-sm gap-3">
        <span className="w-5 h-5 border-2 border-brand-amber border-t-transparent rounded-full animate-spin" />{' '}
        Loading…
      </div>
    )

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-2 flex-wrap items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                tab === t.id
                  ? 'bg-brand-navy text-white border-brand-navy'
                  : t.id === 'expiring' && expiring.length > 0
                    ? 'border-orange-300 text-orange-600 bg-orange-50'
                    : 'border-gray-200 text-brand-navy/60 hover:border-brand-navy/40'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'roster' && (
          <button
            type="button"
            onClick={() => setShowAdd(!showAdd)}
            className="btn-primary text-xs !py-1.5"
          >
            + Add Member
          </button>
        )}
      </div>

      {error && (
        <div className="card p-4 bg-red-50 border-red-200 text-red-700 text-sm">
          {error}{' '}
          <button type="button" onClick={load} className="ml-2 underline text-xs">
            Retry
          </button>
        </div>
      )}

      {/* ── Add form ── */}
      {tab === 'roster' && showAdd && (
        <div className="card p-6">
          <h4 className="font-semibold text-brand-navy mb-4">Add Workforce Member</h4>
          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                required
                className="input text-sm w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Type</label>
              <select
                value={form.member_type}
                onChange={(e) => set('member_type', e.target.value)}
                className="input text-sm w-full"
              >
                <option value="employee">Employee</option>
                <option value="sub">Subcontractor</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Trade</label>
              <input
                type="text"
                value={form.trade}
                onChange={(e) => set('trade', e.target.value)}
                placeholder="paving, milling, operator…"
                className="input text-sm w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">
                Available?
              </label>
              <select
                value={form.available}
                onChange={(e) => set('available', e.target.value)}
                className="input text-sm w-full"
              >
                <option value="1">Yes</option>
                <option value="0">No</option>
              </select>
            </div>
            {[
              ['phone', 'Phone', 'tel'],
              ['email', 'Email', 'email'],
            ].map(([k, l, t]) => (
              <div key={k}>
                <label className="block text-xs font-semibold text-brand-navy/60 mb-1">{l}</label>
                <input
                  type={t}
                  value={form[k]}
                  onChange={(e) => set(k, e.target.value)}
                  className="input text-sm w-full"
                />
              </div>
            ))}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">
                Certifications (JSON array, e.g. [&#123;&quot;cert&quot;:&quot;OSHA
                30&quot;,&quot;expiry_date&quot;:&quot;2026-01-01&quot;&#125;])
              </label>
              <textarea
                value={certsInput}
                onChange={(e) => setCertsInput(e.target.value)}
                rows={2}
                placeholder='[{"cert":"CDL","expiry_date":"2027-06-01"},{"cert":"OSHA 30","expiry_date":"2025-12-01"}]'
                className="input text-sm w-full font-mono text-xs"
              />
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary text-sm !py-2 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Member'}
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

      {/* ── Roster ── */}
      {tab === 'roster' && (
        <div className="card p-6">
          {members.length === 0 ? (
            <p className="text-center text-brand-navy/30 py-8 text-sm">No workforce members yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-navy/10 text-xs text-brand-navy/50 font-semibold text-left">
                    <th className="pb-2 pr-3">Name</th>
                    <th className="pb-2 pr-3">Trade</th>
                    <th className="pb-2 pr-3 hidden sm:table-cell">Type</th>
                    <th className="pb-2 pr-3">Certifications</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id} className="border-b border-brand-navy/5">
                      <td className="py-2.5 pr-3">
                        <div className="font-semibold text-brand-navy">{m.name}</div>
                        {m.email && <div className="text-brand-navy/40 text-xs">{m.email}</div>}
                      </td>
                      <td className="py-2.5 pr-3 text-brand-navy/70 text-xs">{m.trade || '—'}</td>
                      <td className="py-2.5 pr-3 hidden sm:table-cell">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-semibold ${m.member_type === 'employee' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}
                        >
                          {m.member_type}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="flex flex-wrap">
                          {(m.certifications || []).map((c, i) => (
                            <CertBadge key={i} cert={c} now={now} />
                          ))}
                          {(!m.certifications || m.certifications.length === 0) && (
                            <span className="text-brand-navy/30 text-xs">—</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`text-xs font-bold ${m.available ? 'text-green-600' : 'text-red-500'}`}
                        >
                          {m.available ? '✓ Available' : '✗ Busy'}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <button
                          onClick={() => handleDelete(m.id)}
                          className="text-red-400 hover:text-red-600 text-xs"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Expiring Certs ── */}
      {tab === 'expiring' && (
        <div className="card p-6">
          {expiring.length === 0 ? (
            <p className="text-center text-brand-navy/30 py-8 text-sm">
              No certifications expiring in the next 90 days. ✅
            </p>
          ) : (
            <div className="space-y-3">
              {expiring.map((a, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between p-3 rounded-xl text-sm ${a.status === 'expired' ? 'bg-red-50 border border-red-200' : a.status === 'soon' ? 'bg-orange-50 border border-orange-200' : 'bg-yellow-50 border border-yellow-200'}`}
                >
                  <div>
                    <span className="font-semibold text-brand-navy">{a.member_name}</span>
                    <span className="mx-2 text-brand-navy/40">·</span>
                    <span className="font-semibold">{a.cert}</span>
                    {a.trade && (
                      <span className="text-brand-navy/50 ml-2 text-xs">({a.trade})</span>
                    )}
                  </div>
                  <div
                    className={`text-xs font-bold ${a.status === 'expired' ? 'text-red-700' : a.status === 'soon' ? 'text-orange-700' : 'text-yellow-700'}`}
                  >
                    {a.days_left < 0
                      ? `Expired ${Math.abs(a.days_left)}d ago`
                      : `${a.days_left}d left`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Find Qualified ── */}
      {tab === 'query' && (
        <div className="space-y-4">
          <div className="card p-6">
            <h4 className="font-semibold text-brand-navy mb-3">
              Who&apos;s Available + Qualified?
            </h4>
            <div className="flex gap-3">
              <input
                type="text"
                value={queryScope}
                onChange={(e) => setQueryScope(e.target.value)}
                placeholder="e.g. milling, paving, CDL…"
                className="input text-sm flex-1"
              />
              <button
                onClick={handleQuery}
                disabled={querying}
                className="btn-primary text-sm !py-2 disabled:opacity-50"
              >
                {querying ? '…' : 'Find'}
              </button>
            </div>
          </div>
          {queryResult && (
            <div className="card p-6">
              <div className="font-bold text-brand-navy mb-3">
                {queryResult.count} member{queryResult.count !== 1 ? 's' : ''} available
                {queryResult.scope ? ` for "${queryResult.scope}"` : ''}
              </div>
              {queryResult.members.length === 0 ? (
                <p className="text-brand-navy/40 text-sm">
                  No available members matching this scope.
                </p>
              ) : (
                <div className="space-y-2">
                  {queryResult.members.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2"
                    >
                      <span className="font-semibold text-brand-navy">{m.name}</span>
                      <span className="text-brand-navy/50 text-xs">{m.trade || 'general'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
