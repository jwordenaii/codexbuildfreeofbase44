/**
 * RichmondGrid — Leaflet map with leaflet-draw polygon tool.
 *
 * Features:
 *  - Satellite + street tile layer switcher
 *  - 20-mile service radius circle centered on Richmond, VA
 *  - Draw polygons over satellite imagery (measures area + perimeter)
 *  - Display existing ProjectSite markers with status colour coding
 *  - Display PermitLead markers (HOT/WARM/COOL colour coded)
 *  - "Save Polygon" action posts GeoJSON to POST /api/v1/geo/sites
 */

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw'
import 'leaflet-draw/dist/leaflet.draw.css'

// Fix default marker icon paths broken by Vite/webpack bundling
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
})

const RICHMOND = [37.5407, -77.436]
const SERVICE_RADIUS_MILES = 20
const SERVICE_RADIUS_METERS = SERVICE_RADIUS_MILES * 1_609.34

// Status colour map for site markers
const STATUS_COLORS = {
  active: '#22c55e',
  completed: '#6366f1',
  pending: '#f59e0b',
}

// Priority colour map for permit lead markers
const LABEL_COLORS = {
  HOT: '#ef4444',
  WARM: '#f59e0b',
  COOL: '#3b82f6',
}

// Haversine area approximation for small polygons (sq feet)
function polygonAreaSqft(latlngs) {
  const R = 20_902_231 // Earth radius in feet
  let area = 0
  const pts = latlngs[0]
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const lat1 = (pts[i].lat * Math.PI) / 180
    const lat2 = (pts[j].lat * Math.PI) / 180
    const lng1 = (pts[i].lng * Math.PI) / 180
    const lng2 = (pts[j].lng * Math.PI) / 180
    area += lng2 * Math.sin(lat1) - lng1 * Math.sin(lat2)
  }
  return Math.abs((area * R * R) / 2)
}

// Perimeter in feet
function polygonPerimeterFt(latlngs) {
  const pts = latlngs[0]
  let perim = 0
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length
    perim += pts[i].distanceTo(pts[j]) * 3.28084
  }
  return perim
}

