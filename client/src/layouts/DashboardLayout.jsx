import { useLocation } from 'react-router-dom'
import Sidebar from '../ui/Sidebar'
import DueRemindersBanner from '../components/DueRemindersBanner'
import './DashboardLayout.css'

function DashboardLayout({ children }) {
  const { pathname } = useLocation()
  const isDashboard = pathname === '/'

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="dashboard-layout__main">
        {isDashboard ? <DueRemindersBanner /> : null}
        {children}
      </main>
    </div>
  )
}

export default DashboardLayout
