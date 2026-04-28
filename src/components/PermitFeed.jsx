/**
 * PermitFeed — Live Virginia permit lead table for the Command Center.
 *
 * Polls /api/v1/permits/virginia/vpt (and optionally DEQ) on a configurable
 * interval and renders a sortable lead table.  Each row has a one-click
 * "Create Quote" button that navigates to /quote with pre-filled URL params.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getVptPermits, getDeqPermits } from '../api/permits'
import { api } from '../api/client'

const SCORE_COLORS = {
  HOT: 'bg-red-100 text-red-700 border-red-200',
  WARM: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  COOL: 'bg-blue-100 text-blue-700 border-blue-200',
}

/** Format an ISO date string to a short readable form. */
function fmtDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

/** Single permit row */
function PermitRow({ permit, onCreateQuote }) {
  const score = permit.lead_score || {}
  const colorClass = SCORE_COLORS[score.label] || SCORE_COLORS.COOL

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="py-3 px-4 text-sm text-brand-navy max-w-xs">
        <div className="font-medium truncate">{permit.address || '—'}</div>
        {permit.applicant && (
          <div className="text-xs text-brand-navy/50 truncate">{permit.applicant}</div>
        )}
      </td>
      <td className="py-3 px-4 text-sm text-brand-navy/70 hidden sm:table-cell">
        {permit.permit_type || '—'}
      </td>
      <td className="py-3 px-4 text-sm text-brand-navy/70 hidden md:table-cell">
        {fmtDate(permit.issued_date)}
      </td>
      <td className="py-3 px-4">
        <span
          className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full border ${colorClass}`}
        >
          {score.label || 'COOL'}
        </span>
      </td>
      <td className="py-3 px-4 text-right">
        <button
          type="button"
          onClick={() => onCreateQuote(permit)}
          className="text-xs font-semibold text-brand-amber hover:underline whitespace-nowrap"
        >
          Create Quote →
        </button>
      </td>
    </tr>
  )
}

/**
 * PermitFeed component.
 *
 * Props:
 *   source          'vpt' | 'deq' | 'national' (default: 'vpt')
 *   keyword         Search keyword for VPT/national (default: 'paving')
 *   states          Comma-separated state codes for national feed (default: 'VA,TX,FL,NC,GA,NY,NJ,MI')
 *   limit           Max permits (default: 50)
 *   pollIntervalMs  Auto-refresh interval in ms, 0 to disable (default: 300_000 = 5 min)
 */
export default function PermitFeed({
  source = 'vpt',
  keyword = 'paving',
  states = 'VA,TX,FL,NC,GA,NY,NJ,MI',
  limit = 50,
  pollIntervalMs = 300_000,
}) {
  const [permits, setPermits] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastFetched, setLastFetched] = useState(null)
  const navigate = useNavigate()
  const intervalRef = useRef(null)

  const fetchPermits = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let data
      if (source === 'deq') {
        data = await getDeqPermits(limit)
        setPermits(data.permits || [])
      } else if (source === 'national') {
        data = await api.getNationalPermits(states, keyword, limit)
        setPermits(data.results || [])
      } else {
        data = await getVptPermits(keyword, limit)
        setPermits(data.permits || [])
      }
      setLastFetched(new Date())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [source, keyword, states, limit])

  useEffect(() => {
    fetchPermits()
    if (pollIntervalMs > 0) {
      intervalRef.current = setInterval(fetchPermits, pollIntervalMs)
    }
    return () => clearInterval(intervalRef.current)
  }, [fetchPermits, pollIntervalMs])

  const handleCreateQuote = (permit) => {
    const params = new URLSearchParams({
      address: permit.address || '',
      service_type: 'paving',
      property_type: 'commercial',
    })
    navigate(`/quote?${params}`)
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h3 className="font-display font-bold text-brand-navy text-lg">
            {source === 'deq'
              ? 'DEQ PEEP Permits'
              : source === 'national'
                ? 'National Permit Feed'
                : 'VPT Permit Feed'}
          </h3>
          {loading && (
            <span className="w-4 h-4 border-2 border-brand-amber border-t-transparent rounded-full animate-spin inline-block" />
          )}
          {lastFetched && !loading && (
            <span className="text-xs text-brand-navy/40">
              Updated {lastFetched.toLocaleTimeString()}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={fetchPermits}
          disabled={loading}
          className="text-xs font-semibold text-brand-amber hover:underline disabled:opacity-40"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          <strong>Could not load permits:</strong> {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && permits.length === 0 && (
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-8 text-center text-brand-navy/50 text-sm">
          No permits found. Try a different keyword or check back later.
        </div>
      )}

      {/* Table */}
      {permits.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full text-left">
            <thead className="bg-brand-navy/5 text-xs font-semibold text-brand-navy/60 uppercase tracking-wide">
              <tr>
                <th className="py-3 px-4">Address / Applicant</th>
                <th className="py-3 px-4 hidden sm:table-cell">Permit Type</th>
                <th className="py-3 px-4 hidden md:table-cell">Issued</th>
                <th className="py-3 px-4">Score</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {permits.map((p, i) => (
                <PermitRow
                  key={`${p.source || 'permit'}-${p.permit_id || p.address || i}`}
                  permit={p}
                  onCreateQuote={handleCreateQuote}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {permits.length > 0 && (
        <p className="text-xs text-brand-navy/40 text-right">
          Showing {permits.length} permit{permits.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}
