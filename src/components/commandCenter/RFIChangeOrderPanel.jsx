/**
 * RFIChangeOrderPanel — RFI log and Change Order workflow for GC projects.
 *
 * Features:
 *  - RFI log: number, subject, originator, due date, ball-in-court, status, response
 *  - Overdue RFI detection and highlighting
 *  - Change Order log: CO#, description, cost/schedule impact, linked RFI, status
 *  - Approved vs Pending CO value summary
 *  - Linked RFI selector on change orders
 *  - Status updates via inline dropdowns
 *  - Expand to see RFI response text
 */
import { useState } from 'react'

const RFI_STATUSES = ['Open', 'Pending Response', 'Answered', 'Closed']
const CO_STATUSES  = ['Pending Owner', 'Approved', 'Rejected', 'Void']

const RFI_STATUS_STYLE = {
  'Open':             'bg-blue-100 text-blue-700 border-blue-200',
  'Pending Response': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Answered':         'bg-green-100 text-green-700 border-green-200',
  'Closed':           'bg-gray-100 text-gray-500 border-gray-200',
}

const CO_STATUS_STYLE = {
  'Pending Owner': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Approved':      'bg-green-100 text-green-700 border-green-200',
  'Rejected':      'bg-red-100 text-red-700 border-red-200',
  'Void':          'bg-gray-100 text-gray-400 border-gray-200',
}

function fmt(n) {
  if (!n && n !== 0) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(n))
}

const BLANK_RFI = {
  num: '', subject: '', originator: '', submitted: '',
  dueDate: '', ballInCourt: 'Owner/Architect', status: 'Open', response: '',
}

const BLANK_CO = {
  num: '', description: '', costImpact: '', scheduleDays: '',
  status: 'Pending Owner', linkedRFI: '', submittedDate: '',
}

const DEMO_RFIS = [
  {
    id: 1,
    num: 'RFI-001',
    subject: 'Clarify subbase compaction spec at section B',
    originator: 'J. Worden',
    submitted: '2026-04-10',
    dueDate: '2026-04-17',
    ballInCourt: 'Owner/Architect',
    status: 'Answered',
    response: 'Per spec section 02700-3.1, 95% of modified Proctor maximum dry density is required for all subbase layers.',
  },
  {
    id: 2,
    num: 'RFI-002',
    subject: 'Rock removal unit price — unanticipated rock excavation required at station 4+50',
    originator: 'J. Worden',
    submitted: '2026-04-18',
    dueDate: '2026-04-25',
    ballInCourt: 'Owner',
    status: 'Open',
    response: '',
  },
]

const DEMO_COS = [
  {
    id: 1,
    num: 'CO-001',
    description: 'Extra rock excavation per RFI-002 — 180 CY at $42/CY unit price',
    costImpact: 7560,
    scheduleDays: 3,
    status: 'Pending Owner',
    linkedRFI: 'RFI-002',
    submittedDate: '2026-04-20',
  },
]

let _rfiCounter = DEMO_RFIS.length
let _coCounter  = DEMO_COS.length

