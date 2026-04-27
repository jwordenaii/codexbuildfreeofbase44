/**
 * EstimateWidget — inline quick-price calculator.
 *
 * Wraps the existing estimatePrice() lib function in a clean UI card
 * that can be dropped anywhere on the site. Shows a ballpark range
 * instantly in the browser — no API call required.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { estimatePrice } from '../lib/pricing'
import { STATE_OPTIONS } from '../lib/states50'
import { trackEvent } from '../api/client'

const SERVICES = [
  { value: 'paving',      label: 'Asphalt Paving' },
  { value: 'sealcoating', label: 'Sealcoating' },
  { value: 'crackfill',   label: 'Crack Filling' },
  { value: 'parking_lot', label: 'Parking Lot' },
  { value: 'driveway',    label: 'Driveway' },
  { value: 'maintenance', label: 'Maintenance Plan' },
]

const PROPERTY_TYPES = [
  { value: 'residential', label: 'Residential' },
  { value: 'commercial',  label: 'Commercial' },
]

const SIZE_PRESETS = [
  { label: '1-car driveway',    sqft: 400 },
  { label: '2-car driveway',    sqft: 700 },
  { label: 'Small lot (<50 cars)', sqft: 15000 },
  { label: 'Medium lot (50–150 cars)', sqft: 40000 },
]

export default function EstimateWidget({ className = '' }) {
  const [service,  setService]  = useState('driveway')
  const [propType, setPropType] = useState('residential')
  const [sqft,     setSqft]     = useState('')
  const [state,    setState]    = useState('')
  const [result,   setResult]   = useState(null)
  const [touched,  setTouched]  = useState(false)

  const handleEstimate = () => {
    setTouched(true)
    if (!sqft || parseFloat(sqft) <= 0) return
    const r = estimatePrice(service, propType, sqft, state || null)
    setResult(r)
    trackEvent('estimate_calculated', {
      service,
      property_type: propType,
      sqft: parseFloat(sqft),
      state: state || 'none',
    })
  }

  const applyPreset = (preset) => {
    setSqft(String(preset.sqft))
    setResult(null)
  }

  return (
    <div className={`bg-white rounded-2xl shadow-xl border border-brand-navy/10 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-brand-navy text-white px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🧮</span>
          <div>
            <div className="font-display font-bold text-lg">Quick Estimate Calculator</div>
            <div className="text-white/50 text-sm">Get a ballpark range in seconds — free, no obligation</div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="p-6 space-y-5">
        {/* Service type */}
        <div>
          <label className="block text-sm font-semibold text-brand-navy mb-2">Service Type</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SERVICES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => { setService(s.value); setResult(null) }}
                className={`py-2 px-3 rounded-lg text-sm font-medium border-2 transition-all ${
                  service === s.value
                    ? 'border-brand-amber bg-brand-amber/10 text-brand-navy'
                    : 'border-gray-200 text-brand-navy/60 hover:border-brand-amber/50'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Property type */}
        <div>
          <label className="block text-sm font-semibold text-brand-navy mb-2">Property Type</label>
          <div className="flex gap-3">
            {PROPERTY_TYPES.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => { setPropType(p.value); setResult(null) }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                  propType === p.value
                    ? 'border-brand-amber bg-brand-amber/10 text-brand-navy'
                    : 'border-gray-200 text-brand-navy/60 hover:border-brand-amber/50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Square footage */}
        <div>
          <label className="block text-sm font-semibold text-brand-navy mb-2">
            Project Size (sq ft)
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {SIZE_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p)}
                className="text-xs bg-gray-100 text-brand-navy/60 hover:bg-brand-amber/10 hover:text-brand-navy px-3 py-1.5 rounded-full transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
          <input
            type="number"
            min="1"
            value={sqft}
            onChange={(e) => { setSqft(e.target.value); setResult(null) }}
            placeholder="e.g. 700"
            className={`w-full border rounded-lg px-4 py-3 text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-amber/50 transition-colors ${
              touched && !sqft ? 'border-red-400' : 'border-gray-200'
            }`}
          />
          {touched && !sqft && (
            <p className="text-red-500 text-xs mt-1">Please enter a project size.</p>
          )}
        </div>

        {/* State (optional) */}
        <div>
          <label className="block text-sm font-semibold text-brand-navy mb-2">
            State <span className="font-normal text-brand-navy/40">(optional — refines estimate)</span>
          </label>
          <select
            value={state}
            onChange={(e) => { setState(e.target.value); setResult(null) }}
            className="w-full border border-gray-200 rounded-lg px-4 py-3 text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-amber/50"
          >
            <option value="">Select a state…</option>
            {STATE_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Calculate button */}
        <button
          type="button"
          onClick={handleEstimate}
          className="w-full btn-primary py-3 text-base"
        >
          Calculate Estimate →
        </button>

        {/* Result */}
        {result && (
          <div className="rounded-xl bg-brand-amber/10 border border-brand-amber/30 p-5">
            <div className="text-center mb-3">
              <div className="text-brand-navy/60 text-sm font-medium uppercase tracking-wide mb-1">
                Estimated Range
              </div>
              <div className="font-display font-black text-brand-navy text-3xl">
                {result.lowFmt} – {result.highFmt}
              </div>
              {result.stateNote && (
                <div className="text-brand-navy/60 text-xs mt-1">{result.stateNote}</div>
              )}
            </div>
            <p className="text-brand-navy/50 text-xs text-center leading-relaxed">
              {result.disclaimer}
            </p>
            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <Link
                to="/quote"
                className="flex-1 text-center bg-brand-navy text-white rounded-lg px-4 py-3 text-sm font-bold hover:bg-brand-navy/90 transition-colors"
                onClick={() => trackEvent('estimate_to_quote', { service, sqft })}
              >
                Get Exact Free Quote →
              </Link>
              <a
                href="tel:+18044461296"
                className="flex-1 text-center border-2 border-brand-navy text-brand-navy rounded-lg px-4 py-3 text-sm font-bold hover:bg-brand-navy hover:text-white transition-colors"
              >
                📞 Call Now
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
