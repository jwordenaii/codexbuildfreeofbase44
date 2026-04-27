/**
 * Visualizer — 3-D Property Build Modeler page.
 *
 * Customer journey:
 *   1. Enter a property address (or skip to use a square footage directly)
 *   2. The parcel is looked up and the 3-D canvas is pre-sized to that lot
 *   3. Configure build type, materials, finishes, and size in the side panel
 *   4. Watch the 3-D model update live alongside a live cost estimate
 *   5. View AI-powered design suggestions from "Jay Warden AI"
 *   6. Submit the design as a quote request
 */
import { useState, useCallback, lazy, Suspense } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { api, trackEvent } from '../api/client'
import BuildConfigurator from '../components/BuildConfigurator'
import SchemaMarkup, { LOCAL_BUSINESS_SCHEMA } from '../components/SchemaMarkup'

// Lazy-load the heavy Three.js canvas so the rest of the page is fast
const PropertyVisualizer = lazy(() => import('../components/PropertyVisualizer'))

// ── Default visualizer config ─────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  buildType:        'driveway',
  sqft:             2000,
  propertyType:     'residential',
  groundMaterial:   'asphalt',
  exteriorMaterial: 'brick',
  roofColor:        '#4a4a4a',
  floors:           1,
  stateCode:        '',
  aerialUrl:        null,
}

