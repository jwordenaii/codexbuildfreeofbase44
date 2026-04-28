/**
 * FollowUpsPanel — Scheduled follow-up task list.
 *
 * GET  /api/v1/followups           — list all tasks
 * POST /api/v1/followups/{id}/cancel — cancel a task
 */
import { useState, useEffect, useCallback } from 'react'
import { api } from '../../api/client'

const PRIORITY_COLORS = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-orange-100 text-orange-700',
  low: 'bg-blue-100 text-blue-700',
}

function PriorityBadge({ priority }) {
  const cls = PRIORITY_COLORS[priority?.toLowerCase()] || 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${cls}`}>
      {priority || 'normal'}
    </span>
  )
}

function StatusDot({ status }) {
  const map = { pending: 'bg-yellow-400', completed: 'bg-green-400', cancelled: 'bg-gray-300' }
  return <span className={`inline-block w-2 h-2 rounded-full ${map[status] || 'bg-gray-300'}`} />
}

export default function FollowUpsPanel() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('pending')
  const [cancelling, setCancelling] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    api
      .listFollowUps({ status: filter })
      .then((d) => setTasks(d.tasks || d || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [filter])

  useEffect(() => {
    load()
  }, [load])

  const handleCancel = async (taskId) => {
    setCancelling(taskId)
    try {
      await api.cancelFollowUp(taskId)
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setCancelling(null)
    }
  }

  const filtered = tasks.filter((t) => (filter === 'all' ? true : t.status === filter))

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="font-display font-bold text-brand-navy text-xl">🔔 Follow-Up Tasks</h2>
          <div className="flex gap-2 flex-wrap">
            {['pending', 'completed', 'cancelled', 'all'].map((s) => (
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
            <button
              type="button"
              onClick={load}
              className="text-xs text-brand-amber underline ml-1"
            >
              Refresh
            </button>
          </div>
        </div>

        {loading && <div className="text-brand-navy/40 text-sm">Loading…</div>}
        {error && <div className="text-red-500 text-sm">{error}</div>}

        {!loading && !error && filtered.length === 0 && (
          <div className="text-brand-navy/40 text-sm text-center py-8">
            No {filter !== 'all' ? filter : ''} follow-up tasks found.
          </div>
        )}

        <div className="space-y-3">
          {filtered.map((task) => (
            <div
              key={task.id}
              className="border border-gray-100 rounded-xl p-4 flex items-start justify-between gap-4"
            >
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusDot status={task.status} />
                  <span className="font-semibold text-brand-navy text-sm">
                    {task.task_type || 'Follow-up'} — Lead #{task.lead_id || '?'}
                  </span>
                  <PriorityBadge priority={task.priority} />
                </div>
                {task.message && (
                  <p className="text-xs text-brand-navy/60 leading-relaxed">{task.message}</p>
                )}
                <div className="flex gap-4 text-xs text-brand-navy/40">
                  {task.scheduled_at && (
                    <span>📅 {new Date(task.scheduled_at).toLocaleString()}</span>
                  )}
                  {task.contact_email && <span>📧 {task.contact_email}</span>}
                </div>
              </div>

              {task.status === 'pending' && (
                <button
                  type="button"
                  onClick={() => handleCancel(task.id)}
                  disabled={cancelling === task.id}
                  className="flex-shrink-0 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  {cancelling === task.id ? 'Cancelling…' : 'Cancel'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
