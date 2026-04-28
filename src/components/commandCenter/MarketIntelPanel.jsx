/**
 * MarketIntelPanel — Competitor radar and market signals panel for the Command Center.
 * Pulls from /api/v1/market/* (Feature 13).
 */
import { useState } from 'react'
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

function StarRating({ rating }) {
  const stars = Math.round(rating * 2) / 2
  return (
    <span className="text-brand-amber text-sm">
      {'★'.repeat(Math.floor(stars))}
      {stars % 1 !== 0 ? '½' : ''}
      <span className="text-brand-navy/30 text-xs ml-1">({rating.toFixed(1)})</span>
    </span>
  )
}

export default function MarketIntelPanel() {
  const [location, setLocation] = useState('')
  const [service, setService] = useState('asphalt paving')
  const [stateCode, setStateCode] = useState('VA')
  const [competitors, setCompetitors] = useState(null)
  const [signals, setSignals] = useState(null)
  const [seasonal, setSeasonal] = useState(null)
  const [loadingComp, setLoadingComp] = useState(false)
  const [loadingSignals, setLoadingSignals] = useState(false)
  const [error, setError] = useState(null)

  const handleCompetitors = async (e) => {
    e.preventDefault()
    if (!location.trim()) return
    setLoadingComp(true)
    setError(null)
    setCompetitors(null)
    try {
      const res = await api.getCompetitors(location.trim(), service)
      setCompetitors(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingComp(false)
    }
  }

  const handleSignals = async () => {
    setLoadingSignals(true)
    setError(null)
    setSignals(null)
    setSeasonal(null)
    try {
      const [sig, sea] = await Promise.all([
        api.getMarketSignals(stateCode),
        api.getSeasonalDemand(stateCode),
      ])
      setSignals(sig)
      setSeasonal(sea)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingSignals(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Competitor search */}
      <div className="card p-6">
        <h3 className="font-display font-bold text-brand-navy text-lg mb-1">🔍 Competitor Radar</h3>
        <p className="text-brand-navy/50 text-sm mb-4">
          Find nearby paving contractors to understand the competitive landscape.
        </p>
        <form onSubmit={handleCompetitors} className="flex flex-wrap gap-3">
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City, state or ZIP (e.g. Richmond, VA)"
            className="input flex-1 min-w-48 text-sm"
          />
          <input
            type="text"
            value={service}
            onChange={(e) => setService(e.target.value)}
            placeholder="Service type"
            className="input w-44 text-sm"
          />
          <button
            type="submit"
            disabled={loadingComp || !location.trim()}
            className="btn-primary text-sm !py-2 disabled:opacity-50 whitespace-nowrap"
          >
            {loadingComp ? 'Searching…' : 'Find Competitors'}
          </button>
        </form>
      </div>

      {/* Competitor results */}
      {competitors && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-display font-semibold text-brand-navy">
              {competitors.count} Competitors near {competitors.location}
            </h4>
          </div>
          {competitors.count === 0 ? (
            <div className="text-brand-navy/40 text-sm text-center py-6">
              No competitors found. This could be a low-competition market! 🏆
            </div>
          ) : (
            <div className="space-y-3">
              {(competitors.competitors || []).map((c, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-3 p-3 rounded-xl bg-brand-navy/3 border border-brand-navy/5"
                >
                  <div>
                    <div className="font-semibold text-brand-navy text-sm">{c.name}</div>
                    {c.address && (
                      <div className="text-brand-navy/40 text-xs mt-0.5">{c.address}</div>
                    )}
                    {c.phone && <div className="text-brand-navy/50 text-xs">{c.phone}</div>}
                  </div>
                  <div className="text-right shrink-0">
                    {c.rating != null ? <StarRating rating={c.rating} /> : null}
                    {c.reviews != null && (
                      <div className="text-brand-navy/30 text-xs">{c.reviews} reviews</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Market signals */}
      <div className="card p-6">
        <h3 className="font-display font-bold text-brand-navy text-lg mb-3">
          📊 State Market Signals
        </h3>
        <div className="flex gap-3 flex-wrap">
          <select
            value={stateCode}
            onChange={(e) => setStateCode(e.target.value)}
            className="input text-sm w-28"
          >
            {STATES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleSignals}
            disabled={loadingSignals}
            className="btn-primary text-sm !py-2 disabled:opacity-50"
          >
            {loadingSignals ? 'Loading…' : 'Get Signals'}
          </button>
        </div>
      </div>

      {error && (
        <div className="card p-4 bg-red-50 border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {signals && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="card p-5">
            <h4 className="font-semibold text-brand-navy text-sm mb-3">
              Lead Trends ({stateCode})
            </h4>
            <div className="space-y-2 text-sm">
              {Object.entries(signals.signals || {}).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-brand-navy/60 capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className="font-semibold text-brand-navy">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
          {seasonal && (
            <div className="card p-5">
              <h4 className="font-semibold text-brand-navy text-sm mb-3">
                Seasonal Demand ({stateCode})
              </h4>
              <div className="space-y-2 text-sm">
                {Object.entries(seasonal.seasonal || {}).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-brand-navy/60 capitalize">{key.replace(/_/g, ' ')}</span>
                    <span className="font-semibold text-brand-navy">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
