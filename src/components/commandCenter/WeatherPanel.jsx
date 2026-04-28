/**
 * WeatherPanel — Paving weather forecast panel for the Command Center.
 * Pulls from /api/v1/weather/* (Feature 8).
 */
import { useState } from 'react'
import { api } from '../../api/client'

const SUIT_STYLE = {
  good: {
    bg: 'bg-green-50 border-green-200',
    label: 'text-green-700',
    badge: 'bg-green-100 text-green-800',
    icon: '✅',
  },
  marginal: {
    bg: 'bg-yellow-50 border-yellow-200',
    label: 'text-yellow-700',
    badge: 'bg-yellow-100 text-yellow-800',
    icon: '⚠️',
  },
  poor: {
    bg: 'bg-red-50 border-red-200',
    label: 'text-red-700',
    badge: 'bg-red-100 text-red-800',
    icon: '❌',
  },
}

function DayCard({ day }) {
  const suit = SUIT_STYLE[day.suitability] || SUIT_STYLE.marginal
  return (
    <div className={`rounded-xl border p-4 ${suit.bg}`}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="font-semibold text-brand-navy text-sm">{day.date}</div>
          <div className="text-brand-navy/50 text-xs capitalize">{day.description}</div>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${suit.badge}`}>
          {suit.icon} {day.suitability}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs mt-2">
        <div className="text-center">
          <div className="text-brand-navy/50">Temp</div>
          <div className={`font-semibold ${suit.label}`}>{day.temp_high_f}°F</div>
        </div>
        <div className="text-center">
          <div className="text-brand-navy/50">Rain</div>
          <div className={`font-semibold ${suit.label}`}>{day.precip_prob_pct}%</div>
        </div>
        <div className="text-center">
          <div className="text-brand-navy/50">Wind</div>
          <div className={`font-semibold ${suit.label}`}>{day.wind_mph} mph</div>
        </div>
      </div>
      {day.reason && <div className={`mt-2 text-xs ${suit.label}`}>{day.reason}</div>}
    </div>
  )
}

export default function WeatherPanel() {
  const [address, setAddress] = useState('')
  const [forecast, setForecast] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleFetch = async (e) => {
    e.preventDefault()
    if (!address.trim()) return
    setLoading(true)
    setError(null)
    setForecast(null)
    try {
      const res = await api.getPavingForecast(address.trim())
      setForecast(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const goodDays = forecast?.forecast?.filter((d) => d.suitability === 'good').length ?? 0

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h3 className="font-display font-bold text-brand-navy text-lg mb-1">
          🌤 Paving Weather Forecast
        </h3>
        <p className="text-brand-navy/50 text-sm mb-4">
          Enter a job-site address or city to get a 7-day paving suitability forecast.
        </p>
        <form onSubmit={handleFetch} className="flex gap-3">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. Richmond, VA or 23836"
            className="input flex-1 text-sm"
          />
          <button
            type="submit"
            disabled={loading || !address.trim()}
            className="btn-primary text-sm !py-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Fetching…' : 'Get Forecast'}
          </button>
        </form>
      </div>

      {error && (
        <div className="card p-4 bg-red-50 border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {forecast && (
        <>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="text-sm text-brand-navy/60">
              📍 <strong className="text-brand-navy">{forecast.location || address}</strong>
            </div>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full ${
                goodDays >= 4
                  ? 'bg-green-100 text-green-800'
                  : goodDays >= 2
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
              }`}
            >
              {goodDays} good paving day{goodDays !== 1 ? 's' : ''} this week
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {(forecast.forecast || []).map((day, i) => (
              <DayCard key={i} day={day} />
            ))}
          </div>

          {forecast.summary && (
            <div className="card p-4 bg-blue-50 border-blue-200 text-blue-800 text-sm">
              <strong>Summary:</strong> {forecast.summary}
            </div>
          )}
        </>
      )}
    </div>
  )
}
