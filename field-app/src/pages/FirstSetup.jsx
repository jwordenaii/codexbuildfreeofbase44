import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_API_BASE_URL ?? ''

function basicAuth(u, p) {
  return 'Basic ' + btoa(`${u}:${p}`)
}

export default function FirstSetup() {
  const navigate = useNavigate()
  const [step, setStep]       = useState(1)
  const [adminUser, setAdminUser] = useState('')
  const [adminPass, setAdminPass] = useState('')
  const [username,  setUsername]  = useState('')
  const [password,  setPassword]  = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [done,      setDone]      = useState(false)

  const verifyAdmin = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/v1/admin/staff/users`, {
        headers: { Authorization: basicAuth(adminUser, adminPass) },
      })
      if (res.status === 401) { setError('Wrong admin credentials — check Railway env vars'); return }
      if (!res.ok) { setError('Server error — try again'); return }
      setStep(2)
    } catch {
      setError('Cannot reach server — check VITE_API_BASE_URL')
    } finally {
      setLoading(false)
    }
  }

  const createAccount = async e => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/v1/admin/staff/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: basicAuth(adminUser, adminPass),
        },
        body: JSON.stringify({ username: username.trim(), password, role: 'owner' }),
      })
      const data = await res.json()
      if (res.status === 409) { setError('Username already exists — go to login'); return }
      if (!res.ok) { setError(data.detail ?? 'Error creating account'); return }
      setDone(true)
    } catch {
      setError('Network error — try again')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-surface-950 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-green-500/20 border border-green-500/30 flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-black text-slate-100 mb-2">Account Created</h1>
        <p className="text-slate-400 text-sm mb-8">You can now log in with <span className="font-bold text-slate-200">{username}</span></p>
        <button onClick={() => navigate('/login')} className="btn-primary w-full max-w-xs">
          Go to Login
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col justify-center px-6 py-12">

      {/* Logo */}
      <div className="flex flex-col items-center mb-10">
        <div className="w-16 h-16 rounded-2xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-black text-slate-100">First-Time Setup</h1>
        <p className="text-sm text-slate-500 mt-1">Create your owner account</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8 justify-center">
        {[1, 2].map(s => (
          <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${s === step ? 'w-8 bg-brand-400' : s < step ? 'w-4 bg-brand-600' : 'w-4 bg-surface-700'}`} />
        ))}
      </div>

      {step === 1 && (
        <form onSubmit={verifyAdmin} className="space-y-4">
          <div className="card space-y-1 mb-2">
            <p className="text-xs text-slate-500">Enter your Railway admin credentials to verify you own this backend.</p>
          </div>
          <div>
            <label className="label">Admin Username</label>
            <input className="input-field" value={adminUser} onChange={e => setAdminUser(e.target.value)}
              placeholder="From Railway env: ADMIN_USERNAME" autoCapitalize="none" autoCorrect="off" />
          </div>
          <div>
            <label className="label">Admin Password</label>
            <input className="input-field" type="password" value={adminPass} onChange={e => setAdminPass(e.target.value)}
              placeholder="From Railway env: ADMIN_PASSWORD" />
          </div>
          {error && <p className="text-sm text-red-400 flex items-center gap-2"><span>⚠</span>{error}</p>}
          <button type="submit" disabled={loading || !adminUser || !adminPass} className="btn-primary w-full">
            {loading ? 'Verifying…' : 'Verify & Continue'}
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={createAccount} className="space-y-4">
          <div className="card space-y-1 mb-2">
            <p className="text-xs text-slate-500">Choose your login username and password for the field app.</p>
          </div>
          <div>
            <label className="label">Your Username</label>
            <input className="input-field" value={username} onChange={e => setUsername(e.target.value)}
              placeholder="e.g. Bigdog" autoCapitalize="none" autoCorrect="off" />
          </div>
          <div>
            <label className="label">Your Password</label>
            <input className="input-field" type="text" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Choose a password" />
          </div>
          {error && <p className="text-sm text-red-400 flex items-center gap-2"><span>⚠</span>{error}</p>}
          <button type="submit" disabled={loading || !username.trim() || !password.trim()} className="btn-primary w-full">
            {loading ? 'Creating…' : 'Create Owner Account'}
          </button>
        </form>
      )}
    </div>
  )
}
