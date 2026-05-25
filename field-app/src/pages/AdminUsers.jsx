import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { isOwner } from '../lib/auth'

const API = import.meta.env.VITE_API_BASE_URL ?? ''

const ROLES = [
  { value: 'field_crew', label: 'Field Crew' },
  { value: 'operator',   label: 'Operator'   },
  { value: 'foreman',    label: 'Foreman'     },
  { value: 'owner',      label: 'Owner'       },
]

function basicAuth(u, p) {
  return 'Basic ' + btoa(`${u}:${p}`)
}

export default function AdminUsers() {
  const { user } = useAuth()
  const navigate  = useNavigate()

  // Gate: owners only
  useEffect(() => {
    if (user && !isOwner(user)) navigate('/', { replace: true })
  }, [user, navigate])

  // Admin creds (entered once per session, never stored)
  const [adminUser, setAdminUser] = useState('')
  const [adminPass, setAdminPass] = useState('')
  const [authed,    setAuthed]    = useState(false)
  const [authErr,   setAuthErr]   = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  // Users list
  const [users,    setUsers]   = useState([])
  const [loading,  setLoading] = useState(false)

  // New user form
  const [form,     setForm]    = useState({ username: '', password: '', role: 'field_crew' })
  const [creating, setCreating] = useState(false)
  const [createErr, setCreateErr] = useState('')
  const [created,  setCreated]  = useState(null)

  const fetchUsers = useCallback(async (u, p) => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/v1/admin/staff/users`, {
        headers: { Authorization: basicAuth(u, p) },
      })
      if (res.status === 401) { setAuthErr('Wrong admin credentials'); setAuthed(false); return }
      const data = await res.json()
      setUsers(data.users ?? [])
    } catch {
      setAuthErr('Could not reach server')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleAuthSubmit = async e => {
    e.preventDefault()
    setAuthErr('')
    setAuthLoading(true)
    try {
      const res = await fetch(`${API}/api/v1/admin/staff/users`, {
        headers: { Authorization: basicAuth(adminUser, adminPass) },
      })
      if (res.status === 401) { setAuthErr('Wrong admin credentials'); return }
      const data = await res.json()
      setUsers(data.users ?? [])
      setAuthed(true)
    } catch {
      setAuthErr('Could not reach server — check your connection')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleCreate = async e => {
    e.preventDefault()
    if (!form.username.trim() || !form.password.trim()) return
    setCreating(true)
    setCreateErr('')
    setCreated(null)
    try {
      const res = await fetch(`${API}/api/v1/admin/staff/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: basicAuth(adminUser, adminPass),
        },
        body: JSON.stringify({ username: form.username.trim(), password: form.password, role: form.role }),
      })
      const data = await res.json()
      if (!res.ok) { setCreateErr(data.detail ?? 'Error creating user'); return }
      setCreated(data)
      setForm({ username: '', password: '', role: 'field_crew' })
      fetchUsers(adminUser, adminPass)
    } catch {
      setCreateErr('Network error — try again')
    } finally {
      setCreating(false)
    }
  }

  const roleColor = role => {
    if (role === 'owner')   return 'bg-brand-500/20 text-brand-400'
    if (role === 'foreman') return 'bg-blue-500/20 text-blue-400'
    return 'bg-surface-700 text-slate-400'
  }

  // ── Admin credential gate ──────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="animate-fade-in">
        <div className="page-header">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1 text-slate-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-black text-slate-100">Manage Staff</h1>
        </div>

        <div className="px-4 pt-8">
          <div className="card space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-brand-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-slate-100">Admin Access Required</p>
                <p className="text-xs text-slate-500">Enter your Railway admin credentials</p>
              </div>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-3">
              <div>
                <label className="label">Admin Username</label>
                <input
                  className="input-field"
                  value={adminUser}
                  onChange={e => setAdminUser(e.target.value)}
                  placeholder="Admin username"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>
              <div>
                <label className="label">Admin Password</label>
                <input
                  className="input-field"
                  type="password"
                  value={adminPass}
                  onChange={e => setAdminPass(e.target.value)}
                  placeholder="Admin password"
                />
              </div>
              {authErr && (
                <p className="text-sm text-red-400 flex items-center gap-2">
                  <span>⚠</span> {authErr}
                </p>
              )}
              <button type="submit" disabled={authLoading || !adminUser || !adminPass} className="btn-primary w-full">
                {authLoading ? 'Verifying…' : 'Unlock'}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // ── Main admin panel ───────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 text-slate-400">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-black text-slate-100">Manage Staff</h1>
        <span className="ml-auto text-xs text-slate-500">{users.length} account{users.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="px-4 pt-5 space-y-5">

        {/* Add new user */}
        <div className="card space-y-4">
          <p className="section-title">Add Staff Account</p>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="label">Username</label>
              <input
                className="input-field"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                placeholder="e.g. mike_crew"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input-field"
                type="text"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Temporary password"
              />
            </div>
            <div>
              <label className="label">Role</label>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map(r => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, role: r.value }))}
                    className={`py-2.5 px-4 rounded-xl border text-sm font-semibold transition-all
                      ${form.role === r.value
                        ? 'bg-brand-500/20 border-brand-500/50 text-brand-400'
                        : 'bg-surface-800 border-surface-700 text-slate-400'}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {createErr && (
              <p className="text-sm text-red-400 flex items-center gap-2">
                <span>⚠</span> {createErr}
              </p>
            )}
            {created && (
              <div className="rounded-xl bg-green-500/10 border border-green-500/30 px-4 py-3">
                <p className="text-sm font-bold text-green-400">Account created!</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  <span className="font-mono">{created.username}</span> · {created.role}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={creating || !form.username.trim() || !form.password.trim()}
              className="btn-primary w-full"
            >
              {creating ? 'Creating…' : 'Create Account'}
            </button>
          </form>
        </div>

        {/* Existing users */}
        <section>
          <p className="section-title">Current Accounts</p>
          {loading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-14 bg-surface-700/50 rounded-xl animate-pulse" />)}
            </div>
          ) : users.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-slate-500 text-sm">No accounts yet</p>
            </div>
          ) : (
            <div className="card divide-y divide-surface-700">
              {users.map(u => (
                <div key={u.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="w-9 h-9 rounded-xl bg-surface-700 flex items-center justify-center font-black text-slate-300 text-sm flex-shrink-0">
                    {u.username[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-200 text-sm">{u.username}</p>
                    <p className="text-[10px] text-slate-500">
                      {u.is_active ? 'Active' : 'Inactive'} · ID {u.id}
                    </p>
                  </div>
                  <span className={`status-badge ${roleColor(u.role)}`}>
                    {ROLES.find(r => r.value === u.role)?.label ?? u.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
