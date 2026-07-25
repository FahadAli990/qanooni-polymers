import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ConfirmProvider } from './context/ConfirmContext'
import { RawMaterialProvider } from './context/RawMaterialContext'
import { ToastProvider } from './context/ToastContext'
import AppRoutes from './app/routes'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <RawMaterialProvider>
              <div className="app-root">
                <AppRoutes />
              </div>
            </RawMaterialProvider>
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
