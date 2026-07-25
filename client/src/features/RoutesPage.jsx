import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useConfirm } from '../context/ConfirmContext'
import { useRoutes } from '../context/RouteContext'
import { useToast } from '../context/ToastContext'
import { getErrorMessage } from '../api/client'

function RoutesPage() {
  const navigate = useNavigate()
  const { items, loading, refresh, create, update, remove } = useRoutes()
  const { confirm } = useConfirm()
  const { showToast } = useToast()
  const [mode, setMode] = useState(null)
  const [editingSlug, setEditingSlug] = useState(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    refresh()
  }, [refresh])

  function openCreate() {
    setMode('create')
    setEditingSlug(null)
    setName('')
  }

  function openEdit(item) {
    setMode('edit')
    setEditingSlug(item.slug)
    setName(item.name)
  }

  function closeForm() {
    setMode(null)
    setEditingSlug(null)
    setName('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      if (mode === 'edit' && editingSlug) {
        const updated = await update(editingSlug, name)
        showToast(`Updated ${updated.name}`)
        if (editingSlug !== updated.slug && window.location.pathname === `/routes/${editingSlug}`) {
          navigate(`/routes/${updated.slug}`)
        }
      } else {
        const created = await create(name)
        showToast(`Added ${created.name}`)
      }
      closeForm()
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item) {
    const ok = await confirm({
      title: 'Delete route',
      message: `Delete route "${item.name}"? This cannot be undone.`,
    })
    if (!ok) return
    try {
      await remove(item.slug)
      showToast(`Deleted ${item.name}`)
      if (editingSlug === item.slug) closeForm()
      if (window.location.pathname === `/routes/${item.slug}`) {
        navigate('/routes')
      }
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    }
  }

  return (
    <div className="page-shell page-shell--wide">
      <header className="page-toolbar">
        <div>
          <h1>Routes</h1>
          <p>Add routes — each route appears under Routes in the sidebar.</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => (mode === 'create' ? closeForm() : openCreate())}
        >
          {mode === 'create' ? 'Cancel' : 'Add Route'}
        </button>
      </header>

      {mode && (
        <form className="card panel-form" onSubmit={handleSubmit}>
          <label htmlFor="route-name">
            {mode === 'edit' ? 'Edit Route Name' : 'Route Name'}
          </label>
          <input
            id="route-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. City Route, North Zone"
            required
            maxLength={120}
            autoFocus
          />
          <div className="panel-form__actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : mode === 'edit' ? 'Update' : 'Save'}
            </button>
            {mode === 'edit' && (
              <button type="button" className="btn-secondary" onClick={closeForm} disabled={saving}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {loading ? (
        <p className="help-muted">Loading routes…</p>
      ) : items.length === 0 ? (
        <p className="help-muted">No routes yet. Click Add Route to create one.</p>
      ) : (
        <div className="stock-table-wrap card">
          <table className="stock-table">
            <thead>
              <tr>
                <th>Route Name</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link to={`/routes/${item.slug}`} className="material-row-link">
                      <strong>{item.name}</strong>
                    </Link>
                  </td>
                  <td className="stock-table__actions">
                    <button type="button" className="btn-secondary btn-compact" onClick={() => openEdit(item)}>
                      Edit
                    </button>
                    <button type="button" className="btn-danger btn-compact" onClick={() => handleDelete(item)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default RoutesPage
