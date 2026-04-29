/**
 * DrivewayScan — JWORDENAI™ Customer Tools
 *
 * Two public tools:
 *   1. Driveway Condition Scanner — upload a photo, get an AI prep report
 *   2. Driveway Measure Tool — draw a polygon sketch or enter dimensions
 *      to calculate square footage for a quote
 */

import { useRef, useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../api/client'

// ── Animation helpers ──────────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.1 } }),
}

// ── Condition score → color ────────────────────────────────────────────────────
function scoreColor(score) {
  if (!score) return 'text-brand-navy/40'
  if (score >= 8) return 'text-green-600'
  if (score >= 5) return 'text-yellow-600'
  return 'text-red-600'
}
function scoreBg(score) {
  if (!score) return 'bg-gray-100'
  if (score >= 8) return 'bg-green-50 border-green-200'
  if (score >= 5) return 'bg-yellow-50 border-yellow-200'
  return 'bg-red-50 border-red-200'
}

const URGENCY_COLOR = {
  'No rush — routine maintenance': 'bg-green-100 text-green-800',
  'Within 1–2 seasons': 'bg-yellow-100 text-yellow-800',
  'This season — before it worsens': 'bg-orange-100 text-orange-800',
  'Urgent — address now': 'bg-red-100 text-red-800',
}

// ── Service label map ──────────────────────────────────────────────────────────
const SERVICE_LABELS = {
  sealcoating: 'Sealcoating',
  crack_filling_and_sealcoating: 'Crack Filling + Sealcoating',
  partial_overlay: 'Partial Overlay',
  full_replacement: 'Full Replacement',
  patch_and_sealcoat: 'Patch & Sealcoat',
  maintenance_only: 'Routine Maintenance',
}

// ── Polygon area (shoelace) — uses pixel coordinates scaled to sqft ────────────
function polygonAreaPx(pts) {
  if (pts.length < 3) return 0
  let area = 0
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += pts[i].x * pts[j].y
    area -= pts[j].x * pts[i].y
  }
  return Math.abs(area / 2)
}

