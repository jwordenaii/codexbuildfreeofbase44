/**
 * TakeoffMap — Interactive area takeoff tool for the Command Center.
 *
 * Features:
 *  - Google Map rendered via @vis.gl/react-google-maps
 *  - Address geocoding + map pan/zoom on submit
 *  - Solar API call → displays DSM metadata and roof area overlay info
 *  - "3D View" button → calls Aerial View API, shows cinematic video
 *  - Photo upload → calls OpenCV measure endpoint, displays polygon areas
 *
 * Requires VITE_GOOGLE_MAPS_API_KEY env var to load the map.
 */

import { useCallback, useRef, useState } from 'react'
import { APIProvider, Map, AdvancedMarker, useMapsLibrary } from '@vis.gl/react-google-maps'
import {
  analyzeGroundScan,
  getSolarData,
  getAerialView,
  measureImage,
  runPremiumCivilStack,
  simulatePavementDecay,
} from '../api/takeoff'

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

// Default center: Chester, VA (J. Worden & Sons HQ)
const DEFAULT_CENTER = { lat: 37.3529, lng: -77.4326 }
const DEFAULT_ZOOM = 14

// ── Geocoder hook ─────────────────────────────────────────────────────────────

function useGeocoder() {
  const geocodingLib = useMapsLibrary('geocoding')
  const geocoderRef = useRef(null)

  const geocode = useCallback(
    async (address) => {
      if (!geocodingLib) return null
      if (!geocoderRef.current) geocoderRef.current = new geocodingLib.Geocoder()
      const { results } = await geocoderRef.current.geocode({ address })
      if (!results?.length) return null
      const loc = results[0].geometry.location
      return { lat: loc.lat(), lng: loc.lng() }
    },
    [geocodingLib]
  )

  return geocode
}

// ── Inner map contents (must be inside APIProvider) ───────────────────────────

function MapContents({ onGeocode }) {
  const geocode = useGeocoder()

  // Expose geocode upward via callback so the outer form can use it
  if (onGeocode) onGeocode(geocode)
  return null
}

function MaybeMapsProvider({ children }) {
  if (!MAPS_API_KEY) return children
  return <APIProvider apiKey={MAPS_API_KEY}>{children}</APIProvider>
}

// ── Solar result panel ────────────────────────────────────────────────────────

function SolarPanel({ data }) {
  if (!data) return null
  const stats = data.whole_roof_stats || {}
  return (
    <div className="rounded-xl bg-brand-navy/5 border border-brand-navy/10 p-4 space-y-2 text-sm">
      <h4 className="font-display font-bold text-brand-navy">☀️ Solar / DSM Data</h4>
      {data.max_array_area_m2 && (
        <p>
          <span className="text-brand-navy/60">Max array area:</span>{' '}
          <strong>{(data.max_array_area_m2 * 10.764).toFixed(0)} sq ft</strong>
          <span className="text-brand-navy/40 ml-1">({data.max_array_area_m2.toFixed(1)} m²)</span>
        </p>
      )}
      {data.max_sunshine_hours_per_year && (
        <p>
          <span className="text-brand-navy/60">Peak sun hours / year:</span>{' '}
          <strong>{data.max_sunshine_hours_per_year.toFixed(0)} h</strong>
        </p>
      )}
      {stats.areaMeters2 && (
        <p>
          <span className="text-brand-navy/60">Total roof area:</span>{' '}
          <strong>{(stats.areaMeters2 * 10.764).toFixed(0)} sq ft</strong>
        </p>
      )}
      {data.imagery_quality && (
        <p className="text-xs text-brand-navy/40">Imagery quality: {data.imagery_quality}</p>
      )}
    </div>
  )
}

// ── Measure result panel ──────────────────────────────────────────────────────

