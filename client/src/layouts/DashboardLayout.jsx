import Sidebar from '../ui/Sidebar'
import DueRemindersBanner from '../components/DueRemindersBanner'
import './DashboardLayout.css'

function DashboardLayout({ children }) {
  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="dashboard-layout__main">
        <DueRemindersBanner />
        {children}
      </main>
    </div>
  )
}

export default DashboardLayout
