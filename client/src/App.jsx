import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ConfirmProvider } from './context/ConfirmContext'
import { RawMaterialProvider } from './context/RawMaterialContext'
import { RouteProvider } from './context/RouteContext'
import { ToastProvider } from './context/ToastContext'
import AppRoutes from './app/routes'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <RawMaterialProvider>
              <RouteProvider>
                <div className="app-root">
                  <AppRoutes />
                </div>
              </RouteProvider>
            </RawMaterialProvider>
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
