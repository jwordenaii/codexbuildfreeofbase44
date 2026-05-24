import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { isOwner } from '../lib/auth'
import { myProfile, myCheckins } from '../api/staff'
import { countPending } from '../lib/offline'

function StatCard({ label, value, sub }) {
  return (
    <div className="card text-center space-y-1">
      <p className="text-2xl font-black text-slate-100">{value}</p>
      <p className="text-xs font-bold text-slate-400">{label}</p>
      {sub && <p className="text-[10px] text-slate-600">{sub}</p>}
    </div>
  )
}

export default function Profile() {
  const { user, logout } = useAuth()
  const [profile, setProfile]   = useState(null)
  const [checkins, setCheckins] = useState([])
  const [pending, setPending]   = useState(0)

  useEffect(() => {
    myProfile().then(setProfile).catch(() => {})
    myCheckins().then(data => setCheckins(Array.isArray(data) ? data : (data?.checkins ?? []))).catch(() => {})
    countPending().then(setPending).catch(() => {})
  }, [])

  const owner = isOwner(user)
  const todayCheckins = checkins.filter(c => {
    const d = new Date(c.checked_in_at)
    const now = new Date()
    return d.toDateString() === now.toDateString()
  })

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="text-lg font-black text-slate-100">My Profile</h1>
      </div>

      <div className="px-4 pt-5 space-y-5">

        {/* Avatar + info */}
        <div className="card flex items-center gap-4">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black
                           ${owner ? 'bg-brand-500/20 border-2 border-brand-500/40' : 'bg-surface-700'}`}>
            {user?.username?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-slate-100 text-lg leading-tight">
              {profile?.name ?? user?.username}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`status-badge ${owner ? 'bg-brand-500/20 text-brand-400' : 'bg-surface-700 text-slate-400'}`}>
                {owner ? '★ Owner' : 'Field Crew'}
              </span>
              {profile?.role && (
                <span className="text-xs text-slate-500 capitalize">{profile.role.replace('_', ' ')}</span>
              )}
            </div>
            {profile?.phone && (
              <p className="text-xs text-slate-500 mt-1">{profile.phone}</p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Today" value={todayCheckins.length > 0 ? '✓' : '—'} sub="check-ins" />
          <StatCard label="This Week" value={checkins.length} sub="check-ins" />
          <StatCard
            label="Offline Queue"
            value={pending}
            sub={pending > 0 ? 'pending sync' : 'all synced'}
          />
        </div>

        {/* Recent check-ins */}
        {checkins.length > 0 && (
          <section>
            <p className="section-title">Recent Check-Ins</p>
            <div className="space-y-2">
              {checkins.slice(0, 5).map((c, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 bg-surface-800 rounded-xl border border-surface-700/50">
                  <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-200">
                      {new Date(c.checked_in_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                    {c.note && <p className="text-xs text-slate-500 truncate">{c.note}</p>}
                  </div>
                  <p className="text-xs text-slate-500 flex-shrink-0">
                    {new Date(c.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Sign out */}
        <button onClick={logout} className="btn-danger mt-4">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </button>

        <p className="text-center text-xs text-slate-700 pb-4">
          J. Worden & Sons Paving LLC · Field v1.0
        </p>
      </div>
    </div>
  )
}
