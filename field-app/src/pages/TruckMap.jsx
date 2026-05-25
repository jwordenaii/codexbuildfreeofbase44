import { useState, useEffect, useCallback, useRef } from 'react'
import { getTrucks, getThermalWindow } from '../api/jobs'
import { logAsphaltTemp } from '../api/vision'
import TempGauge from '../components/TempGauge'
import { useGPS } from '../hooks/useGPS'

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

function TruckRow({ truck, onLogTemp }) {
  const [showTemp, setShowTemp] = useState(false)
  const [tempInput, setTempInput] = useState('')
  const [logging, setLogging] = useState(false)

  const status_colors = {
    en_route:  { dot: 'bg-brand-400',  text: 'En Route' },
    on_site:   { dot: 'bg-green-400',  text: 'On Site'  },
    at_plant:  { dot: 'bg-blue-400',   text: 'At Plant' },
    returning: { dot: 'bg-slate-400',  text: 'Returning'},
  }
  const sc = status_colors[truck.status] ?? status_colors.en_route

  const handleLog = async () => {
    const t = parseFloat(tempInput)
    if (isNaN(t) || t < 0 || t > 450) return
    setLogging(true)
    try {
      await onLogTemp(truck.id, t)
      setShowTemp(false)
      setTempInput('')
    } finally {
      setLogging(false)
    }
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-surface-700 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" d="M8 7h8m-8 4h8m-4 4h4M3 5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-bold text-slate-100">{truck.name ?? truck.plate ?? `Truck ${truck.id}`}</p>
            <span className="status-badge bg-surface-700">
              <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
              <span className="text-slate-300 text-[10px]">{sc.text}</span>
            </span>
          </div>
          {truck.driver && <p className="text-xs text-slate-500 mt-0.5">Driver: {truck.driver}</p>}
          {truck.eta_minutes != null && (
            <p className="text-xs font-bold text-brand-400 mt-1">
              ETA: {truck.eta_minutes < 1 ? 'Arriving' : `${truck.eta_minutes} min`}
            </p>
          )}
        </div>
      </div>

      {/* Last temp reading */}
      {truck.last_temp_f != null && (
        <TempGauge tempF={truck.last_temp_f} compact />
      )}

      {/* Log temp */}
      {!showTemp ? (
        <button
          onClick={() => setShowTemp(true)}
          className="flex items-center gap-2 text-xs font-semibold text-brand-400 active:text-brand-300 py-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" d="M12 4v1m0 14v1m8-8h-1M5 12H4m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
          </svg>
          Log mix temp
        </button>
      ) : (
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="decimal"
            placeholder="Temp °F"
            value={tempInput}
            onChange={e => setTempInput(e.target.value)}
            className="input-field flex-1 py-2.5 text-sm"
            min="0"
            max="450"
          />
          <button onClick={handleLog} disabled={logging} className="btn-primary py-2.5 px-4 text-sm w-auto flex-shrink-0">
            {logging ? '…' : 'Log'}
          </button>
          <button onClick={() => setShowTemp(false)} className="btn-secondary py-2.5 px-3 w-auto flex-shrink-0">
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

export default function TruckMap() {
  const { position } = useGPS()
  const [trucks, setTrucks]     = useState([])
  const [thermal, setThermal]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [mapLoaded, setMapLoaded] = useState(false)
  const mapRef = useRef(null)

  useEffect(() => {
    getTrucks()
      .then(data => setTrucks(Array.isArray(data) ? data : (data?.trucks ?? [])))
      .catch(() => {})
      .finally(() => setLoading(false))

    const iv = setInterval(() => {
      getTrucks()
        .then(data => setTrucks(Array.isArray(data) ? data : (data?.trucks ?? [])))
        .catch(() => {})
    }, 30_000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    if (position) {
      getThermalWindow({ lat: position.lat, lng: position.lng })
        .then(setThermal)
        .catch(() => {})
    }
  }, [position])

  // Load Google Maps script once
  useEffect(() => {
    if (!GOOGLE_MAPS_KEY || window.google?.maps) { setMapLoaded(true); return }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=marker`
    script.async = true
    script.onload = () => setMapLoaded(true)
    document.head.appendChild(script)
  }, [])

  // Render map with truck markers
  useEffect(() => {
    if (!mapLoaded || !window.google?.maps || !mapRef.current) return
    const center = position ?? { lat: 37.3529, lng: -77.4326 }
    const map = new window.google.maps.Map(mapRef.current, {
      center,
      zoom: 11,
      mapId: 'field-app-dark',
      disableDefaultUI: true,
      zoomControl: true,
      styles: [
        { elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#334155' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
      ],
    })

    trucks
      .filter(t => t.lat && t.lng)
      .forEach(t => {
        new window.google.maps.Marker({
          position: { lat: t.lat, lng: t.lng },
          map,
          label: { text: '🚛', fontSize: '22px' },
          title: t.name ?? t.plate,
        })
      })
  }, [mapLoaded, trucks, position])

  const handleLogTemp = useCallback(async (truckId, tempF) => {
    await logAsphaltTemp({ truckId, tempF, lat: position?.lat, lng: position?.lng })
    setTrucks(ts => ts.map(t => t.id === truckId ? { ...t, last_temp_f: tempF } : t))
  }, [position])

  const enRoute = trucks.filter(t => t.status === 'en_route')
  const onSite  = trucks.filter(t => t.status === 'on_site')
  const rest    = trucks.filter(t => !['en_route','on_site'].includes(t.status))

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="text-lg font-black text-slate-100">Fleet & Mix</h1>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-500">
            {trucks.length} truck{trucks.length !== 1 ? 's' : ''}
          </span>
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        </div>
      </div>

      <div className="px-4 pt-5 space-y-5">

        {/* Map */}
        <div className="rounded-2xl overflow-hidden border border-surface-700 bg-surface-800"
             style={{ height: 220 }}>
          {GOOGLE_MAPS_KEY ? (
            <div ref={mapRef} className="w-full h-full" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-sm text-slate-500">Map requires VITE_GOOGLE_MAPS_API_KEY</p>
            </div>
          )}
        </div>

        {/* Thermal window */}
        {thermal && (
          <div className="card border-brand-500/20">
            <p className="section-title text-brand-500">Lay-down Window</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-500">Available time</p>
                <p className="text-2xl font-black text-slate-100">
                  {thermal.window_minutes ?? '—'}<span className="text-sm text-slate-400 font-medium"> min</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Air temp</p>
                <p className="text-2xl font-black text-slate-100">
                  {thermal.air_temp_f ?? '—'}<span className="text-sm text-slate-400 font-medium">°F</span>
                </p>
              </div>
            </div>
            {thermal.warning && (
              <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
                <span>⚠</span> {thermal.warning}
              </p>
            )}
          </div>
        )}

        {/* Trucks */}
        {loading ? (
          <div className="space-y-3">
            {[1,2].map(i => <div key={i} className="card h-28 animate-pulse bg-surface-700/50" />)}
          </div>
        ) : trucks.length === 0 ? (
          <div className="card text-center py-10">
            <p className="text-2xl mb-2">🚛</p>
            <p className="font-bold text-slate-300">No trucks tracked</p>
            <p className="text-xs text-slate-500 mt-1">Add trucks in dispatch settings</p>
          </div>
        ) : (
          <>
            {onSite.length > 0 && (
              <section>
                <p className="section-title">On Site</p>
                <div className="space-y-3">{onSite.map(t => <TruckRow key={t.id} truck={t} onLogTemp={handleLogTemp} />)}</div>
              </section>
            )}
            {enRoute.length > 0 && (
              <section>
                <p className="section-title">En Route</p>
                <div className="space-y-3">{enRoute.map(t => <TruckRow key={t.id} truck={t} onLogTemp={handleLogTemp} />)}</div>
              </section>
            )}
            {rest.length > 0 && (
              <section>
                <p className="section-title">Other</p>
                <div className="space-y-3 opacity-70">{rest.map(t => <TruckRow key={t.id} truck={t} onLogTemp={handleLogTemp} />)}</div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

