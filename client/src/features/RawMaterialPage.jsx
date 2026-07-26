import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useRawMaterials } from '../context/RawMaterialContext'
import { useConfirm } from '../context/ConfirmContext'
import { useToast } from '../context/ToastContext'
import { getErrorMessage } from '../api/client'
import { usePermissions } from '../hooks/usePermissions'
import { formatNum } from '../utils/format'

function RawMaterialPage() {
  const navigate = useNavigate()
  const { items, totals, loading, refresh, create, update, remove } = useRawMaterials()
  const { confirm } = useConfirm()
  const { showToast } = useToast()
  const { canEdit, canDelete } = usePermissions()
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
    if (mode === 'edit' && !canEdit) {
      showToast('Managers cannot edit records', 'error')
      return
    }
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
    const ok = await confirm({
      title: 'Delete raw material',
      message: `Delete raw material "${item.name}"? This cannot be undone.`,
    })
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
    <div className="page-shell page-shell--wide">
      <header className="page-toolbar">
        <div>
          <h1>Raw Material</h1>
          <p>Colors / materials and current stock for every item.</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => (mode === 'create' ? closeForm() : openCreate())}
        >
          {mode === 'create' ? 'Cancel' : 'Add New'}
        </button>
      </header>

      <section className="stock-totals card">
        <div>
          <span className="stock-totals__label">Total Material (All Colors)</span>
          <strong className="stock-totals__value">
            {formatNum(totals.totalBags)} bags
            <span className="stock-totals__sep">·</span>
            {formatNum(totals.totalKg)} kg
          </strong>
        </div>
      </section>

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
        <div className="stock-table-wrap card">
          <table className="stock-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>In Stock Now</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link to={`/raw-material/${item.slug}`} className="material-row-link">
                      <span className="material-card__swatch" style={{ backgroundColor: item.swatch }} />
                      <strong>{item.name}</strong>
                    </Link>
                  </td>
                  <td>
                    {formatNum(item.totalBags)} bags
                    <span className="stock-totals__sep">·</span>
                    {formatNum(item.totalKg)} kg
                  </td>
                  <td className="stock-table__actions">
                    {canEdit && (
                      <button type="button" className="btn-secondary btn-compact" onClick={() => openEdit(item)}>
                        Edit
                      </button>
                    )}
                    {canDelete && (
                      <button type="button" className="btn-danger btn-compact" onClick={() => handleDelete(item)}>
                        Delete
                      </button>
                    )}
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

export default RawMaterialPage
