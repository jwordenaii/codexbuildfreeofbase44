import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import AppShell from './components/AppShell'
import Login      from './pages/Login'
import Dashboard  from './pages/Dashboard'
import JobDetail  from './pages/JobDetail'
import PhotoScan  from './pages/PhotoScan'
import TruckMap   from './pages/TruckMap'
import Completion from './pages/Completion'
import Profile    from './pages/Profile'

function RequireAuth({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/*" element={
        <RequireAuth>
          <AppShell>
            <Routes>
              <Route index            element={<Dashboard />} />
              <Route path="job/:jobId"     element={<JobDetail />} />
              <Route path="complete/:jobId" element={<Completion />} />
              <Route path="scan"           element={<PhotoScan />} />
              <Route path="trucks"         element={<TruckMap />} />
              <Route path="profile"        element={<Profile />} />
              <Route path="*"              element={<Navigate to="/" replace />} />
            </Routes>
          </AppShell>
        </RequireAuth>
      } />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
