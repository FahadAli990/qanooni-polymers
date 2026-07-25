import { useCallback, useEffect, useMemo, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import { useRawMaterials } from '../context/RawMaterialContext'
import { useToast } from '../context/ToastContext'
import { formatDateDisplay, formatNum, todayIso } from '../utils/format'

const DEFAULT_SIZES = ['1/2"', '3/4"', '1"']

function RollPage() {
  const { items: materials, refresh: refreshMaterials } = useRawMaterials()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [items, setItems] = useState([])
  const [sizes, setSizes] = useState(DEFAULT_SIZES)
  const [totals, setTotals] = useState({ totalKg: 0 })
  const [date, setDate] = useState(todayIso())
  const [materialSlug, setMaterialSlug] = useState('')
  const [size, setSize] = useState(DEFAULT_SIZES[0])
  const [kg, setKg] = useState('')

  const selectedMaterial = useMemo(
    () => materials.find((m) => m.slug === materialSlug) || null,
    [materials, materialSlug],
  )

  const availableHint = useMemo(() => {
    if (!selectedMaterial) return null
    const editing = editingId ? items.find((i) => i.id === editingId) : null
    const credit =
      editing && editing.materialSlug === materialSlug ? Number(editing.kg || 0) : 0
    return Number(selectedMaterial.totalKg || 0) + credit
  }, [selectedMaterial, editingId, items, materialSlug])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/rolls')
      const payload = data.data
      setItems(payload.items || [])
      setSizes(payload.sizes?.length ? payload.sizes : DEFAULT_SIZES)
      setTotals(payload.totals || { totalKg: 0 })
      await refreshMaterials()
    } catch (err) {
      setItems([])
      showToast(getErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [refreshMaterials, showToast])

  useEffect(() => {
    load()
  }, [load])

  function resetForm() {
    setEditingId(null)
    setDate(todayIso())
    setMaterialSlug(materials[0]?.slug || '')
    setSize(DEFAULT_SIZES[0])
    setKg('')
  }

  function closeForm() {
    setShowForm(false)
    resetForm()
  }

  function openCreate() {
    resetForm()
    setMaterialSlug(materials[0]?.slug || '')
    setShowForm(true)
  }

  function openEdit(item) {
    setEditingId(item.id)
    setDate(item.date)
    setMaterialSlug(item.materialSlug)
    setSize(item.size)
    setKg(String(item.kg))
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const body = {
        date,
        materialSlug,
        size,
        kg: Number(kg),
      }
      if (editingId) {
        const { data } = await api.put(`/rolls/${editingId}`, body)
        const payload = data.data
        setItems((prev) => prev.map((row) => (row.id === editingId ? payload.item : row)))
        setTotals(payload.totals)
        showToast('Roll updated')
      } else {
        const { data } = await api.post('/rolls', body)
        const payload = data.data
        setItems((prev) => [payload.item, ...prev])
        setTotals(payload.totals)
        showToast('Roll production added')
      }
      await refreshMaterials()
      closeForm()
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item) {
    const ok = window.confirm(
      `Delete ${item.materialName} roll ${item.size} (${formatNum(item.kg)} kg)?`,
    )
    if (!ok) return
    try {
      const { data } = await api.delete(`/rolls/${item.id}`)
      setItems((prev) => prev.filter((row) => row.id !== item.id))
      setTotals(data.data.totals)
      if (editingId === item.id) closeForm()
      await refreshMaterials()
      showToast('Roll deleted — kg returned to raw material')
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    }
  }

  return (
    <div className="page-shell page-shell--wide">
      <header className="page-toolbar">
        <div className="detail-heading">
          <div className="detail-title-row">
            <h1>Roll</h1>
          </div>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => (showForm && !editingId ? closeForm() : openCreate())}
          disabled={!loading && materials.length === 0}
        >
          {showForm && !editingId ? 'Cancel' : 'Add Production'}
        </button>
      </header>

      <section className="stock-totals card">
        <div>
          <span className="stock-totals__label">Total Roll Production</span>
          <strong className="stock-totals__value">{formatNum(totals.totalKg)} kg</strong>
        </div>
      </section>

      {showForm && (
        <form className="card panel-form panel-form--stock" onSubmit={handleSubmit}>
          <div className="form-grid">
            <div>
              <label htmlFor="roll-date">Date</label>
              <input
                id="roll-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="roll-color">Color</label>
              <select
                id="roll-color"
                value={materialSlug}
                onChange={(e) => setMaterialSlug(e.target.value)}
                required
              >
                <option value="" disabled>
                  Select color
                </option>
                {materials.map((m) => (
                  <option key={m.id} value={m.slug}>
                    {m.name} ({formatNum(m.totalKg)} kg available)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="roll-size">Size</label>
              <select
                id="roll-size"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                required
              >
                {sizes.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="roll-kg">KG</label>
              <input
                id="roll-kg"
                type="number"
                min="0.01"
                step="0.01"
                value={kg}
                onChange={(e) => setKg(e.target.value)}
                placeholder="e.g. 18.5"
                required
              />
              {availableHint != null && (
                <p className="help-muted" style={{ marginTop: '0.35rem' }}>
                  Available after cut check: {formatNum(availableHint)} kg
                </p>
              )}
            </div>
          </div>
          <div className="panel-form__actions">
            <button type="submit" className="btn-primary" disabled={saving || !materialSlug}>
              {saving ? 'Saving…' : editingId ? 'Update Production' : 'Save Production'}
            </button>
            {editingId && (
              <button type="button" className="btn-secondary" onClick={closeForm} disabled={saving}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {loading ? (
        <p className="help-muted">Loading roll production…</p>
      ) : materials.length === 0 ? (
        <p className="help-muted">Add a raw material color first, then record roll production.</p>
      ) : (
        <div className="stock-table-wrap card">
          <table className="stock-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Color</th>
                <th>Size</th>
                <th>KG</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="stock-table__empty">
                    No roll production yet. Click Add Production.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDateDisplay(item.date)}</td>
                    <td>
                      <span className="material-row-link">
                        <span
                          className="material-card__swatch"
                          style={{ backgroundColor: item.materialSwatch }}
                        />
                        <strong>{item.materialName}</strong>
                      </span>
                    </td>
                    <td>{item.size}</td>
                    <td>{formatNum(item.kg)}</td>
                    <td className="stock-table__actions">
                      <button
                        type="button"
                        className="btn-secondary btn-compact"
                        onClick={() => openEdit(item)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-danger btn-compact"
                        onClick={() => handleDelete(item)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default RollPage
