import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'
import LoginPage from '../features/LoginPage'
import EmptyPage from '../features/EmptyPage'
import RawMaterialPage from '../features/RawMaterialPage'
import RawMaterialDetailPage from '../features/RawMaterialDetailPage'
import RollPage from '../features/RollPage'
import ChaatPage from '../features/ChaatPage'
import DewaarPage from '../features/DewaarPage'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route index element={<EmptyPage />} />
        <Route path="raw-material" element={<RawMaterialPage />} />
        <Route path="raw-material/:slug" element={<RawMaterialDetailPage />} />
        <Route path="mills-production" element={<Navigate to="/mills-production/roll" replace />} />
        <Route path="mills-production/role" element={<Navigate to="/mills-production/roll" replace />} />
        <Route path="mills-production/roll" element={<RollPage />} />
        <Route path="mills-production/bundle" element={<Navigate to="/mills-production/bundle/chaat" replace />} />
        <Route path="mills-production/bundle/chaat" element={<ChaatPage />} />
        <Route path="mills-production/bundle/dewaar" element={<DewaarPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default AppRoutes
