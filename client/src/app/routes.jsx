import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'
import LoginPage from '../features/LoginPage'
import EmptyPage from '../features/EmptyPage'
import RawMaterialPage from '../features/RawMaterialPage'
import RawMaterialDetailPage from '../features/RawMaterialDetailPage'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route index element={<EmptyPage />} />
        <Route path="raw-material" element={<RawMaterialPage />} />
        <Route path="raw-material/:slug" element={<RawMaterialDetailPage />} />
        <Route path="mills-production" element={<Navigate to="/mills-production/role" replace />} />
        <Route path="mills-production/role" element={<EmptyPage />} />
        <Route path="mills-production/bundle" element={<EmptyPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default AppRoutes
