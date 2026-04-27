/**
 * TruckTracker — real-time fleet monitoring panel.
 *
 * Displays live truck positions polled from GET /api/v1/geo/trucks.
 * Optionally connects to the WebSocket /ws/dashboard for push updates.
 *
 * Status colour coding:
 *   en_route   — amber (moving to site)
 *   on_site    — green (actively paving)
 *   idle       — gray (waiting)
 */

import { useState, useEffect, useCallback } from 'react'

const STATUS_STYLES = {
  en_route: { dot: 'bg-brand-amber', label: 'En Route', text: 'text-brand-amber' },
  on_site:  { dot: 'bg-green-400',   label: 'On Site',  text: 'text-green-400' },
  idle:     { dot: 'bg-white/30',    label: 'Idle',     text: 'text-white/50' },
}

function TruckCard({ truck }) {
  const style = STATUS_STYLES[truck.status] || STATUS_STYLES.idle
  const tempWarning = truck.asphalt_temp_f != null && truck.asphalt_temp_f < 275

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-white/20 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-bold text-white text-sm">{truck.truck_id}</div>
          {truck.driver_name && (
            <div className="text-white/50 text-xs">{truck.driver_name}</div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot} ${truck.status === 'on_site' ? 'animate-pulse' : ''}`} />
          <span className={`text-xs font-medium ${style.text}`}>{style.label}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-2 text-xs">
        {truck.lat != null && (
          <div>
            <div className="text-white/30">Position</div>
            <div className="text-white/70 font-mono">{truck.lat.toFixed(4)}, {truck.lng.toFixed(4)}</div>
          </div>
        )}
        {truck.speed_mph != null && (
          <div>
            <div className="text-white/30">Speed</div>
            <div className="text-white/70">{truck.speed_mph.toFixed(0)} mph</div>
          </div>
        )}
        {truck.asphalt_temp_f != null && (
          <div>
            <div className="text-white/30">HMA Temp</div>
            <div className={`font-bold ${tempWarning ? 'text-red-400' : 'text-green-400'}`}>
              {truck.asphalt_temp_f.toFixed(0)}°F
              {tempWarning && ' ⚠️'}
            </div>
          </div>
        )}
        {truck.updated_at && (
          <div>
            <div className="text-white/30">Last ping</div>
            <div className="text-white/50">
              {new Date(truck.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TruckTracker() {
  const [trucks, setTrucks] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [wsConnected, setWsConnected] = useState(false)

  const fetchTrucks = useCallback(async () => {
    try {
      const BASE = import.meta.env.VITE_API_BASE_URL || ''
      const res = await fetch(`${BASE}/api/v1/geo/trucks`, {
        signal: AbortSignal.timeout(8_000),
      })
      const data = await res.json()
      setTrucks(Array.isArray(data) ? data : [])
      setLastUpdate(new Date())
    } catch {
      // Silent — keep showing stale data
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch + 30-second polling fallback
  useEffect(() => {
    fetchTrucks()
    const interval = setInterval(fetchTrucks, 30_000)
    return () => clearInterval(interval)
  }, [fetchTrucks])

  // WebSocket real-time updates
  useEffect(() => {
    const BASE = import.meta.env.VITE_API_BASE_URL || window.location.origin
    const wsUrl = BASE.replace(/^https?/, (m) => (m === 'https' ? 'wss' : 'ws')) + '/ws/dashboard'

    let ws
    let reconnectTimer
    let mounted = true

    const connect = () => {
      if (!mounted) return
      try {
        ws = new WebSocket(wsUrl)

        ws.onopen = () => {
          setWsConnected(true)
        }

        ws.onmessage = (event) => {
          try {
            const frame = JSON.parse(event.data)
            if (frame.type === 'dashboard_update' && frame.data?.trucks) {
              setTrucks(frame.data.trucks)
              setLastUpdate(new Date())
            }
          } catch {
            // Ignore parse errors
          }
        }

        ws.onclose = () => {
          setWsConnected(false)
          if (mounted) {
            reconnectTimer = setTimeout(connect, 5_000)
          }
        }

        ws.onerror = () => {
          ws.close()
        }
      } catch {
        // WebSocket not available (e.g. Netlify static deploy) — polling handles it
      }
    }

    connect()

    return () => {
      mounted = false
      clearTimeout(reconnectTimer)
      ws?.close()
    }
  }, [])

  const enRoute = trucks.filter((t) => t.status === 'en_route').length
  const onSite   = trucks.filter((t) => t.status === 'on_site').length
  const idle     = trucks.filter((t) => !['en_route', 'on_site'].includes(t.status)).length

  return (
    <div className="flex flex-col gap-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <h3 className="text-white font-bold text-sm uppercase tracking-wide">🚛 Live Fleet ({trucks.length})</h3>
        <div className="flex items-center gap-3 text-xs text-white/40">
          {wsConnected ? (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Live
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
              Polling
            </span>
          )}
          {lastUpdate && (
            <span>Updated {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          )}
          <button onClick={fetchTrucks} className="hover:text-white transition-colors">↻</button>
        </div>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'En Route', count: enRoute, color: 'text-brand-amber' },
          { label: 'On Site',  count: onSite,  color: 'text-green-400' },
          { label: 'Idle',     count: idle,    color: 'text-white/50' },
        ].map(({ label, count, color }) => (
          <div key={label} className="bg-white/5 rounded-xl p-3 text-center border border-white/10">
            <div className={`font-black text-2xl font-display ${color}`}>{count}</div>
            <div className="text-white/40 text-xs mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Temperature alert */}
      {trucks.some((t) => t.asphalt_temp_f != null && t.asphalt_temp_f < 275) && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 flex items-center gap-2">
          <span>⚠️</span>
          <p className="text-red-400 text-sm">
            HMA temperature below 275°F on one or more trucks — risk of premature cooling.
          </p>
        </div>
      )}

      {/* Truck cards */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-white/30">Loading fleet data…</div>
      ) : trucks.length === 0 ? (
        <div className="text-center py-8 text-white/30 text-sm">
          No trucks online. Ping a truck via POST /api/v1/geo/trucks/{'{truck_id}'}.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {trucks.map((truck) => (
            <TruckCard key={truck.truck_id} truck={truck} />
          ))}
        </div>
      )}
    </div>
  )
}
