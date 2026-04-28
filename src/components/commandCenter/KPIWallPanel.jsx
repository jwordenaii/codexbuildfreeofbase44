/**
 * KPIWallPanel — Continuous Improvement KPI Wall for the Command Center.
 * Pulls from /api/v1/kpi-wall
 */
import { useState, useEffect, useCallback } from 'react'
import { api } from '../../api/client'

const STATUS_COLORS = {
  green: { bg: 'bg-green-50  border-green-200', text: 'text-green-700', dot: 'bg-green-500' },
  yellow: { bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700', dot: 'bg-yellow-400' },
  red: { bg: 'bg-red-50    border-red-200', text: 'text-red-700', dot: 'bg-red-500' },
  gray: { bg: 'bg-gray-50   border-gray-200', text: 'text-gray-500', dot: 'bg-gray-300' },
}

function KPITile({ kpi }) {
  const style = STATUS_COLORS[kpi.status] || STATUS_COLORS.gray
  const displayValue =
    kpi.value != null
      ? kpi.unit === '$'
        ? kpi.value.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
          })
        : `${kpi.value}${kpi.unit || ''}`
      : 'No data'
  const targetDisplay =
    kpi.unit === '$'
      ? kpi.target.toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
        })
      : `${kpi.target}${kpi.unit || ''}`

  return (
    <div className={`card p-5 border ${style.bg} space-y-2`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-brand-navy/60 uppercase tracking-wide">
          {kpi.label}
        </span>
        <span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
      </div>
      <div className={`font-display font-black text-2xl ${style.text}`}>{displayValue}</div>
      <div className="text-xs text-brand-navy/40">Target: {targetDisplay}</div>
      {kpi.total_bids != null && (
        <div className="text-xs text-brand-navy/40">
          {kpi.total_won}/{kpi.total_bids} bids won
        </div>
      )}
      {kpi.total_projects != null && (
        <div className="text-xs text-brand-navy/40">
          {kpi.on_time_projects ?? kpi.total_projects} / {kpi.total_projects} projects
        </div>
      )}
      {kpi.recordable_incidents != null && (
        <div className="text-xs text-brand-navy/40">
          {kpi.recordable_incidents} recordable incident{kpi.recordable_incidents !== 1 ? 's' : ''}
        </div>
      )}
      {kpi.total_members != null && (
        <div className="text-xs text-brand-navy/40">{kpi.total_members} tracked members</div>
      )}
    </div>
  )
}

function MonthBar({ month, count, max }) {
  const pct = max > 0 ? (count / max) * 100 : 0
  return (
    <div className="flex items-end gap-1 flex-col text-center" style={{ width: '7%' }}>
      <div
        className="w-full bg-brand-amber rounded-t"
        style={{ height: `${Math.max(pct, 3)}px`, minHeight: 3 }}
      />
      <div className="text-[10px] text-brand-navy/40 truncate w-full">{month.slice(5)}</div>
      <div className="text-[10px] font-bold text-brand-navy">{count}</div>
    </div>
  )
}

export default function KPIWallPanel() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const d = await api.getKPIWall()
      setData(d)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading)
    return (
      <div className="flex items-center justify-center h-32 text-brand-navy/40 text-sm gap-3">
        <span className="w-5 h-5 border-2 border-brand-amber border-t-transparent rounded-full animate-spin" />{' '}
        Loading KPI Wall…
      </div>
    )

  if (error)
    return (
      <div className="card p-6 bg-red-50 border-red-200 text-red-700 text-sm">
        {error}{' '}
        <button type="button" onClick={load} className="ml-3 underline text-xs">
          Retry
        </button>
      </div>
    )

  const kpis = data?.kpis || {}
  const trend = data?.monthly_lead_trend || []
  const maxLeads = Math.max(...trend.map((t) => t.count), 1)

  const KPI_ORDER = [
    'bid_win_rate',
    'on_time_delivery',
    'safety_trir',
    'projected_cash',
    'cert_current_pct',
    'client_nps',
  ]

  const statusCounts = Object.values(kpis).reduce((acc, k) => {
    acc[k.status] = (acc[k.status] || 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {/* Overall status bar */}
      <div className="card p-4 flex items-center gap-6 flex-wrap">
        <div className="font-display font-bold text-brand-navy">Business Health Score</div>
        {[
          ['green', 'On Target'],
          ['yellow', 'Watch'],
          ['red', 'Off Track'],
          ['gray', 'No Data'],
        ].map(
          ([s, label]) =>
            statusCounts[s] > 0 && (
              <div key={s} className="flex items-center gap-1.5 text-xs">
                <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[s].dot}`} />
                <span className="font-semibold text-brand-navy">{statusCounts[s]}</span>
                <span className="text-brand-navy/50">{label}</span>
              </div>
            )
        )}
        <div className="ml-auto text-xs text-brand-navy/30">
          Updated {data?.generated_at ? new Date(data.generated_at).toLocaleTimeString() : '—'}
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {KPI_ORDER.map((key) => kpis[key] && <KPITile key={key} kpi={kpis[key]} />)}
      </div>

      {/* Lead trend sparkline */}
      {trend.length > 0 && (
        <div className="card p-6">
          <h3 className="font-display font-bold text-brand-navy mb-4">
            Lead Volume — Rolling 12 Months
          </h3>
          <div className="flex items-end gap-1 h-20">
            {trend.slice(-12).map((t) => (
              <MonthBar key={t.month} month={t.month} count={t.count} max={maxLeads} />
            ))}
          </div>
        </div>
      )}

      <div className="text-right">
        <button
          type="button"
          onClick={load}
          className="text-xs text-brand-navy/40 hover:text-brand-navy underline"
        >
          Refresh KPIs
        </button>
      </div>
    </div>
  )
}