// ── Address Lookup Panel ──────────────────────────────────────────────────────
function AddressStep({ onParcelFound, onSkip }) {
  const [address,  setAddress]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)

  const handleLookup = async () => {
    if (!address.trim()) return
    setLoading(true)
    setError(null)
    try {
      const result = await api.scanParcel({ address })
      trackEvent('visualizer_parcel_scan', {
        source:     result.source,
        confidence: result.confidence,
      })
      onParcelFound(result)
    } catch (err) {
      setError(err.message || 'Could not look up that address. You can skip and enter sq ft manually.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-xl mx-auto text-center py-10"
    >
      <div className="text-5xl mb-4">🗺️</div>
      <h2 className="font-display font-black text-brand-navy text-2xl mb-2">
        Start with Your Property
      </h2>
      <p className="text-brand-navy/60 mb-6 text-sm leading-relaxed">
        Enter your address to auto-size the 3-D model to your parcel, or skip to
        configure by square footage.
      </p>

      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
          placeholder="e.g. 1601 Ware Bottom Springs Rd, Chester, VA"
          className="flex-1 border border-gray-200 rounded-lg px-4 py-3 text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-amber/50 text-sm"
        />
        <button
          type="button"
          onClick={handleLookup}
          disabled={loading || !address.trim()}
          className="btn-primary px-5 py-3 text-sm flex-shrink-0 disabled:opacity-50"
        >
          {loading ? '…' : 'Look Up →'}
        </button>
      </div>

      {error && (
        <p className="text-red-500 text-xs mb-3">{error}</p>
      )}

      <button
        type="button"
        onClick={onSkip}
        className="text-brand-navy/40 hover:text-brand-navy text-sm underline-offset-2 hover:underline transition-colors"
      >
        Skip — I&apos;ll enter my sq ft directly
      </button>
    </motion.div>
  )
}

// ── AI Suggestion Card ────────────────────────────────────────────────────────
function SuggestionCard({ title, description }) {
  return (
    <div className="bg-brand-navy/5 border border-brand-navy/10 rounded-xl p-4">
      <div className="font-semibold text-brand-navy text-sm mb-1">💡 {title}</div>
      <p className="text-brand-navy/60 text-xs leading-relaxed">{description}</p>
    </div>
  )
}

// ── Quote Submission Form ─────────────────────────────────────────────────────
function QuoteForm({ config, onSuccess, onCancel }) {
  const [form,    setForm]    = useState({ name: '', email: '', phone: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.email) return
    setLoading(true)
    setError(null)
    try {
      const result = await api.submitVisualProposal({
        ...form,
        build_type:        config.buildType,
        property_type:     config.propertyType,
        sqft:              config.sqft,
        floors:            config.floors,
        ground_material:   config.groundMaterial,
        exterior_material: config.exteriorMaterial,
        roof_color:        config.roofColor,
        state_code:        config.stateCode || null,
        address:           config.address || null,
      })
      trackEvent('visualizer_quote_submitted', {
        build_type:    config.buildType,
        property_type: config.propertyType,
        sqft:          config.sqft,
      })
      onSuccess(result)
    } catch (err) {
      setError(err.message || 'Submission failed. Please try again or call us directly.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full border border-gray-200 rounded-lg px-4 py-2.5 text-brand-navy text-sm focus:outline-none focus:ring-2 focus:ring-brand-amber/50'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-2xl shadow-xl border border-brand-navy/10 p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-black text-brand-navy text-lg">
          Request This Build
        </h3>
        <button type="button" onClick={onCancel} className="text-brand-navy/30 hover:text-brand-navy text-xl">
          ×
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          required
          placeholder="Your Name *"
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          className={inputCls}
        />
        <input
          required
          type="email"
          placeholder="Email Address *"
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
          className={inputCls}
        />
        <input
          type="tel"
          placeholder="Phone (optional)"
          value={form.phone}
          onChange={(e) => update('phone', e.target.value)}
          className={inputCls}
        />
        <textarea
          rows={2}
          placeholder="Any additional notes or questions?"
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
          className={inputCls + ' resize-none'}
        />

        {error && <p className="text-red-500 text-xs">{error}</p>}

        <button
          type="submit"
          disabled={loading || !form.name || !form.email}
          className="w-full btn-primary py-3 text-sm disabled:opacity-50"
        >
          {loading ? 'Submitting…' : 'Submit My Design →'}
        </button>
      </form>
    </motion.div>
  )
}

// ── Success Panel ─────────────────────────────────────────────────────────────
function SuccessPanel({ result }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center"
    >
      <div className="text-4xl mb-3">✅</div>
      <h3 className="font-display font-black text-brand-navy text-xl mb-2">
        Design Received!
      </h3>
      <p className="text-brand-navy/60 text-sm mb-4 leading-relaxed">
        {result.message}
      </p>
      {result.price_low && (
        <div className="bg-white rounded-xl border border-green-200 p-4 mb-4">
          <div className="text-brand-navy/50 text-xs uppercase tracking-wide mb-1">Estimated Range</div>
          <div className="font-display font-black text-brand-navy text-2xl">
            {result.price_low} – {result.price_high}
          </div>
        </div>
      )}
      {result.narrative && (
        <p className="text-brand-navy/50 text-xs text-left leading-relaxed bg-brand-navy/5 rounded-lg p-3 mb-4">
          {result.narrative}
        </p>
      )}
      <div className="flex flex-col sm:flex-row gap-3">
        <a
          href="tel:+18044461296"
          className="flex-1 text-center border-2 border-brand-navy text-brand-navy rounded-lg px-4 py-2.5 text-sm font-bold hover:bg-brand-navy hover:text-white transition-colors"
        >
          📞 Call (804) 446-1296
        </a>
        <Link
          to="/quote"
          className="flex-1 text-center bg-brand-navy text-white rounded-lg px-4 py-2.5 text-sm font-bold hover:bg-brand-navy/90 transition-colors"
        >
          Full Quote Form →
        </Link>
      </div>
    </motion.div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Visualizer() {
  const [step,        setStep]        = useState('address')  // 'address' | 'builder'
  const [config,      setConfig]      = useState(DEFAULT_CONFIG)
  const [parcelInfo,  setParcelInfo]  = useState(null)
  const [suggestions, setSuggestions] = useState(null)
  const [sugLoading,  setSugLoading]  = useState(false)
  const [showForm,    setShowForm]    = useState(false)
  const [submitResult,setSubmitResult]= useState(null)

  // ── Parcel found callback ───────────────────────────────────────────────
  const handleParcelFound = useCallback((result) => {
    setParcelInfo(result)
    setConfig((prev) => ({
      ...prev,
      sqft:    result.sqft_estimated || prev.sqft,
      aerialUrl: result.aerial_url   || null,
      address: result.address        || prev.address,
    }))
    setStep('builder')
  }, [])

  const handleSkip = useCallback(() => setStep('builder'), [])

  // ── Config change from BuildConfigurator ───────────────────────────────
  const handleConfigChange = useCallback((newConfig) => {
    setConfig(newConfig)
    setSuggestions(null)  // reset suggestions on any config change
  }, [])

  // ── Fetch AI suggestions ───────────────────────────────────────────────
  const fetchSuggestions = useCallback(async () => {
    setSugLoading(true)
    setSuggestions(null)
    try {
      const result = await api.getAIDesignSuggestions({
        build_type:       config.buildType,
        property_type:    config.propertyType,
        sqft:             config.sqft,
        state_code:       config.stateCode || null,
      })
      setSuggestions(result.suggestions || [])
      trackEvent('visualizer_ai_suggestions', { build_type: config.buildType })
    } catch {
      setSuggestions([])
    } finally {
      setSugLoading(false)
    }
  }, [config.buildType, config.propertyType, config.sqft, config.stateCode])

  // ── Submit success ─────────────────────────────────────────────────────
  const handleSuccess = (result) => {
    setSubmitResult(result)
    setShowForm(false)
  }

  return (
    <>
      <SchemaMarkup schema={LOCAL_BUSINESS_SCHEMA} />

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="bg-brand-navy text-white py-14 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="text-brand-amber text-sm font-semibold uppercase tracking-widest mb-3 block">
              3-D Property Visualizer
            </span>
            <h1 className="font-display font-black text-4xl sm:text-5xl mb-4 leading-tight">
              See Your Build{' '}
              <span className="text-brand-amber">Before We Break Ground</span>
            </h1>
            <p className="text-white/60 text-lg max-w-2xl mx-auto leading-relaxed">
              Design your driveway, parking lot, new home, or addition in an interactive
              3-D model — choose materials, colors, and get a live price estimate.
              Then submit your design as a quote with one click.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="min-h-screen bg-gray-50 py-10 px-4">
        <div className="max-w-7xl mx-auto">

          {/* Address step */}
          {step === 'address' && (
            <AddressStep onParcelFound={handleParcelFound} onSkip={handleSkip} />
          )}

          {/* Builder step */}
          {step === 'builder' && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* ── Left: 3-D canvas + AI suggestions ─────────────────── */}
              <div className="lg:col-span-2 space-y-5">

                {/* Parcel info banner */}
                {parcelInfo && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3">
                    <span className="text-blue-500 text-lg">📍</span>
                    <div className="text-sm">
                      <span className="font-semibold text-brand-navy">{parcelInfo.address}</span>
                      <span className="text-brand-navy/50 ml-2">
                        · ~{parcelInfo.sqft_estimated?.toLocaleString()} sq ft
                        {parcelInfo.confidence === 'high' ? ' (verified parcel)' : ' (estimated)'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setStep('address'); setParcelInfo(null) }}
                      className="ml-auto text-brand-navy/40 hover:text-brand-navy text-xs underline"
                    >
                      Change
                    </button>
                  </div>
                )}

                {/* 3-D Canvas */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="font-display font-bold text-brand-navy text-lg">
                      3-D Preview
                    </h2>
                    <span className="text-xs text-brand-navy/40">
                      Drag to rotate · Scroll to zoom · Right-click to pan
                    </span>
                  </div>
                  <Suspense
                    fallback={
                      <div className="w-full rounded-2xl bg-brand-navy/5 border border-brand-navy/10 flex items-center justify-center" style={{ height: 420 }}>
                        <div className="w-8 h-8 border-4 border-brand-amber border-t-transparent rounded-full animate-spin" />
                      </div>
                    }
                  >
                    <PropertyVisualizer config={config} />
                  </Suspense>
                </div>

                {/* AI Design Suggestions */}
                <div className="bg-white rounded-2xl shadow border border-brand-navy/10 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🤖</span>
                      <div>
                        <div className="font-semibold text-brand-navy text-sm">Jay Worden AI — Design Suggestions</div>
                        <div className="text-brand-navy/40 text-xs">Upgrade ideas based on your configuration</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={fetchSuggestions}
                      disabled={sugLoading}
                      className="btn-primary text-xs px-4 py-2 disabled:opacity-50"
                    >
                      {sugLoading ? '…' : suggestions ? 'Refresh' : 'Get Suggestions'}
                    </button>
                  </div>

                  {suggestions && suggestions.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                      {suggestions.map((s, i) => (
                        <SuggestionCard key={i} title={s.title} description={s.description} />
                      ))}
                    </div>
                  )}
                  {suggestions && suggestions.length === 0 && (
                    <p className="text-brand-navy/40 text-sm text-center py-2">
                      No suggestions available — try adjusting your build type.
                    </p>
                  )}
                  {!suggestions && !sugLoading && (
                    <p className="text-brand-navy/40 text-xs text-center py-2">
                      Click &quot;Get Suggestions&quot; for AI-powered upgrade recommendations.
                    </p>
                  )}
                </div>

                {/* Submit result */}
                {submitResult && <SuccessPanel result={submitResult} />}

              </div>

              {/* ── Right: Config panel ──────────────────────────────── */}
              <div className="space-y-4">

                {/* Config card */}
                <div className="bg-white rounded-2xl shadow border border-brand-navy/10 overflow-hidden">
                  <div className="bg-brand-navy text-white px-5 py-4 flex items-center gap-3">
                    <span className="text-2xl">🏗</span>
                    <div>
                      <div className="font-display font-bold text-base">Configure Your Build</div>
                      <div className="text-white/50 text-xs">Every change updates the 3-D model instantly</div>
                    </div>
                  </div>
                  <div className="p-5">
                    <BuildConfigurator config={config} onChange={handleConfigChange} />
                  </div>
                </div>

                {/* CTA */}
                {!submitResult && (
                  <div>
                    {showForm ? (
                      <QuoteForm
                        config={config}
                        onSuccess={handleSuccess}
                        onCancel={() => setShowForm(false)}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowForm(true)}
                        className="w-full btn-primary py-4 text-base"
                      >
                        Request This Build →
                      </button>
                    )}
                    <p className="text-center text-brand-navy/40 text-xs mt-2">
                      Free quote · No obligation · Responds within 24 hrs
                    </p>
                  </div>
                )}

                {/* Trust signals */}
                <div className="bg-brand-navy/5 rounded-xl p-4 text-xs text-brand-navy/50 space-y-1">
                  <div>✅ 4th-generation family company since 1984</div>
                  <div>✅ VA Class A General Contractor · Licensed &amp; Insured</div>
                  <div>✅ KFC · Arby&apos;s · Taco Bell national vendor</div>
                  <div>✅ Best of Houzz — interior design award</div>
                  <div>✅ Free on-site consultation always included</div>
                </div>

              </div>
            </motion.div>
          )}

        </div>
      </div>
    </>
  )
}
