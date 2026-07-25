import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useRawMaterials } from '../context/RawMaterialContext'
import { useToast } from '../context/ToastContext'
import { getErrorMessage } from '../api/client'

function RawMaterialPage() {
  const navigate = useNavigate()
  const { items, loading, create, update, remove } = useRawMaterials()
  const { showToast } = useToast()
  const [mode, setMode] = useState(null)
  const [editingSlug, setEditingSlug] = useState(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

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
    const ok = window.confirm(`Delete raw material "${item.name}"?`)
    if (!ok) return
    try {
      await remove(item.slug)
      showToast(`Deleted ${item.name}`)
      if (editingSlug === item.slug) closeForm()
      if (window.location.pathname === `/raw-material/${item.slug}`) {
        navigate('/raw-material')
      }
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    }
  }

  return (
    <div className="page-shell">
      <header className="page-toolbar">
        <div>
          <h1>Raw Material</h1>
          <p>Add, edit, or delete material colors — saved in database.</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => (mode === 'create' ? closeForm() : openCreate())}
        >
          {mode === 'create' ? 'Cancel' : 'Add New'}
        </button>
      </header>

      {mode && (
        <form className="card panel-form" onSubmit={handleSubmit}>
          <label htmlFor="material-name">
            {mode === 'edit' ? 'Edit Color / Material Name' : 'Color / Material Name'}
          </label>
          <input
            id="material-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Red, Blue, Custom Mix"
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
        <p className="help-muted">Loading materials…</p>
      ) : items.length === 0 ? (
        <p className="help-muted">No raw materials yet. Click Add New to create one.</p>
      ) : (
        <div className="material-grid">
          {items.map((item) => (
            <div key={item.id} className="material-card card">
              <Link to={`/raw-material/${item.slug}`} className="material-card__main">
                <span className="material-card__swatch" style={{ backgroundColor: item.swatch }} />
                <strong>{item.name}</strong>
              </Link>
              <div className="material-card__actions">
                <button type="button" className="btn-secondary btn-compact" onClick={() => openEdit(item)}>
                  Edit
                </button>
                <button type="button" className="btn-danger btn-compact" onClick={() => handleDelete(item)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default RawMaterialPage
