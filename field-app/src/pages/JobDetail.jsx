import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getJobs } from '../api/jobs'
import { useGPS } from '../hooks/useGPS'

function ActionButton({ icon, label, onClick, variant = 'default' }) {
  const variants = {
    default:  'bg-surface-800 border-surface-700/50 text-slate-200 active:bg-surface-700',
    primary:  'bg-brand-500/15 border-brand-500/40 text-brand-400  active:bg-brand-500/25',
    success:  'bg-green-500/15 border-green-500/40 text-green-400  active:bg-green-500/25',
    danger:   'bg-red-500/15   border-red-500/40   text-red-400    active:bg-red-500/25',
  }
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full px-4 py-4 rounded-2xl border transition-all duration-150 active:scale-[0.98] ${variants[variant]}`}
    >
      <span className="text-xl flex-shrink-0">{icon}</span>
      <span className="text-sm font-bold">{label}</span>
      <svg className="w-4 h-4 ml-auto opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}

export default function JobDetail() {
  const { jobId } = useParams()
  const navigate  = useNavigate()
  const { position } = useGPS()

  const [job, setJob]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getJobs()
      .then(data => {
        const jobs = Array.isArray(data) ? data : (data?.jobs ?? [])
        const found = jobs.find(j => String(j.id ?? j.job_id) === String(jobId))
        setJob(found ?? null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [jobId])

  const openDirections = () => {
    const addr = job?.address ?? job?.site_address
    if (!addr) return
    const from = position ? `${position.lat},${position.lng}` : ''
    const url  = `https://www.google.com/maps/dir/${encodeURIComponent(from)}/${encodeURIComponent(addr)}`
    window.open(url, '_blank', 'noopener')
  }

  const callCustomer = () => {
    if (job?.customer_phone) window.location.href = `tel:${job.customer_phone}`
  }

  if (loading) return (
    <div className="p-4 space-y-4">
      <div className="h-8 bg-surface-700/50 rounded-xl animate-pulse" />
      <div className="h-32 bg-surface-700/50 rounded-2xl animate-pulse" />
      <div className="h-48 bg-surface-700/50 rounded-2xl animate-pulse" />
    </div>
  )

  if (!job) return (
    <div className="flex flex-col items-center justify-center min-h-full px-6 py-20 text-center">
      <p className="text-4xl mb-4">🔍</p>
      <p className="font-bold text-slate-300">Job not found</p>
      <button onClick={() => navigate('/')} className="btn-secondary mt-6">Back to Jobs</button>
    </div>
  )

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 text-slate-400">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-black text-slate-100 truncate">
            {job.customer_name ?? job.name ?? 'Job'}
          </h1>
          <p className="text-xs text-slate-500 truncate">{job.address ?? job.site_address}</p>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4">

        {/* Quick info */}
        <div className="card space-y-3">
          {job.scope && (
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Scope</p>
              <p className="text-sm text-slate-200 leading-relaxed">{job.scope}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-surface-700">
            {job.square_footage && (
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Area</p>
                <p className="text-sm font-bold text-slate-200">{job.square_footage.toLocaleString()} sqft</p>
              </div>
            )}
            {job.mix_type && (
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Mix</p>
                <p className="text-sm font-bold text-slate-200">{job.mix_type}</p>
              </div>
            )}
            {job.crew_size && (
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Crew</p>
                <p className="text-sm font-bold text-slate-200">{job.crew_size} workers</p>
              </div>
            )}
            {job.scheduled_time && (
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Start</p>
                <p className="text-sm font-bold text-slate-200">
                  {new Date(job.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            )}
          </div>
          {job.notes && (
            <div className="pt-2 border-t border-surface-700">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-slate-300 leading-relaxed">{job.notes}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <ActionButton icon="🗺️" label="Get Directions"  onClick={openDirections}                     variant="primary"  />
          {job.customer_phone && (
            <ActionButton icon="📞" label="Call Customer"  onClick={callCustomer}                       variant="default"  />
          )}
          <ActionButton icon="📸" label="Photo Scan"      onClick={() => navigate('/scan')}            variant="default"  />
          <ActionButton icon="🚛" label="View Fleet"      onClick={() => navigate('/trucks')}          variant="default"  />
          <ActionButton icon="✅" label="Complete Job"    onClick={() => navigate(`/complete/${jobId}`)} variant="success" />
        </div>

        {/* Materials list */}
        {job.materials?.length > 0 && (
          <section>
            <p className="section-title">Materials</p>
            <div className="card divide-y divide-surface-700">
              {job.materials.map((m, i) => (
                <div key={i} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <span className="text-sm text-slate-300">{m.name}</span>
                  <span className="text-sm font-bold text-slate-200">{m.qty} {m.unit}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
