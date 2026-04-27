/**
 * MaterialsPanel — Asphalt material price index panel for the Command Center.
 * Pulls from /api/v1/materials/price-index (Feature 7).
 */
import { useState, useEffect, useCallback } from 'react'
import { api } from '../../api/client'

const SIGNAL_STYLE = {
  buy:    { bg: 'bg-green-50 border-green-200', text: 'text-green-700', badge: 'bg-green-100 text-green-800', icon: '📉' },
  hold:   { bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-800', icon: '⏸' },
  watch:  { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-800', icon: '👀' },
  avoid:  { bg: 'bg-red-50 border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-800', icon: '📈' },
}

export default function MaterialsPanel() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.getMaterialPrices()
      setData(res)
      setLastUpdated(new Date().toLocaleTimeString())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-brand-navy/40 text-sm gap-3">
        <span className="w-6 h-6 border-2 border-brand-amber border-t-transparent rounded-full animate-spin" />
        Fetching prices…
      </div>
    )
  }

  if (error) {
    return (
      <div className="card p-6 bg-red-50 border-red-200 text-red-700 text-sm">
        <strong>Price data unavailable:</strong> {error}
        <button type="button" onClick={load} className="ml-4 underline text-xs">Retry</button>
      </div>
    )
  }

  const signal = data?.pricing_signal?.toLowerCase() || 'hold'
  const style = SIGNAL_STYLE[signal] || SIGNAL_STYLE.hold

  return (
    <div className="space-y-6">
      {/* Signal card */}
      <div className={`card p-6 border-2 ${style.bg}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-brand-navy/50 mb-1">
              Asphalt / Road Oil Price Index
            </div>
            <div className={`font-display font-black text-4xl ${style.text}`}>
              {data?.current_price_per_ton != null
                ? `$${Number(data.current_price_per_ton).toFixed(2)}/ton`
                : '—'}
            </div>
            <div className="text-brand-navy/50 text-xs mt-1">
              Baseline: ${data?.baseline_price_per_ton ?? '—'}/ton
              {data?.multiplier != null && (
                <span className={`ml-2 font-semibold ${style.text}`}>
                  {data.multiplier > 1 ? '+' : ''}{((data.multiplier - 1) * 100).toFixed(1)}% vs baseline
                </span>
              )}
            </div>
          </div>
          <span className={`text-sm font-bold px-3 py-1.5 rounded-full border ${style.badge}`}>
            {style.icon} {signal.toUpperCase()}
          </span>
        </div>
        {data?.recommendation && (
          <div className={`mt-4 text-sm ${style.text} border-t border-current/10 pt-3`}>
            {data.recommendation}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
        <div className="card p-4">
          <div className="text-brand-navy/50 text-xs mb-1">Data Source</div>
          <div className="font-semibold text-brand-navy">{data?.source || 'EIA Weekly Petroleum'}</div>
        </div>
        <div className="card p-4">
          <div className="text-brand-navy/50 text-xs mb-1">Last EIA Report</div>
          <div className="font-semibold text-brand-navy">{data?.report_date || '—'}</div>
        </div>
        <div className="card p-4">
          <div className="text-brand-navy/50 text-xs mb-1">Price Category</div>
          <div className="font-semibold text-brand-navy capitalize">{data?.price_category || '—'}</div>
        </div>
      </div>

      {/* Pricing impact note */}
      <div className="card p-4 bg-blue-50 border-blue-100 text-blue-800 text-xs">
        <strong>How this affects your bids:</strong> Asphalt price volatility directly impacts material cost.
        When the multiplier is above 1.15×, consider adding a material escalation clause to contracts
        longer than 30 days.
      </div>

      <div className="text-right text-xs text-brand-navy/30">
        {lastUpdated && `Fetched at ${lastUpdated}`}{' '}
        <button type="button" onClick={load} className="underline hover:text-brand-navy ml-1">Refresh</button>
      </div>
    </div>
  )
}
