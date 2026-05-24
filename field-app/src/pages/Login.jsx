import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const { login, loading, error, setError, user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [showPass, setShowPass] = useState(false)

  useEffect(() => { if (user) navigate('/', { replace: true }) }, [user])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.username.trim() || !form.password) return
    try {
      await login(form.username.trim(), form.password)
    } catch {}
  }

  return (
    <div className="min-h-full flex flex-col bg-surface-950">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-20 pb-10">
        <div className="w-full max-w-sm space-y-10 animate-slide-up">

          {/* Logo mark */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-3xl bg-brand-500/10 border border-brand-500/30
                              flex items-center justify-center glow-brand">
                <svg viewBox="0 0 48 48" className="w-11 h-11 fill-brand-400">
                  <path d="M6 38 L10 14 L24 8 L38 14 L42 38 L24 44 Z" opacity=".25" />
                  <path d="M10 38 L13 18 L24 12 L35 18 L38 38 Z" />
                  <rect x="18" y="26" width="12" height="4" rx="1" fill="#0f172a" />
                  <rect x="21" y="22" width="6" height="4" rx="1" fill="#0f172a" />
                </svg>
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-brand-500
                              flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-surface-950" />
              </div>
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-black tracking-tight text-slate-100">
                J. Worden Field
              </h1>
              <p className="text-sm text-slate-500 mt-1 font-medium">
                J. Worden & Sons Paving LLC
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Username</label>
              <input
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={form.username}
                onChange={e => { setError(null); setForm(f => ({ ...f, username: e.target.value })) }}
                className="input-field"
                placeholder="your.name"
              />
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={e => { setError(null); setForm(f => ({ ...f, password: e.target.value })) }}
                  className="input-field pr-12"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400"
                  tabIndex={-1}
                >
                  {showPass
                    ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  }
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30
                              rounded-xl text-red-400 text-sm font-medium animate-slide-down">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary mt-2">
              {loading ? (
                <svg className="w-5 h-5 animate-spin-slow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" d="M12 3a9 9 0 100 18A9 9 0 0012 3z" strokeDasharray="28" strokeDashoffset="10" />
                </svg>
              ) : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-600">
            Need access? Contact your supervisor.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="pb-10 text-center">
        <p className="text-xs text-slate-700 font-medium tracking-wide">
          J. Worden & Sons Paving LLC · Est. 1984
        </p>
      </div>
    </div>
  )
}
