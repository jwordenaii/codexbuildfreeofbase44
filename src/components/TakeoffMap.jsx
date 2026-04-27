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
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMapsLibrary,
} from '@vis.gl/react-google-maps'
import { getSolarData, getAerialView, measureImage } from '../api/takeoff'

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
    [geocodingLib],
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

// ── Solar result panel ────────────────────────────────────────────────────────

function SolarPanel({ data }) {
  if (!data) return null
  const stats = data.whole_roof_stats || {}
  return (
    <div className="rounded-xl bg-brand-navy/5 border border-brand-navy/10 p-4 space-y-2 text-sm">
      <h4 className="font-display font-bold text-brand-navy">☀️ Solar / DSM Data</h4>
      {data.max_array_area_m2 && (
        <p><span className="text-brand-navy/60">Max array area:</span>{' '}
          <strong>{(data.max_array_area_m2 * 10.764).toFixed(0)} sq ft</strong>
          <span className="text-brand-navy/40 ml-1">({data.max_array_area_m2.toFixed(1)} m²)</span>
        </p>
      )}
      {data.max_sunshine_hours_per_year && (
        <p><span className="text-brand-navy/60">Peak sun hours / year:</span>{' '}
          <strong>{data.max_sunshine_hours_per_year.toFixed(0)} h</strong>
        </p>
      )}
      {stats.areaMeters2 && (
        <p><span className="text-brand-navy/60">Total roof area:</span>{' '}
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
      <p><span className="text-brand-navy/60">Total area:</span>{' '}
        <strong>{data.total_area_sqft?.toLocaleString()} sq ft</strong>
      </p>
      <p><span className="text-brand-navy/60">Largest polygon:</span>{' '}
        <strong>{data.largest_area_sqft?.toLocaleString()} sq ft</strong>
      </p>
      <p><span className="text-brand-navy/60">Polygons detected:</span>{' '}
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

// ── Main component ────────────────────────────────────────────────────────────

export default function TakeoffMap() {
  const [address, setAddress] = useState('')
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER)
  const [markerPos, setMarkerPos] = useState(null)
  const [solarData, setSolarData] = useState(null)
  const [aerialUrl, setAerialUrl] = useState(null)
  const [measureData, setMeasureData] = useState(null)
  const [pixelsPerFoot, setPixelsPerFoot] = useState(10)
  const [loading, setLoading] = useState({ geocode: false, solar: false, aerial: false, measure: false })
  const [errors, setErrors] = useState({})
  const geocodeRef = useRef(null)

  const setError = (key, msg) => setErrors((e) => ({ ...e, [key]: msg }))
  const clearError = (key) => setErrors((e) => { const n = { ...e }; delete n[key]; return n })
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

  if (!MAPS_API_KEY) {
    return (
      <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-6 text-sm text-yellow-800">
        <strong>Google Maps not configured.</strong> Add{' '}
        <code className="font-mono bg-yellow-100 px-1 rounded">VITE_GOOGLE_MAPS_API_KEY</code> to your
        environment variables to enable the Takeoff Map.
      </div>
    )
  }

  return (
    <APIProvider apiKey={MAPS_API_KEY}>
      <div className="space-y-5">

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
            ) : 'Analyze Site'}
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
        {errors.solar   && <p className="text-sm text-yellow-700">{errors.solar}</p>}
        {errors.aerial  && <p className="text-sm text-yellow-700">{errors.aerial}</p>}

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
            <MapContents onGeocode={(fn) => { geocodeRef.current = fn }} />
          </Map>
        </div>

        {/* Solar results */}
        {solarData && <SolarPanel data={solarData} />}
        {errors.solar && !solarData && (
          <p className="text-xs text-brand-navy/40">Solar data unavailable for this location.</p>
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
            <p className="text-xs text-brand-navy/40 p-2">
              Google Aerial View · {address}
            </p>
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
              ) : 'Upload Photo →'}
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
      </div>
    </APIProvider>
  )
}
