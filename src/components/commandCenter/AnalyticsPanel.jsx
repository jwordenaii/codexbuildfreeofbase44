/**
 * AnalyticsPanel — BI dashboard panel for the Command Center.
 * Pulls from /api/v1/analytics/* (Feature 10).
 */
import { useState, useEffect, useCallback } from 'react'
import { api } from '../../api/client'

function StatCard({ label, value, sub, accent = 'text-brand-amber' }) {
  return (
    <div className="card p-5 text-center">
      <div className={`font-display font-black text-3xl ${accent}`}>{value}</div>
      <div className="text-brand-navy font-semibold text-sm mt-1">{label}</div>
      {sub && <div className="text-brand-navy/40 text-xs mt-0.5">{sub}</div>}
    </div>
  )
}

const STAGE_COLORS = {
  new: 'bg-gray-200',
  contacted: 'bg-blue-300',
  proposal_sent: 'bg-yellow-400',
  negotiating: 'bg-orange-400',
  won: 'bg-green-500',
  lost: 'bg-red-400',
}

function FunnelBar({ stage, count, total }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  const color = STAGE_COLORS[stage] || 'bg-brand-amber'
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="w-28 text-brand-navy/70 capitalize text-right shrink-0">
        {stage.replace('_', ' ')}
      </div>
      <div className="flex-1 h-5 bg-brand-navy/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="w-12 text-right font-semibold text-brand-navy">{count}</div>
      <div className="w-10 text-right text-brand-navy/40 text-xs">{pct}%</div>
    </div>
  )
}

export default function AnalyticsPanel() {
  const [data, setData] = useState(null)
  const [funnel, setFunnel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [dash, fun] = await Promise.all([api.getAnalyticsDashboard(), api.getCRMFunnel()])
      setData(dash)
      setFunnel(fun)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-brand-navy/40 text-sm gap-3">
        <span className="w-6 h-6 border-2 border-brand-amber border-t-transparent rounded-full animate-spin" />
        Loading analytics…
      </div>
    )
  }

  if (error) {
    return (
      <div className="card p-6 bg-red-50 border-red-200 text-red-700 text-sm">
        <strong>Analytics unavailable:</strong> {error}
        <button type="button" onClick={load} className="ml-4 underline text-xs">
          Retry
        </button>
      </div>
    )
  }

  const summary = data?.summary || {}
  const monthly = data?.monthly_volume || []
  const topServices = data?.by_service || []
  const funnelData = funnel?.funnel || []
  const funnelTotal = funnel?.total || 0

  return (
    <div className="space-y-6">
      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Leads" value={summary.total_leads ?? '—'} />
        <StatCard label="Hot Leads" value={summary.hot_leads ?? '—'} accent="text-red-500" />
        <StatCard
          label="Win Rate"
          value={funnel?.win_rate_pct != null ? `${funnel.win_rate_pct}%` : '—'}
          accent="text-green-600"
        />
        <StatCard
          label="Revenue Forecast"
          value={
            summary.revenue_forecast_low != null
              ? `$${Number(summary.revenue_forecast_low).toLocaleString()}`
              : '—'
          }
          sub="conservative estimate"
          accent="text-blue-600"
        />
      </div>

      {/* Pipeline funnel */}
      <div className="card p-6">
        <h3 className="font-display font-bold text-brand-navy text-lg mb-4">
          Lead Pipeline Funnel
        </h3>
        <div className="space-y-2">
          {funnelData.map((row) => (
            <FunnelBar key={row.stage} stage={row.stage} count={row.count} total={funnelTotal} />
          ))}
        </div>
      </div>

      {/* Monthly volume (last 6 months) */}
      {monthly.length > 0 && (
        <div className="card p-6">
          <h3 className="font-display font-bold text-brand-navy text-lg mb-4">
            Monthly Lead Volume
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-navy/10">
                  <th className="text-left py-2 text-brand-navy/50 font-semibold">Month</th>
                  <th className="text-right py-2 text-brand-navy/50 font-semibold">Leads</th>
                  <th className="text-right py-2 text-brand-navy/50 font-semibold">Hot</th>
                </tr>
              </thead>
              <tbody>
                {monthly.slice(-6).map((row) => (
                  <tr key={row.month} className="border-b border-brand-navy/5">
                    <td className="py-2 text-brand-navy">{row.month}</td>
                    <td className="py-2 text-right font-semibold text-brand-navy">{row.count}</td>
                    <td className="py-2 text-right text-red-500">{row.hot ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top services */}
      {topServices.length > 0 && (
        <div className="card p-6">
          <h3 className="font-display font-bold text-brand-navy text-lg mb-4">Leads by Service</h3>
          <div className="space-y-2">
            {topServices.map((row) => (
              <div key={row.service} className="flex justify-between text-sm">
                <span className="text-brand-navy/70">{row.service}</span>
                <span className="font-semibold text-brand-navy">{row.count}</span>
              </div>
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
          Refresh analytics
        </button>
      </div>
    </div>
  )
}