export default function RichmondGrid({ sites = [], permitLeads = [], onPolygonSaved }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const [drawing, setDrawing] = useState(null) // { area_sqft, perimeter_ft, geojson }
  const [saving, setSaving] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveMsg, setSaveMsg] = useState(null)

  useEffect(() => {
    if (mapInstanceRef.current) return // Already initialised
    if (!mapRef.current) return
    if (mapRef.current._leaflet_id) {
      delete mapRef.current._leaflet_id
    }

    const map = L.map(mapRef.current, {
      center: RICHMOND,
      zoom: 11,
      zoomControl: true,
    })

    // ── Tile layers ──────────────────────────────────────────────────────────
    const streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    })
    const satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Tiles © Esri — Source: Esri, USGS', maxZoom: 19 }
    )

    satellite.addTo(map)

    L.control
      .layers({ Satellite: satellite, 'Street Map': streets }, {}, { position: 'topright' })
      .addTo(map)

    // ── Service radius ────────────────────────────────────────────────────────
    L.circle(RICHMOND, {
      radius: SERVICE_RADIUS_METERS,
      color: '#f5a623',
      weight: 2,
      fillColor: '#f5a623',
      fillOpacity: 0.06,
    })
      .bindPopup(`<b>20-Mile Service Area</b><br>Richmond, VA HQ`)
      .addTo(map)

    // HQ marker
    L.marker(RICHMOND).bindPopup('<b>J. Worden &amp; Sons HQ</b><br>Chester, VA').addTo(map)

    // ── Site markers ─────────────────────────────────────────────────────────
    sites.forEach((site) => {
      if (!site.lat || !site.lng) return
      const color = STATUS_COLORS[site.status] || '#6b7280'
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      })
      L.marker([site.lat, site.lng], { icon })
        .bindPopup(
          `<b>${site.name}</b><br>` +
            `${site.address || ''}<br>` +
            `Status: <b>${site.status}</b><br>` +
            (site.area_sqft ? `Area: <b>${site.area_sqft.toLocaleString()} sqft</b>` : '')
        )
        .addTo(map)
    })

    // ── Permit lead markers ───────────────────────────────────────────────────
    permitLeads.forEach((lead) => {
      if (!lead.lat || !lead.lng) return
      const color = LABEL_COLORS[lead.priority_label] || '#9ca3af'
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:${color};width:10px;height:10px;border-radius:3px;border:1px solid #fff;opacity:0.85"></div>`,
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      })
      L.marker([lead.lat, lead.lng], { icon })
        .bindPopup(
          `<b>${lead.permit_type}</b><br>` +
            `${lead.address}<br>` +
            `Priority: <b>${lead.priority_label}</b><br>` +
            (lead.distance_miles != null ? `Distance: <b>${lead.distance_miles} mi</b>` : '')
        )
        .addTo(map)
    })

    // ── Leaflet Draw ──────────────────────────────────────────────────────────
    const drawnItems = new L.FeatureGroup()
    map.addLayer(drawnItems)

    if (L.Control.Draw) {
      const drawControl = new L.Control.Draw({
        edit: { featureGroup: drawnItems, remove: true },
        draw: {
          polygon: {
            allowIntersection: false,
            showArea: true,
            shapeOptions: { color: '#f5a623', weight: 2 },
          },
          rectangle: {
            shapeOptions: { color: '#f5a623', weight: 2 },
          },
          // Disable tools we don't need
          polyline: false,
          circle: false,
          circlemarker: false,
          marker: false,
        },
      })
      map.addControl(drawControl)
    }

    map.on(L.Draw.Event.CREATED, (e) => {
      drawnItems.clearLayers()
      drawnItems.addLayer(e.layer)
      const latlngs = e.layer.getLatLngs()
      const area = polygonAreaSqft(latlngs)
      const perim = polygonPerimeterFt(latlngs)
      const geojson = JSON.stringify(e.layer.toGeoJSON())
      setDrawing({ area_sqft: Math.round(area), perimeter_ft: Math.round(perim), geojson })
    })

    map.on(L.Draw.Event.DELETED, () => setDrawing(null))

    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSavePolygon = async () => {
    if (!drawing || !saveName.trim()) return
    setSaving(true)
    setSaveMsg(null)
    try {
      const BASE = import.meta.env.VITE_API_BASE_URL || ''
      const res = await fetch(`${BASE}/api/v1/geo/sites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: saveName.trim(),
          geometry_json: drawing.geojson,
          area_sqft: drawing.area_sqft,
          perimeter_ft: drawing.perimeter_ft,
          lat: RICHMOND[0],
          lng: RICHMOND[1],
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const site = await res.json()
      setSaveMsg({ type: 'success', text: `Site "${site.name}" saved!` })
      setSaveName('')
      setDrawing(null)
      onPolygonSaved?.(site)
    } catch (err) {
      setSaveMsg({ type: 'error', text: `Save failed: ${err.message}` })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Map container */}
      <div
        ref={mapRef}
        className="w-full rounded-xl overflow-hidden border border-white/10"
        style={{ height: '520px' }}
      />

      {/* Draw measurement panel */}
      {drawing && (
        <div className="bg-brand-navy/80 border border-brand-amber/30 rounded-xl p-4 space-y-3">
          <h3 className="text-brand-amber font-bold text-sm uppercase tracking-wide">
            📐 Polygon Measurement
          </h3>
          <div className="grid grid-cols-3 gap-4 text-white/80 text-sm">
            <div>
              <div className="text-xs text-white/40 mb-0.5">Area</div>
              <div className="font-bold text-white">{drawing.area_sqft.toLocaleString()} sqft</div>
              <div className="text-xs text-white/40">
                {(drawing.area_sqft / 43_560).toFixed(3)} acres
              </div>
            </div>
            <div>
              <div className="text-xs text-white/40 mb-0.5">Perimeter</div>
              <div className="font-bold text-white">{drawing.perimeter_ft.toLocaleString()} ft</div>
            </div>
            <div>
              <div className="text-xs text-white/40 mb-0.5">Est. Material</div>
              <div className="font-bold text-white">
                {Math.ceil((drawing.area_sqft * 0.08) / 2000).toLocaleString()} tons
              </div>
              <div className="text-xs text-white/40">@ 2&quot; HMA</div>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Site name (e.g. Broad Street Lot)"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              className="flex-1 bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-brand-amber/50"
            />
            <button
              onClick={handleSavePolygon}
              disabled={saving || !saveName.trim()}
              className="bg-brand-amber text-brand-navy font-bold px-4 py-2 rounded-lg text-sm disabled:opacity-40 hover:bg-brand-amber/80 transition-colors"
            >
              {saving ? 'Saving…' : 'Save Site'}
            </button>
          </div>

          {saveMsg && (
            <p
              className={`text-xs ${saveMsg.type === 'success' ? 'text-green-400' : 'text-red-400'}`}
            >
              {saveMsg.text}
            </p>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-white/60">
        <span className="font-semibold text-white/40 uppercase tracking-wide">Legend:</span>
        {Object.entries(STATUS_COLORS).map(([s, c]) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: c }} />
            {s}
          </span>
        ))}
        <span className="font-semibold text-white/40 uppercase tracking-wide ml-2">Leads:</span>
        {Object.entries(LABEL_COLORS).map(([l, c]) => (
          <span key={l} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: c }} />
            {l}
          </span>
        ))}
      </div>
    </div>
  )
}
