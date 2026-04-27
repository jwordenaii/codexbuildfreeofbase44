/**
 * HumanReviewPanel — AI decision review queue.
 *
 * Lists pending items, shows context + AI decision, and lets the operator
 * approve or reject with an optional correction note.
 */
import { useState, useEffect, useCallback } from 'react'
import { api } from '../../api/client'

function StatusBadge({ status }) {
  const map = {
    pending:  'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}

function ReviewItem({ item, onApprove, onReject }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const act = async (fn) => {
    setBusy(true)
    try { await fn(item.id, note) } finally { setBusy(false) }
  }

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="font-bold text-brand-navy text-sm">#{item.id} · {item.decision_type}</span>
          <StatusBadge status={item.status} />
        </div>
        <span className="text-xs text-brand-navy/40 flex-shrink-0">{item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}</span>
      </div>

      <div className="bg-gray-50 rounded-lg p-3 text-xs text-brand-navy/70 space-y-1">
        <div><span className="font-semibold text-brand-navy">Context:</span> {item.context_summary || '—'}</div>
        <div><span className="font-semibold text-brand-navy">AI Decision:</span> {item.ai_decision || '—'}</div>
        {item.confidence_score != null && (
          <div><span className="font-semibold text-brand-navy">Confidence:</span> {(item.confidence_score * 100).toFixed(0)}%</div>
        )}
      </div>

      {item.status === 'pending' && (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Optional correction note…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-amber/50"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => act(onApprove)}
              className="px-4 py-1.5 bg-green-500 text-white rounded-lg text-xs font-semibold hover:bg-green-600 disabled:opacity-50"
            >
              ✓ Approve
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => act(onReject)}
              className="px-4 py-1.5 bg-red-500 text-white rounded-lg text-xs font-semibold hover:bg-red-600 disabled:opacity-50"
            >
              ✗ Reject
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function HumanReviewPanel() {
  const [items, setItems]     = useState([])
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [filter, setFilter]   = useState('pending')

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.listReviewQueue({ status: filter }),
      api.getReviewStats(),
    ])
      .then(([q, s]) => { setItems(q.items || []); setStats(s) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [filter])

  useEffect(() => { load() }, [load])

  const handleApprove = async (id, correction) => {
    await api.approveReviewItem(id, correction)
    load()
  }
  const handleReject = async (id, correction) => {
    await api.rejectReviewItem(id, correction)
    load()
  }

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Pending',  value: stats.pending,  color: 'text-yellow-600' },
            { label: 'Approved', value: stats.approved, color: 'text-green-600' },
            { label: 'Rejected', value: stats.rejected, color: 'text-red-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card p-4 text-center">
              <div className={`font-display font-black text-3xl ${color}`}>{value ?? '—'}</div>
              <div className="text-xs text-brand-navy/50 mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="font-display font-bold text-brand-navy text-xl">🧠 Human Review Queue</h2>
          <div className="flex gap-2">
            {['pending', 'approved', 'rejected'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                  filter === s
                    ? 'bg-brand-navy text-white border-brand-navy'
                    : 'border-gray-200 text-brand-navy/60 hover:border-brand-navy/40'
                }`}
              >
                {s}
              </button>
            ))}
            <button type="button" onClick={load} className="text-xs text-brand-amber underline ml-1">
              Refresh
            </button>
          </div>
        </div>

        {loading && <div className="text-brand-navy/40 text-sm">Loading…</div>}
        {error   && <div className="text-red-500 text-sm">{error}</div>}

        {!loading && !error && items.length === 0 && (
          <div className="text-brand-navy/40 text-sm text-center py-8">
            No {filter} items in the review queue.
          </div>
        )}

        <div className="space-y-4">
          {items.map((item) => (
            <ReviewItem
              key={item.id}
              item={item}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