// ── ConditionScanner component ─────────────────────────────────────────────────
function ConditionScanner() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  const handleFile = (f) => {
    if (!f) return
    setFile(f)
    setResult(null)
    setError(null)
    const url = URL.createObjectURL(f)
    setPreview(url)
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [])

  const handleScan = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const data = await api.scanDriveway(fd)
      setResult(data.analysis)
    } catch (err) {
      setError(err.message || 'Scan failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload area */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        className="relative border-2 border-dashed border-brand-amber/40 rounded-2xl p-8 text-center cursor-pointer hover:border-brand-amber/70 hover:bg-brand-amber/3 transition-colors group"
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
        />
        {preview ? (
          <img
            src={preview}
            alt="Driveway preview"
            className="max-h-64 mx-auto rounded-xl object-contain shadow-md"
          />
        ) : (
          <>
            <div className="text-5xl mb-3">📸</div>
            <p className="font-semibold text-brand-navy text-base">
              Tap to choose a photo — or drag &amp; drop
            </p>
            <p className="text-brand-navy/50 text-sm mt-1">
              JPEG · PNG · WebP · Max 10 MB
            </p>
            <p className="text-brand-navy/40 text-xs mt-3">
              Best results: take the photo from ground level at the edge of your driveway,
              or a top-down view showing the full surface.
            </p>
          </>
        )}
        {preview && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setFile(null)
              setPreview(null)
              setResult(null)
              setError(null)
            }}
            className="absolute top-3 right-3 bg-white/90 text-brand-navy rounded-full w-7 h-7 flex items-center justify-center text-sm shadow hover:bg-white transition"
            aria-label="Remove photo"
          >
            ✕
          </button>
        )}
      </div>

      {file && !loading && !result && (
        <button
          onClick={handleScan}
          className="w-full bg-brand-amber text-brand-navy font-black py-4 rounded-xl text-lg hover:bg-brand-amber/90 transition-colors shadow-md"
        >
          🔍 Scan My Driveway
        </button>
      )}

      {loading && (
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="w-12 h-12 border-4 border-brand-amber border-t-transparent rounded-full animate-spin" />
          <p className="text-brand-navy/60 text-sm">
            JWORDENAI™ is analyzing your driveway…
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {result && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Score header */}
            <div className={`border rounded-2xl p-5 flex items-center gap-5 ${scoreBg(result.condition_score)}`}>
              <div className="text-center min-w-[64px]">
                <div className={`font-display font-black text-4xl ${scoreColor(result.condition_score)}`}>
                  {result.condition_score ?? '—'}
                </div>
                <div className="text-xs text-brand-navy/50 font-medium">out of 10</div>
              </div>
              <div>
                <div className="font-display font-bold text-brand-navy text-xl">
                  {result.condition_label ?? 'Unknown'}
                </div>
                <p className="text-brand-navy/70 text-sm mt-1 leading-relaxed">
                  {result.customer_summary}
                </p>
              </div>
            </div>

            {/* Urgency + recommended service */}
            <div className="grid sm:grid-cols-2 gap-3">
              {result.urgency && (
                <div className="bg-white border border-brand-navy/10 rounded-xl p-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-brand-navy/40 mb-2">
                    Urgency
                  </div>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${URGENCY_COLOR[result.urgency] || 'bg-gray-100 text-gray-700'}`}>
                    {result.urgency}
                  </span>
                </div>
              )}
              {result.recommended_service && (
                <div className="bg-white border border-brand-navy/10 rounded-xl p-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-brand-navy/40 mb-2">
                    Recommended Service
                  </div>
                  <div className="font-semibold text-brand-navy">
                    {SERVICE_LABELS[result.recommended_service] || result.recommended_service}
                  </div>
                </div>
              )}
            </div>

            {/* Issues found */}
            {result.issues_found?.length > 0 && (
              <div className="bg-white border border-brand-navy/10 rounded-xl p-5">
                <div className="font-display font-bold text-brand-navy mb-3">
                  🔎 Issues Identified
                </div>
                <ul className="space-y-1.5">
                  {result.issues_found.map((issue, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-brand-navy/70">
                      <span className="text-red-500 mt-0.5">●</span>
                      <span className="capitalize">{issue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Prep work required */}
            {result.prep_work_required?.length > 0 && (
              <div className="bg-white border border-brand-navy/10 rounded-xl p-5">
                <div className="font-display font-bold text-brand-navy mb-3">
                  🛠️ Prep Work Required Before Paving
                </div>
                <div className="space-y-3">
                  {result.prep_work_required.map((step, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-brand-amber text-brand-navy font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <div>
                        <div className="font-semibold text-brand-navy text-sm">{step.task}</div>
                        <div className="text-brand-navy/55 text-sm">{step.why}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="bg-brand-navy rounded-2xl p-5 text-center text-white">
              <p className="font-semibold mb-1">Ready to get this taken care of?</p>
              <p className="text-white/60 text-sm mb-4">
                Get a free on-site quote from J. Worden &amp; Sons — we&apos;ll confirm everything
                in person, no charge, no obligation.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link to="/quote" className="btn-primary text-sm px-6 py-3">
                  Get a Free Quote
                </Link>
                <a href="tel:+18044461296" className="border border-white/30 text-white font-bold px-6 py-3 rounded-lg hover:bg-white/10 transition-colors text-sm">
                  Call (804) 446-1296
                </a>
              </div>
            </div>

            {/* Scan another */}
            <button
              onClick={() => { setFile(null); setPreview(null); setResult(null) }}
              className="w-full border border-brand-navy/20 text-brand-navy/60 font-medium py-3 rounded-xl hover:bg-brand-navy/5 transition-colors text-sm"
            >
              ↩ Scan a Different Photo
            </button>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  )
}

// ── DrivewayMeasure component ──────────────────────────────────────────────────
const PRICE_RANGE = {
  sealcoating: { lo: 0.15, hi: 0.35, label: 'Sealcoating' },
  crack_fill: { lo: 0.40, hi: 1.00, label: 'Crack Filling' },
  paving: { lo: 3.50, hi: 8.00, label: 'New Paving' },
  overlay: { lo: 2.00, hi: 4.00, label: 'Overlay' },
}

function DrivewayMeasure() {
  const canvasRef = useRef(null)
  const [mode, setMode] = useState('rectangle') // 'rectangle' | 'polygon'
  const [points, setPoints] = useState([])
  const [closed, setClosed] = useState(false)
  const [sqft, setSqft] = useState(null)
  const [scale, setScale] = useState(10) // pixels per foot
  const [rectW, setRectW] = useState('')
  const [rectL, setRectL] = useState('')
  const [service, setService] = useState('paving')

  // ── Rectangle calculator ──────────────────────────────────────────────────
  const rectSqft = rectW && rectL ? Math.round(parseFloat(rectW) * parseFloat(rectL)) : null

  const displaySqft = mode === 'rectangle' ? rectSqft : sqft

  const priceRange = displaySqft && PRICE_RANGE[service]
    ? {
        lo: Math.round(displaySqft * PRICE_RANGE[service].lo),
        hi: Math.round(displaySqft * PRICE_RANGE[service].hi),
      }
    : null

  // ── Canvas drawing ─────────────────────────────────────────────────────────
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Grid
    ctx.strokeStyle = 'rgba(0,0,0,0.06)'
    ctx.lineWidth = 1
    const gridSize = scale * 5
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke()
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke()
    }

    if (points.length === 0) return

    // Draw polygon
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
    if (closed) ctx.closePath()

    ctx.strokeStyle = '#f5a623'
    ctx.lineWidth = 2.5
    ctx.stroke()

    if (closed) {
      ctx.fillStyle = 'rgba(245,166,35,0.15)'
      ctx.fill()
    }

    // Dots
    points.forEach((p, i) => {
      ctx.beginPath()
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
      ctx.fillStyle = i === 0 ? '#f5a623' : '#1a2c4e'
      ctx.fill()
    })
  }, [points, closed, scale])

  useEffect(() => { drawCanvas() }, [drawCanvas])

  const getCanvasPoint = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const handleCanvasClick = (e) => {
    if (closed) return
    const pt = getCanvasPoint(e)
    // Close polygon if clicking near first point
    if (points.length >= 3) {
      const dx = pt.x - points[0].x
      const dy = pt.y - points[0].y
      if (Math.sqrt(dx * dx + dy * dy) < 16) {
        setClosed(true)
        const areaPx = polygonAreaPx(points)
        const sqftVal = Math.round(areaPx / (scale * scale))
        setSqft(sqftVal)
        return
      }
    }
    setPoints((prev) => [...prev, pt])
  }

  const resetPolygon = () => {
    setPoints([])
    setClosed(false)
    setSqft(null)
  }

  return (
    <div className="space-y-6">
      {/* Mode toggle */}
      <div className="flex rounded-xl overflow-hidden border border-brand-navy/15">
        <button
          onClick={() => { setMode('rectangle'); resetPolygon() }}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${mode === 'rectangle' ? 'bg-brand-navy text-white' : 'bg-white text-brand-navy/60 hover:bg-brand-navy/5'}`}
        >
          📐 Enter Dimensions
        </button>
        <button
          onClick={() => setMode('polygon')}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${mode === 'polygon' ? 'bg-brand-navy text-white' : 'bg-white text-brand-navy/60 hover:bg-brand-navy/5'}`}
        >
          ✏️ Sketch &amp; Trace
        </button>
      </div>

      {mode === 'rectangle' ? (
        <div className="bg-white border border-brand-navy/10 rounded-2xl p-5 space-y-4">
          <p className="text-brand-navy/60 text-sm">
            Enter your driveway&apos;s approximate width and length to instantly calculate the area.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-navy/40 mb-1">
                Width (feet)
              </label>
              <input
                type="number"
                min="1"
                step="0.5"
                value={rectW}
                onChange={(e) => setRectW(e.target.value)}
                placeholder="e.g. 14"
                className="w-full border border-brand-navy/20 rounded-lg px-3 py-2.5 text-brand-navy text-base focus:outline-none focus:ring-2 focus:ring-brand-amber"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-navy/40 mb-1">
                Length (feet)
              </label>
              <input
                type="number"
                min="1"
                step="0.5"
                value={rectL}
                onChange={(e) => setRectL(e.target.value)}
                placeholder="e.g. 60"
                className="w-full border border-brand-navy/20 rounded-lg px-3 py-2.5 text-brand-navy text-base focus:outline-none focus:ring-2 focus:ring-brand-amber"
              />
            </div>
          </div>
          <p className="text-brand-navy/40 text-xs">
            Not sure? Most residential driveways are 10–18 ft wide and 20–100 ft long.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-brand-amber/8 border border-brand-amber/30 rounded-xl px-4 py-3 text-sm text-brand-navy/70">
            <strong className="text-brand-navy">How to use:</strong> Tap points along the outline of your driveway.
            Tap the first point again (the amber dot) to close the shape and calculate the area.
          </div>

          {/* Scale selector */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-brand-navy/50 font-medium whitespace-nowrap">Grid scale:</span>
            <select
              value={scale}
              onChange={(e) => { setScale(Number(e.target.value)); resetPolygon() }}
              className="border border-brand-navy/20 rounded-lg px-2 py-1.5 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-amber"
            >
              <option value={5}>5 px = 1 ft (small driveway)</option>
              <option value={8}>8 px = 1 ft</option>
              <option value={10}>10 px = 1 ft (standard)</option>
              <option value={15}>15 px = 1 ft (long driveway)</option>
              <option value={20}>20 px = 1 ft (large lot)</option>
            </select>
          </div>

          <canvas
            ref={canvasRef}
            width={700}
            height={380}
            onClick={handleCanvasClick}
            onTouchStart={(e) => { e.preventDefault(); handleCanvasClick(e) }}
            className="w-full rounded-xl border-2 border-brand-navy/15 bg-gray-50 cursor-crosshair touch-none"
            style={{ maxHeight: 320 }}
          />

          <div className="flex gap-2">
            <button
              onClick={resetPolygon}
              className="flex-1 border border-brand-navy/20 text-brand-navy/60 font-medium py-2 rounded-lg hover:bg-brand-navy/5 transition-colors text-sm"
            >
              🔄 Clear &amp; Start Over
            </button>
            {points.length >= 3 && !closed && (
              <button
                onClick={() => {
                  setClosed(true)
                  const areaPx = polygonAreaPx(points)
                  setSqft(Math.round(areaPx / (scale * scale)))
                }}
                className="flex-1 bg-brand-amber text-brand-navy font-bold py-2 rounded-lg hover:bg-brand-amber/90 transition-colors text-sm"
              >
                ✓ Close Shape
              </button>
            )}
          </div>
        </div>
      )}

      {/* Service selector + results */}
      {displaySqft && displaySqft > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Sqft result */}
          <div className="bg-brand-navy rounded-2xl p-5 text-center text-white">
            <div className="font-display font-black text-5xl text-brand-amber">
              {displaySqft.toLocaleString()}
            </div>
            <div className="text-white/70 text-sm mt-1 font-medium">square feet</div>
          </div>

          {/* Service type selector */}
          <div className="bg-white border border-brand-navy/10 rounded-2xl p-5">
            <label className="block text-xs font-bold uppercase tracking-wider text-brand-navy/40 mb-3">
              What service are you considering?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(PRICE_RANGE).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => setService(key)}
                  className={`py-2.5 px-3 rounded-lg text-sm font-semibold border transition-colors ${
                    service === key
                      ? 'bg-brand-amber text-brand-navy border-brand-amber'
                      : 'bg-white text-brand-navy/60 border-brand-navy/15 hover:border-brand-amber/50 hover:bg-brand-amber/5'
                  }`}
                >
                  {val.label}
                </button>
              ))}
            </div>
          </div>

          {/* Price estimate */}
          {priceRange && (
            <div className="bg-brand-amber/10 border border-brand-amber/30 rounded-2xl p-5">
              <div className="text-xs font-bold uppercase tracking-wider text-brand-navy/40 mb-2">
                Estimated Project Range
              </div>
              <div className="font-display font-black text-brand-navy text-3xl">
                ${priceRange.lo.toLocaleString()} – ${priceRange.hi.toLocaleString()}
              </div>
              <p className="text-brand-navy/55 text-xs mt-1">
                Based on {displaySqft.toLocaleString()} sqft ×{' '}
                ${PRICE_RANGE[service].lo.toFixed(2)}–${PRICE_RANGE[service].hi.toFixed(2)}/sqft.
                Actual price depends on site conditions, access, and materials — get a free
                on-site quote for an exact number.
              </p>
            </div>
          )}

          {/* CTA */}
          <div className="grid sm:grid-cols-2 gap-3">
            <Link
              to={`/quote?sqft=${displaySqft}&service=${service}`}
              className="bg-brand-amber text-brand-navy font-black py-3 px-5 rounded-xl text-center hover:bg-brand-amber/90 transition-colors text-sm"
            >
              Get My Free Quote →
            </Link>
            <a
              href="tel:+18044461296"
              className="border border-brand-navy/20 text-brand-navy font-bold py-3 px-5 rounded-xl text-center hover:bg-brand-navy/5 transition-colors text-sm"
            >
              📞 Call (804) 446-1296
            </a>
          </div>
        </motion.div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'scan', icon: '📷', label: 'Scan My Driveway' },
  { id: 'measure', icon: '📐', label: 'Measure My Driveway' },
]

export default function DrivewayScan() {
  const [activeTab, setActiveTab] = useState('scan')

  useEffect(() => {
    document.title = 'JWORDENAI™ Driveway Tools — Free Condition Scan & Area Calculator'
    const m = document.querySelector('meta[name="description"]')
    if (m)
      m.setAttribute(
        'content',
        'Upload a photo of your driveway for a free AI condition report — or use our sketch tool to measure your driveway area and get an instant price estimate.'
      )
  }, [])

  return (
    <>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <section className="bg-brand-navy text-white pt-24 pb-12 relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 70% 50% at 70% 40%, rgba(245,166,35,0.10) 0%, transparent 70%)',
          }}
        />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" animate="visible" variants={fadeUp}>
            <Link
              to="/jwordenai"
              className="inline-flex items-center gap-1.5 text-brand-amber/70 hover:text-brand-amber text-sm font-medium mb-6 transition-colors"
            >
              ← Back to JWORDENAI™
            </Link>

            <div className="inline-flex items-center gap-2 bg-brand-amber/10 border border-brand-amber/30 text-brand-amber text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-amber animate-pulse" />
              Free Customer Tools · No Login Required
            </div>

            <h1 className="font-display font-black text-4xl sm:text-5xl leading-tight mb-4">
              JWORDENAI™{' '}
              <span className="text-brand-amber">Driveway Tools</span>
            </h1>
            <p className="text-white/70 text-lg max-w-2xl leading-relaxed">
              Two free tools to help you understand your driveway — before you even talk to us.
              Upload a photo for an instant AI condition report, or sketch your driveway to
              estimate size and cost.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Tools ───────────────────────────────────────────────────────── */}
      <section className="py-10 bg-gray-50 min-h-screen">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          {/* Tab bar */}
          <div className="flex rounded-2xl overflow-hidden shadow-sm border border-brand-navy/10 mb-8 bg-white">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1.5 py-4 px-3 text-sm font-bold transition-colors ${
                  activeTab === tab.id
                    ? 'bg-brand-navy text-white'
                    : 'text-brand-navy/50 hover:text-brand-navy hover:bg-brand-navy/5'
                }`}
              >
                <span className="text-xl">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'scan' ? <ConditionScanner /> : <DrivewayMeasure />}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* ── Trust strip ─────────────────────────────────────────────────── */}
      <section className="py-10 bg-white border-t border-brand-navy/10">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-brand-navy/40 text-xs font-medium uppercase tracking-widest mb-4">
            Powered by JWORDENAI™ · J. Worden &amp; Sons · Chester, Virginia · Est. 1984
          </p>
          <div className="flex flex-wrap justify-center gap-6 text-brand-navy/50 text-sm">
            <span>⭐ 4.9/5 Rating</span>
            <span>·</span>
            <span>40+ Years Experience</span>
            <span>·</span>
            <span>Free On-Site Quotes</span>
            <span>·</span>
            <span>Licensed &amp; Insured</span>
          </div>
        </div>
      </section>
    </>
  )
}
