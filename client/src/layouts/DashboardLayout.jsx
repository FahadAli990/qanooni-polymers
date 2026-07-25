import Sidebar from '../ui/Sidebar'
import './DashboardLayout.css'

function DashboardLayout({ children }) {
  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="dashboard-layout__main">{children}</main>
    </div>
  )
}

export default DashboardLayout
