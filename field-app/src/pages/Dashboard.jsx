import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useGPS } from '../hooks/useGPS'
import { isOwner } from '../lib/auth'
import { getJobs, getWeather } from '../api/jobs'
import { clockIn } from '../api/staff'

const STATUS_CONFIG = {
  scheduled:   { label: 'Scheduled',   dot: 'bg-blue-400',   text: 'text-blue-400'   },
  in_progress: { label: 'In Progress', dot: 'bg-brand-400',  text: 'text-brand-400'  },
  completed:   { label: 'Completed',   dot: 'bg-green-400',  text: 'text-green-400'  },
  hold:        { label: 'On Hold',     dot: 'bg-red-400',    text: 'text-red-400'    },
}

function JobCard({ job, onClick }) {
  const cfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.scheduled
  const time = job.scheduled_time ?? job.start_time

  return (
    <button onClick={() => onClick(job)} className="card-interactive w-full text-left space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-100 truncate text-base leading-snug">
            {job.customer_name ?? job.name ?? 'Job'}
          </p>
          <p className="text-sm text-slate-400 mt-0.5 truncate">
            {job.address ?? job.site_address ?? '—'}
          </p>
        </div>
        <span className={`status-badge flex-shrink-0 ${cfg.text} bg-surface-700`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-500">
        {time && (
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M12 7v5l3 3" />
            </svg>
            {new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        {job.scope && (
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {job.scope}
          </span>
        )}
        {job.crew_size && (
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {job.crew_size} crew
          </span>
        )}
      </div>
    </button>
  )
}

function WeatherChip({ weather }) {
  if (!weather) return null
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-800 rounded-xl border border-surface-700/50">
      <span className="text-lg">{weather.icon ?? '🌤'}</span>
      <div>
        <p className="text-xs font-bold text-slate-200">{weather.temp_f ?? '—'}°F</p>
        <p className="text-[10px] text-slate-500">{weather.condition ?? ''}</p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user, logout } = useAuth()
  const { position } = useGPS()
  const navigate = useNavigate()

  const [jobs, setJobs]         = useState([])
  const [weather, setWeather]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [clocking, setClocking] = useState(false)
  const [clockedIn, setClockedIn] = useState(false)
  const [error, setError]       = useState(null)

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [jobsData] = await Promise.allSettled([getJobs()])
        if (jobsData.status === 'fulfilled') {
          setJobs(Array.isArray(jobsData.value) ? jobsData.value : (jobsData.value?.jobs ?? []))
        }
      } catch (err) {
        setError('Could not load jobs')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (position) {
      getWeather(position.lat, position.lng)
        .then(setWeather)
        .catch(() => {})
    }
  }, [position])

  const handleClockIn = async () => {
    setClocking(true)
    try {
      await clockIn({ lat: position?.lat, lng: position?.lng })
      setClockedIn(true)
    } catch (err) {
      setError('Clock-in failed — will retry when online')
    } finally {
      setClocking(false)
    }
  }

  const activeJobs  = jobs.filter(j => j.status === 'in_progress')
  const todayJobs   = jobs.filter(j => j.status !== 'completed')
  const doneJobs    = jobs.filter(j => j.status === 'completed')

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500 font-medium">{today}</p>
          <h1 className="text-lg font-black text-slate-100 leading-tight">
            {isOwner(user) ? 'Command' : 'My Jobs'}
          </h1>
        </div>
        <WeatherChip weather={weather} />
        <button onClick={logout} className="p-2 text-slate-500 active:text-slate-300">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>

      <div className="px-4 space-y-6 pt-5">

        {/* Clock in / status */}
        {!clockedIn ? (
          <button onClick={handleClockIn} disabled={clocking} className="btn-primary">
            {clocking ? (
              <svg className="w-5 h-5 animate-spin-slow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="9" strokeDasharray="28" strokeDashoffset="10" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M12 7v5l3 3" />
              </svg>
            )}
            Clock In
          </button>
        ) : (
          <div className="flex items-center gap-3 px-5 py-4 bg-green-500/10 border border-green-500/30 rounded-2xl">
            <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
            <div>
              <p className="text-sm font-bold text-green-400">Clocked In</p>
              <p className="text-xs text-slate-500">
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {position && ` · GPS ✓`}
              </p>
            </div>
          </div>
        )}

        {/* Active jobs */}
        {activeJobs.length > 0 && (
          <section>
            <p className="section-title">Active Now</p>
            <div className="space-y-3">
              {activeJobs.map(job => (
                <JobCard key={job.id ?? job.job_id} job={job} onClick={j => navigate(`/job/${j.id ?? j.job_id}`)} />
              ))}
            </div>
          </section>
        )}

        {/* Today's jobs */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="card h-24 animate-pulse bg-surface-700/50" />
            ))}
          </div>
        ) : error ? (
          <div className="card border-red-500/30 text-center py-8">
            <p className="text-red-400 font-medium">{error}</p>
            <p className="text-xs text-slate-500 mt-1">Showing cached data</p>
          </div>
        ) : (
          <>
            {todayJobs.length > 0 && (
              <section>
                <p className="section-title">Today — {todayJobs.length} job{todayJobs.length !== 1 ? 's' : ''}</p>
                <div className="space-y-3">
                  {todayJobs.map(job => (
                    <JobCard key={job.id ?? job.job_id} job={job} onClick={j => navigate(`/job/${j.id ?? j.job_id}`)} />
                  ))}
                </div>
              </section>
            )}

            {doneJobs.length > 0 && (
              <section>
                <p className="section-title">Completed Today — {doneJobs.length}</p>
                <div className="space-y-3 opacity-60">
                  {doneJobs.map(job => (
                    <JobCard key={job.id ?? job.job_id} job={job} onClick={j => navigate(`/job/${j.id ?? j.job_id}`)} />
                  ))}
                </div>
              </section>
            )}

            {jobs.length === 0 && (
              <div className="card text-center py-12 space-y-2">
                <p className="text-3xl">🟧</p>
                <p className="font-bold text-slate-300">No jobs scheduled</p>
                <p className="text-sm text-slate-500">Check back later or contact dispatch</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
