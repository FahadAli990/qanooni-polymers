import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { RawMaterialProvider } from './context/RawMaterialContext'
import { ToastProvider } from './context/ToastContext'
import AppRoutes from './app/routes'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <RawMaterialProvider>
            <div className="app-root">
              <AppRoutes />
            </div>
          </RawMaterialProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