export default function RFIChangeOrderPanel() {
  const [tab, setTab]         = useState('rfi')
  const [rfis, setRfis]       = useState(DEMO_RFIS)
  const [cos, setCos]         = useState(DEMO_COS)
  const [showAdd, setShowAdd] = useState(false)
  const [rfiForm, setRfiForm] = useState({ ...BLANK_RFI })
  const [coForm, setCoForm]   = useState({ ...BLANK_CO })
  const [expandId, setExpandId] = useState(null)

  const addRFI = (e) => {
    e.preventDefault()
    _rfiCounter += 1
    setRfis((prev) => [...prev, { ...rfiForm, id: _rfiCounter }])
    setRfiForm({ ...BLANK_RFI })
    setShowAdd(false)
  }

  const addCO = (e) => {
    e.preventDefault()
    _coCounter += 1
    setCos((prev) => [
      ...prev,
      {
        ...coForm,
        id: _coCounter,
        costImpact: Number(coForm.costImpact) || 0,
        scheduleDays: Number(coForm.scheduleDays) || 0,
      },
    ])
    setCoForm({ ...BLANK_CO })
    setShowAdd(false)
  }

  const updateRFIStatus = (id, status) =>
    setRfis((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))

  const updateCOStatus = (id, status) =>
    setCos((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)))

  const totalApproved = cos
    .filter((c) => c.status === 'Approved')
    .reduce((s, c) => s + (Number(c.costImpact) || 0), 0)

  const totalPending = cos
    .filter((c) => c.status === 'Pending Owner')
    .reduce((s, c) => s + (Number(c.costImpact) || 0), 0)

  const openRFIs = rfis.filter((r) => r.status === 'Open' || r.status === 'Pending Response').length

  const setR = (k, v) => setRfiForm((f) => ({ ...f, [k]: v }))
  const setC = (k, v) => setCoForm((f) => ({ ...f, [k]: v }))

  return (
    <div className="space-y-6">
      {/* ── Tab bar ── */}
      <div className="flex gap-2 flex-wrap items-center justify-between">
        <div className="flex gap-2">
          {[
            { id: 'rfi', label: `📋 RFI Log (${rfis.length})` },
            { id: 'co',  label: `💵 Change Orders (${cos.length})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setTab(t.id); setShowAdd(false) }}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                tab === t.id
                  ? 'bg-brand-navy text-white border-brand-navy'
                  : 'border-gray-200 text-brand-navy/60 hover:border-brand-navy/40'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(!showAdd)}
          className="btn-primary text-xs !py-1.5"
        >
          + New {tab === 'rfi' ? 'RFI' : 'Change Order'}
        </button>
      </div>

      {/* ── CO summary banner ── */}
      {tab === 'co' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="card p-4 text-center">
            <div className="text-xs text-brand-navy/50 mb-1">Approved CO Value</div>
            <div className="text-lg font-black text-green-700">{fmt(totalApproved)}</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-xs text-brand-navy/50 mb-1">Pending CO Value</div>
            <div className="text-lg font-black text-yellow-600">{fmt(totalPending)}</div>
          </div>
          <div className="card p-4 text-center sm:col-span-1 col-span-2">
            <div className="text-xs text-brand-navy/50 mb-1">Open RFIs</div>
            <div className={`text-lg font-black ${openRFIs > 0 ? 'text-blue-600' : 'text-green-600'}`}>
              {openRFIs}
            </div>
          </div>
        </div>
      )}

      {/* ── RFI add form ── */}
      {showAdd && tab === 'rfi' && (
        <div className="card p-6">
          <h4 className="font-display font-semibold text-brand-navy mb-4">New RFI</h4>
          <form onSubmit={addRFI} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">RFI #</label>
              <input
                type="text"
                required
                value={rfiForm.num}
                onChange={(e) => setR('num', e.target.value)}
                placeholder="RFI-003"
                className="input text-sm w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Originator</label>
              <input
                type="text"
                value={rfiForm.originator}
                onChange={(e) => setR('originator', e.target.value)}
                className="input text-sm w-full"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Subject</label>
              <input
                type="text"
                required
                value={rfiForm.subject}
                onChange={(e) => setR('subject', e.target.value)}
                className="input text-sm w-full"
                placeholder="Describe the information requested"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Submitted Date</label>
              <input
                type="date"
                value={rfiForm.submitted}
                onChange={(e) => setR('submitted', e.target.value)}
                className="input text-sm w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Due Date</label>
              <input
                type="date"
                value={rfiForm.dueDate}
                onChange={(e) => setR('dueDate', e.target.value)}
                className="input text-sm w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Ball in Court</label>
              <input
                type="text"
                value={rfiForm.ballInCourt}
                onChange={(e) => setR('ballInCourt', e.target.value)}
                className="input text-sm w-full"
                placeholder="Owner / Architect / Engineer"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Status</label>
              <select
                value={rfiForm.status}
                onChange={(e) => setR('status', e.target.value)}
                className="input text-sm w-full"
              >
                {RFI_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Response</label>
              <textarea
                value={rfiForm.response}
                onChange={(e) => setR('response', e.target.value)}
                rows={2}
                className="input text-sm w-full resize-none"
                placeholder="Leave blank until answered"
              />
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" className="btn-primary text-sm !py-2">Submit RFI</button>
              <button type="button" onClick={() => setShowAdd(false)} className="btn-outline text-sm !py-2">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── CO add form ── */}
      {showAdd && tab === 'co' && (
        <div className="card p-6">
          <h4 className="font-display font-semibold text-brand-navy mb-4">New Change Order</h4>
          <form onSubmit={addCO} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">CO #</label>
              <input
                type="text"
                required
                value={coForm.num}
                onChange={(e) => setC('num', e.target.value)}
                placeholder="CO-002"
                className="input text-sm w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Submitted Date</label>
              <input
                type="date"
                value={coForm.submittedDate}
                onChange={(e) => setC('submittedDate', e.target.value)}
                className="input text-sm w-full"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Description</label>
              <textarea
                required
                rows={2}
                value={coForm.description}
                onChange={(e) => setC('description', e.target.value)}
                className="input text-sm w-full resize-none"
                placeholder="Describe the scope change and basis for compensation"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Cost Impact ($)</label>
              <input
                type="number"
                value={coForm.costImpact}
                onChange={(e) => setC('costImpact', e.target.value)}
                className="input text-sm w-full"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Schedule Impact (days)</label>
              <input
                type="number"
                value={coForm.scheduleDays}
                onChange={(e) => setC('scheduleDays', e.target.value)}
                className="input text-sm w-full"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Linked RFI</label>
              <select
                value={coForm.linkedRFI}
                onChange={(e) => setC('linkedRFI', e.target.value)}
                className="input text-sm w-full"
              >
                <option value="">None</option>
                {rfis.map((r) => (
                  <option key={r.id} value={r.num}>
                    {r.num} – {r.subject.substring(0, 45)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Status</label>
              <select
                value={coForm.status}
                onChange={(e) => setC('status', e.target.value)}
                className="input text-sm w-full"
              >
                {CO_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" className="btn-primary text-sm !py-2">Submit Change Order</button>
              <button type="button" onClick={() => setShowAdd(false)} className="btn-outline text-sm !py-2">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── RFI list ── */}
      {tab === 'rfi' && (
        <div className="card p-6">
          {rfis.length === 0 ? (
            <div className="text-center text-brand-navy/40 py-10 text-sm">
              No RFIs logged yet. Click &quot;+ New RFI&quot; to create the first one.
            </div>
          ) : (
            <div className="space-y-2">
              {rfis.map((rfi) => {
                const daysLeft = rfi.dueDate
                  ? Math.ceil((new Date(rfi.dueDate) - new Date()) / 86_400_000)
                  : null
                const isOverdue =
                  daysLeft !== null &&
                  daysLeft < 0 &&
                  rfi.status !== 'Answered' &&
                  rfi.status !== 'Closed'

                return (
                  <div
                    key={rfi.id}
                    className={`rounded-xl border p-4 transition-colors ${
                      isOverdue ? 'border-red-200 bg-red-50' : 'border-brand-navy/10 bg-white'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-mono text-xs text-brand-navy/40 font-semibold">{rfi.num}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${RFI_STATUS_STYLE[rfi.status]}`}>
                            {rfi.status}
                          </span>
                          {isOverdue && (
                            <span className="text-xs text-red-600 font-bold">⚠️ OVERDUE</span>
                          )}
                          {daysLeft !== null && !isOverdue && daysLeft <= 3 && rfi.status === 'Open' && (
                            <span className="text-xs text-orange-600 font-semibold">⏰ Due soon</span>
                          )}
                        </div>
                        <div className="font-semibold text-brand-navy text-sm">{rfi.subject}</div>
                        <div className="text-xs text-brand-navy/40 mt-0.5 flex flex-wrap gap-x-3">
                          {rfi.originator && <span>By: {rfi.originator}</span>}
                          {rfi.submitted  && <span>Submitted: {rfi.submitted}</span>}
                          {rfi.dueDate    && <span>Due: {rfi.dueDate}</span>}
                          {rfi.ballInCourt && <span>Ball in court: {rfi.ballInCourt}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2 items-center shrink-0">
                        <select
                          value={rfi.status}
                          onChange={(e) => updateRFIStatus(rfi.id, e.target.value)}
                          className={`text-xs font-semibold border rounded-full px-2 py-0.5 appearance-none cursor-pointer ${RFI_STATUS_STYLE[rfi.status]}`}
                        >
                          {RFI_STATUSES.map((s) => <option key={s}>{s}</option>)}
                        </select>
                        {rfi.response && (
                          <button
                            type="button"
                            onClick={() => setExpandId(expandId === rfi.id ? null : rfi.id)}
                            className="text-xs text-brand-navy/40 hover:text-brand-navy px-2"
                            aria-label={expandId === rfi.id ? 'Collapse response' : 'View response'}
                          >
                            {expandId === rfi.id ? '▲' : '▼ Response'}
                          </button>
                        )}
                      </div>
                    </div>

                    {expandId === rfi.id && rfi.response && (
                      <div className="mt-3 pt-3 border-t border-brand-navy/10">
                        <div className="text-xs font-semibold text-brand-navy/50 mb-1">Official Response:</div>
                        <div className="text-sm text-brand-navy/80 leading-relaxed">{rfi.response}</div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Change order table ── */}
      {tab === 'co' && (
        <div className="card p-6">
          {cos.length === 0 ? (
            <div className="text-center text-brand-navy/40 py-10 text-sm">
              No change orders logged yet. Click &quot;+ New Change Order&quot; to create the first one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-navy/10 text-xs text-brand-navy/50 font-semibold text-left">
                    <th className="pb-2 pr-3">CO #</th>
                    <th className="pb-2 pr-3">Description</th>
                    <th className="pb-2 pr-3 text-right">Cost Impact</th>
                    <th className="pb-2 pr-3 text-center hidden sm:table-cell">Schedule</th>
                    <th className="pb-2 pr-3 hidden md:table-cell">Linked RFI</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {cos.map((co) => (
                    <tr key={co.id} className="border-b border-brand-navy/5 hover:bg-brand-navy/[0.02]">
                      <td className="py-2.5 pr-3">
                        <span className="font-mono text-xs font-semibold text-brand-navy">{co.num}</span>
                        {co.submittedDate && (
                          <div className="text-brand-navy/30 text-xs">{co.submittedDate}</div>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 max-w-xs">
                        <span className="text-brand-navy text-xs leading-relaxed">{co.description}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <span className={`text-xs font-bold ${
                          co.costImpact > 0 ? 'text-orange-600' :
                          co.costImpact < 0 ? 'text-green-600' : 'text-brand-navy/30'
                        }`}>
                          {co.costImpact > 0 ? '+' : ''}{fmt(co.costImpact)}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-center hidden sm:table-cell">
                        <span className={`text-xs font-bold ${co.scheduleDays > 0 ? 'text-orange-600' : 'text-brand-navy/30'}`}>
                          {co.scheduleDays > 0 ? `+${co.scheduleDays}d` : '—'}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 hidden md:table-cell">
                        <span className="text-xs text-brand-navy/50">{co.linkedRFI || '—'}</span>
                      </td>
                      <td className="py-2.5">
                        <select
                          value={co.status}
                          onChange={(e) => updateCOStatus(co.id, e.target.value)}
                          className={`text-xs font-semibold border rounded-full px-2 py-0.5 appearance-none cursor-pointer ${CO_STATUS_STYLE[co.status]}`}
                        >
                          {CO_STATUSES.map((s) => <option key={s}>{s}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-brand-navy/20">
                    <td colSpan={2} className="pt-3 text-xs font-bold text-brand-navy">TOTALS</td>
                    <td className="pt-3 text-right">
                      <div className="text-xs font-bold text-green-600">
                        Approved: {fmt(totalApproved)}
                      </div>
                      <div className="text-xs font-bold text-yellow-600">
                        Pending: {fmt(totalPending)}
                      </div>
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
