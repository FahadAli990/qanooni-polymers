import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import DashboardLayout from '../layouts/DashboardLayout'

function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (!loading && !user) return <Navigate to="/login" replace />

  return (
    <DashboardLayout>
      {loading ? (
        <div className="page-shell app-page-loading">
          <div className="app-page-loading__inner">
            <span className="app-page-loading__spinner" aria-hidden />
            <p>Loading your workspace…</p>
          </div>
        </div>
      ) : (
        <Outlet />
      )}
    </DashboardLayout>
  )
}

export default ProtectedRoute
