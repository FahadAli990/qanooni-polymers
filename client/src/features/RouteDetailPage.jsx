import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api, { getErrorMessage } from '../api/client'
import { useToast } from '../context/ToastContext'

function RouteDetailPage() {
  const { slug } = useParams()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [route, setRoute] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { data } = await api.get(`/routes/${slug}`)
        if (!cancelled) setRoute(data.data)
      } catch (err) {
        if (!cancelled) {
          setRoute(null)
          showToast(getErrorMessage(err), 'error')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [slug, showToast])

  if (loading) {
    return (
      <div className="page-shell">
        <p className="help-muted">Loading route…</p>
      </div>
    )
  }

  if (!route) {
    return (
      <div className="page-shell">
        <p className="help-muted">Route not found.</p>
        <Link to="/routes" className="btn-secondary" style={{ display: 'inline-flex', marginTop: '1rem' }}>
          Back to Routes
        </Link>
      </div>
    )
  }

  return (
    <div className="page-shell page-shell--wide">
      <header className="page-toolbar">
        <div className="detail-heading">
          <div className="detail-title-row">
            <h1>{route.name}</h1>
          </div>
          <Link to="/routes" className="btn-secondary">
            Back to Routes
          </Link>
        </div>
      </header>
    </div>
  )
}

export default RouteDetailPage