function MeasurePanel({ data }) {
  if (!data) return null
  return (
    <div className="rounded-xl bg-brand-navy/5 border border-brand-navy/10 p-4 space-y-2 text-sm">
      <h4 className="font-display font-bold text-brand-navy">📐 Measurement Results</h4>
      <p>
        <span className="text-brand-navy/60">Total area:</span>{' '}
        <strong>{data.total_area_sqft?.toLocaleString()} sq ft</strong>
      </p>
      <p>
        <span className="text-brand-navy/60">Largest polygon:</span>{' '}
        <strong>{data.largest_area_sqft?.toLocaleString()} sq ft</strong>
      </p>
      <p>
        <span className="text-brand-navy/60">Polygons detected:</span>{' '}
        <strong>{data.polygon_count}</strong>
      </p>
      {data.areas_sqft?.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-brand-navy/50">All polygons</summary>
          <ul className="mt-1 space-y-0.5 pl-3 list-disc text-brand-navy/60">
            {data.areas_sqft.map((a, i) => (
              <li key={i}>{a.toLocaleString()} sq ft</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function GroundScanPanel({ data }) {
  if (!data) return null
  const riskClass =
    data.risk_level === 'HIGH'
      ? 'text-red-600 bg-red-50 border-red-200'
      : data.risk_level === 'MEDIUM'
        ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
        : 'text-green-700 bg-green-50 border-green-200'
  return (
    <div className={`rounded-xl border p-4 space-y-3 text-sm ${riskClass}`}>
      <div className="flex items-center justify-between">
        <h4 className="font-display font-bold">🛰️ Utility Locate Risk: {data.risk_level}</h4>
        <span className="text-xs">Confidence {(data.confidence * 100).toFixed(0)}%</span>
      </div>
      <p>{data.recommendation}</p>
      {data.findings?.length > 0 && (
        <ul className="list-disc pl-5 space-y-1">
          {data.findings.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}
      {data.recommended_steps?.length > 0 && (
        <details>
          <summary className="cursor-pointer font-semibold">Required next steps</summary>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            {data.recommended_steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function DecayPanel({ data }) {
  if (!data) return null
  return (
    <div className="rounded-xl bg-brand-navy/5 border border-brand-navy/10 p-4 space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <h4 className="font-display font-bold text-brand-navy">🛣️ Pavement Age-Decay Simulation</h4>
        <span
          className={`text-xs font-bold ${data.risk_level === 'HIGH' ? 'text-red-600' : data.risk_level === 'MEDIUM' ? 'text-yellow-700' : 'text-green-700'}`}
        >
          {data.risk_level}
        </span>
      </div>
      <p>
        <span className="text-brand-navy/60">Current score: </span>
        <strong>{data.current_condition_score}/100</strong>
        <span className="text-brand-navy/40 ml-1">({data.annual_decay_points} pts/year decay)</span>
      </p>
      <div className="grid grid-cols-5 gap-2">
        {data.projection?.map((p) => (
          <div
            key={p.year}
            className="rounded-lg bg-white border border-brand-navy/10 p-2 text-center"
          >
            <div className="text-xs text-brand-navy/40">Year {p.year}</div>
            <div className="font-bold text-brand-navy">{p.condition_score}</div>
            <div className="text-[10px] uppercase text-brand-navy/40">{p.condition_band}</div>
          </div>
        ))}
      </div>
      <p className="text-brand-navy/70">{data.recommended_action}</p>
    </div>
  )
}

function PremiumStackPanel({ data }) {
  if (!data) return null
  const decisionClass =
    data.decision === 'GO'
      ? 'text-green-700 bg-green-50 border-green-200'
      : data.decision === 'CONDITIONAL'
        ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
        : 'text-red-700 bg-red-50 border-red-200'
  return (
    <div className={`rounded-xl border p-4 space-y-4 text-sm ${decisionClass}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h4 className="font-display font-bold">
            👑 Seven Premium Civil-Tech Modules: {data.decision}
          </h4>
          <p className="text-xs opacity-80">
            {data.module_count} modules · Overall {data.overall_score}/100 · {data.overall_risk}{' '}
            risk
          </p>
        </div>
        <span className="font-black text-3xl font-display">{data.overall_score}</span>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {data.modules?.map((module) => (
          <details
            key={module.name}
            className="rounded-lg bg-white/70 border border-current/10 p-3"
            open={module.risk_level !== 'LOW'}
          >
            <summary className="cursor-pointer font-bold flex items-center justify-between gap-3">
              <span>{module.title}</span>
              <span
                className={
                  module.risk_level === 'HIGH'
                    ? 'text-red-700'
                    : module.risk_level === 'MEDIUM'
                      ? 'text-yellow-700'
                      : 'text-green-700'
                }
              >
                {module.score}/100
              </span>
            </summary>
            <p className="mt-2 text-xs">{module.summary}</p>
            {module.actions?.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-xs space-y-1">
                {module.actions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            )}
          </details>
        ))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TakeoffMap() {
  const [address, setAddress] = useState('')
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER)
  const [markerPos, setMarkerPos] = useState(null)
  const [solarData, setSolarData] = useState(null)
  const [aerialUrl, setAerialUrl] = useState(null)
  const [measureData, setMeasureData] = useState(null)
  const [groundScanData, setGroundScanData] = useState(null)
  const [decayData, setDecayData] = useState(null)
  const [premiumStackData, setPremiumStackData] = useState(null)
  const [pixelsPerFoot, setPixelsPerFoot] = useState(10)
  const [scanForm, setScanForm] = useState({
    ticket_status: 'requested',
    technologies: ['811 ticket', 'EM locator', 'GPR', 'GIS overlay', 'vacuum potholing'],
    scan_area_sqft: '',
    anomalies_detected: false,
    soil_moisture: 'normal',
  })
  const [decayForm, setDecayForm] = useState({
    pavement_type: 'commercial_parking_lot',
    age_years: 8,
    traffic_level: 'high',
    drainage_quality: 'fair',
    crack_severity: 'medium',
    potholes: 2,
    rutting_inches: 0.25,
    last_sealcoat_years: 4,
  })
  const [loading, setLoading] = useState({
    geocode: false,
    solar: false,
    aerial: false,
    measure: false,
    scan: false,
    decay: false,
    premium: false,
  })
  const [errors, setErrors] = useState({})
  const geocodeRef = useRef(null)

  const setError = (key, msg) => setErrors((e) => ({ ...e, [key]: msg }))
  const clearError = (key) =>
    setErrors((e) => {
      const n = { ...e }
      delete n[key]
      return n
    })
  const setLoad = (key, val) => setLoading((l) => ({ ...l, [key]: val }))

  const handleAddressSubmit = async (e) => {
    e.preventDefault()
    if (!address.trim()) return
    clearError('geocode')
    clearError('solar')
    setAerialUrl(null)

    // Geocode the address
    let latLng = null
    if (geocodeRef.current) {
      setLoad('geocode', true)
      try {
        latLng = await geocodeRef.current(address)
        if (latLng) {
          setMapCenter(latLng)
          setMarkerPos(latLng)
        } else {
          setError('geocode', 'Address not found on Google Maps.')
        }
      } catch (err) {
        setError('geocode', err.message)
      } finally {
        setLoad('geocode', false)
      }
    }

    // Solar API
    if (latLng) {
      setLoad('solar', true)
      setSolarData(null)
      try {
        const res = await getSolarData({ lat: latLng.lat, lng: latLng.lng })
        setSolarData(res.data)
      } catch (err) {
        setError('solar', err.message)
      } finally {
        setLoad('solar', false)
      }
    }
  }

  const handleAerialView = async () => {
    if (!address.trim()) return
    clearError('aerial')
    setLoad('aerial', true)
    setAerialUrl(null)
    try {
      const res = await getAerialView(address)
      if (res.data?.mp4_url) {
        setAerialUrl(res.data.mp4_url)
      } else {
        setError('aerial', 'No aerial video available for this address.')
      }
    } catch (err) {
      setError('aerial', err.message)
    } finally {
      setLoad('aerial', false)
    }
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    clearError('measure')
    setLoad('measure', true)
    setMeasureData(null)
    try {
      const res = await measureImage(file, pixelsPerFoot)
      setMeasureData(res)
    } catch (err) {
      setError('measure', err.message)
    } finally {
      setLoad('measure', false)
      e.target.value = ''
    }
  }

  const handleGroundScan = async () => {
    clearError('scan')
    setLoad('scan', true)
    setGroundScanData(null)
    try {
      const payload = {
        address,
        scan_area_sqft: scanForm.scan_area_sqft ? Number(scanForm.scan_area_sqft) : undefined,
        ticket_status: scanForm.ticket_status,
        technologies: scanForm.technologies,
        soil_moisture: scanForm.soil_moisture,
        anomalies_detected: scanForm.anomalies_detected,
        utilities: [],
      }
      setGroundScanData(await analyzeGroundScan(payload))
    } catch (err) {
      setError('scan', err.message)
    } finally {
      setLoad('scan', false)
    }
  }

  const handleDecaySim = async () => {
    clearError('decay')
    setLoad('decay', true)
    setDecayData(null)
    try {
      setDecayData(
        await simulatePavementDecay({
          ...decayForm,
          age_years: Number(decayForm.age_years),
          potholes: Number(decayForm.potholes),
          rutting_inches: Number(decayForm.rutting_inches),
          last_sealcoat_years: Number(decayForm.last_sealcoat_years),
        })
      )
    } catch (err) {
      setError('decay', err.message)
    } finally {
      setLoad('decay', false)
    }
  }

  const handlePremiumStack = async () => {
    clearError('premium')
    setLoad('premium', true)
    setPremiumStackData(null)
    try {
      setPremiumStackData(
        await runPremiumCivilStack({
          address,
          scan_area_sqft: scanForm.scan_area_sqft ? Number(scanForm.scan_area_sqft) : undefined,
          ticket_status: scanForm.ticket_status,
          technologies: scanForm.technologies,
          soil_moisture: scanForm.soil_moisture,
          anomalies_detected: scanForm.anomalies_detected,
          utilities: [],
          ...decayForm,
          age_years: Number(decayForm.age_years),
          potholes: Number(decayForm.potholes),
          rutting_inches: Number(decayForm.rutting_inches),
          last_sealcoat_years: Number(decayForm.last_sealcoat_years),
        })
      )
    } catch (err) {
      setError('premium', err.message)
    } finally {
      setLoad('premium', false)
    }
  }

  return (
    <MaybeMapsProvider>
      <div className="space-y-5">
        {MAPS_API_KEY ? (
          <>
            {/* Address form */}
            <form onSubmit={handleAddressSubmit} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter a project address…"
                className="flex-1 input"
                required
              />
              <button
                type="submit"
                disabled={loading.geocode || loading.solar}
                className="btn-primary whitespace-nowrap disabled:opacity-50"
              >
                {loading.geocode || loading.solar ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Loading…
                  </span>
                ) : (
                  'Analyze Site'
                )}
              </button>
              <button
                type="button"
                onClick={handleAerialView}
                disabled={!address || loading.aerial}
                className="btn-outline whitespace-nowrap disabled:opacity-50"
              >
                {loading.aerial ? '…' : '🎥 3D View'}
              </button>
            </form>

            {errors.geocode && <p className="text-sm text-red-600">{errors.geocode}</p>}
            {errors.solar && <p className="text-sm text-yellow-700">{errors.solar}</p>}
            {errors.aerial && <p className="text-sm text-yellow-700">{errors.aerial}</p>}

            {/* Map */}
            <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
              <Map
                style={{ width: '100%', height: '380px' }}
                center={mapCenter}
                zoom={DEFAULT_ZOOM}
                mapId="takeoff-map"
                gestureHandling="cooperative"
              >
                {markerPos && <AdvancedMarker position={markerPos} />}
                <MapContents
                  onGeocode={(fn) => {
                    geocodeRef.current = fn
                  }}
                />
              </Map>
            </div>

            {/* Solar results */}
            {solarData && <SolarPanel data={solarData} />}
            {errors.solar && !solarData && (
              <p className="text-xs text-brand-navy/40">
                Solar data unavailable for this location.
              </p>
            )}

            {/* Aerial video */}
            {aerialUrl && (
              <div className="rounded-xl overflow-hidden border border-gray-200">
                <video
                  src={aerialUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  controls
                  className="w-full max-h-64 object-cover bg-black"
                />
                <p className="text-xs text-brand-navy/40 p-2">Google Aerial View · {address}</p>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-800">
            <strong>Maps/3-D site context not configured.</strong> Add{' '}
            <code className="font-mono bg-yellow-100 px-1 rounded">VITE_GOOGLE_MAPS_API_KEY</code>{' '}
            to enable Google Maps, Solar DSM, and Aerial View. Utility locating, GPR risk, photo
            measurement, and pavement decay still work.
          </div>
        )}

        {/* Photo upload for OpenCV measurement */}
        <div className="rounded-xl border border-gray-200 p-4 space-y-3">
          <h4 className="font-display font-bold text-brand-navy text-sm">
            📷 Photo Measurement (OpenCV)
          </h4>
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-semibold text-brand-navy/60 block">
                Calibration: pixels per foot
              </label>
              <input
                type="number"
                min="1"
                max="10000"
                step="0.5"
                value={pixelsPerFoot}
                onChange={(e) => setPixelsPerFoot(Number(e.target.value))}
                className="input w-28 text-sm"
              />
            </div>
            <label className="btn-outline cursor-pointer whitespace-nowrap disabled:opacity-50">
              {loading.measure ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-brand-navy border-t-transparent rounded-full animate-spin" />
                  Processing…
                </span>
              ) : (
                'Upload Photo →'
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
                disabled={loading.measure}
              />
            </label>
          </div>
          {errors.measure && <p className="text-sm text-red-600">{errors.measure}</p>}
          <MeasurePanel data={measureData} />
        </div>

        {/* Civil-tech utility locating / ground scanning */}
        <div className="rounded-xl border border-gray-200 p-4 space-y-3">
          <h4 className="font-display font-bold text-brand-navy text-sm">
            🛰️ Highest-Level Utility Locating Before Digging
          </h4>
          <p className="text-xs text-brand-navy/50">
            Combines 811 ticket status, EM locating, GPR, GIS/as-built overlay, LiDAR/drone capture,
            thermal/moisture checks, and vacuum potholing confirmation.
          </p>
          <div className="grid sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-semibold text-brand-navy/60 block">811 status</label>
              <select
                value={scanForm.ticket_status}
                onChange={(e) => setScanForm((f) => ({ ...f, ticket_status: e.target.value }))}
                className="input text-sm"
              >
                <option value="not_started">Not started</option>
                <option value="requested">Requested</option>
                <option value="clear">Clear / positive response</option>
                <option value="conflict">Conflict</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-brand-navy/60 block">Area sq ft</label>
              <input
                type="number"
                value={scanForm.scan_area_sqft}
                onChange={(e) => setScanForm((f) => ({ ...f, scan_area_sqft: e.target.value }))}
                className="input text-sm"
                placeholder="25000"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-brand-navy/60 block">
                Soil moisture
              </label>
              <select
                value={scanForm.soil_moisture}
                onChange={(e) => setScanForm((f) => ({ ...f, soil_moisture: e.target.value }))}
                className="input text-sm"
              >
                <option value="dry">Dry</option>
                <option value="normal">Normal</option>
                <option value="saturated">Saturated</option>
              </select>
            </div>
            <label className="flex items-end gap-2 text-sm text-brand-navy/70">
              <input
                type="checkbox"
                checked={scanForm.anomalies_detected}
                onChange={(e) =>
                  setScanForm((f) => ({ ...f, anomalies_detected: e.target.checked }))
                }
              />
              Anomalies found
            </label>
          </div>
          <button
            type="button"
            onClick={handleGroundScan}
            disabled={loading.scan}
            className="btn-outline disabled:opacity-50"
          >
            {loading.scan ? 'Analyzing…' : 'Analyze Utility Locate Package'}
          </button>
          {errors.scan && <p className="text-sm text-red-600">{errors.scan}</p>}
          <GroundScanPanel data={groundScanData} />
        </div>

        {/* Road / parking lot / driveway scanning + age-decay */}
        <div className="rounded-xl border border-gray-200 p-4 space-y-3">
          <h4 className="font-display font-bold text-brand-navy text-sm">
            🛣️ Road / Parking Lot / Driveway Scan + Age Decay
          </h4>
          <div className="grid sm:grid-cols-4 gap-3">
            {[
              [
                'pavement_type',
                'Type',
                [
                  ['residential_driveway', 'Residential'],
                  ['commercial_parking_lot', 'Commercial Lot'],
                  ['road', 'Road'],
                ],
              ],
              [
                'traffic_level',
                'Traffic',
                [
                  ['low', 'Low'],
                  ['medium', 'Medium'],
                  ['high', 'High'],
                  ['heavy_truck', 'Heavy Truck'],
                ],
              ],
              [
                'drainage_quality',
                'Drainage',
                [
                  ['good', 'Good'],
                  ['fair', 'Fair'],
                  ['poor', 'Poor'],
                ],
              ],
              [
                'crack_severity',
                'Cracks',
                [
                  ['none', 'None'],
                  ['low', 'Low'],
                  ['medium', 'Medium'],
                  ['high', 'High'],
                ],
              ],
            ].map(([name, label, options]) => (
              <div key={name}>
                <label className="text-xs font-semibold text-brand-navy/60 block">{label}</label>
                <select
                  value={decayForm[name]}
                  onChange={(e) => setDecayForm((f) => ({ ...f, [name]: e.target.value }))}
                  className="input text-sm"
                >
                  {options.map(([value, text]) => (
                    <option key={value} value={value}>
                      {text}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            {[
              ['age_years', 'Age years'],
              ['potholes', 'Potholes'],
              ['rutting_inches', 'Rutting in.'],
              ['last_sealcoat_years', 'Sealcoat age'],
            ].map(([name, label]) => (
              <div key={name}>
                <label className="text-xs font-semibold text-brand-navy/60 block">{label}</label>
                <input
                  type="number"
                  step="0.1"
                  value={decayForm[name]}
                  onChange={(e) => setDecayForm((f) => ({ ...f, [name]: e.target.value }))}
                  className="input text-sm"
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleDecaySim}
            disabled={loading.decay}
            className="btn-outline disabled:opacity-50"
          >
            {loading.decay ? 'Simulating…' : 'Run Age-Decay Simulation'}
          </button>
          {errors.decay && <p className="text-sm text-red-600">{errors.decay}</p>}
          <DecayPanel data={decayData} />
        </div>

        {/* Seven premium autonomous modules */}
        <div className="rounded-xl border border-brand-amber/40 bg-brand-amber/5 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h4 className="font-display font-bold text-brand-navy text-sm">
                👑 Seven Premium Autonomous Civil-Tech Modules
              </h4>
              <p className="text-xs text-brand-navy/50">
                Runs utility locate shield, GPR digital twin, pavement decay twin, asphalt thermal
                AI, drainage/moisture radar, traffic phasing, and autonomous go/no-go foreman
                together.
              </p>
            </div>
            <button
              type="button"
              onClick={handlePremiumStack}
              disabled={loading.premium}
              className="btn-primary whitespace-nowrap disabled:opacity-50"
            >
              {loading.premium ? 'Running 7 Modules…' : 'Run Premium 7'}
            </button>
          </div>
          {errors.premium && <p className="text-sm text-red-600">{errors.premium}</p>}
          <PremiumStackPanel data={premiumStackData} />
        </div>
      </div>
    </MaybeMapsProvider>
  )
}
