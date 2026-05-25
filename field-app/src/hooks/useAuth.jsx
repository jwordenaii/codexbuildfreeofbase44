import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { saveSession, clearSession, getToken, getUser, isAuthenticated } from '../lib/auth'
import { login as apiLogin } from '../api/staff'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(() => getUser())
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  useEffect(() => {
    const onExpired = () => {
      clearSession()
      setUser(null)
    }
    window.addEventListener('wf:auth-expired', onExpired)
    return () => window.removeEventListener('wf:auth-expired', onExpired)
  }, [])

  const login = useCallback(async (username, password) => {
    setLoading(true)
    setError(null)
    try {
      const { token, role } = await apiLogin(username, password)
      const userObj = { username, role }
      saveSession(token, userObj)
      setUser(userObj)
      return userObj
    } catch (err) {
      setError(err.message || 'Login failed')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout, setError }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
