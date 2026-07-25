import { useCallback, useEffect, useMemo, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import { useConfirm } from '../context/ConfirmContext'
import { useRawMaterials } from '../context/RawMaterialContext'
import { useToast } from '../context/ToastContext'
import ColorSelect from '../ui/ColorSelect'
import { formatDateDisplay, formatNum, todayIso } from '../utils/format'

const DEFAULT_SIZES = ['1/2"', '3/4"', '1"']

const KIND_META = {
  roll: {
    title: 'Roll',
    addLabel: 'Add Production',
    empty: 'No roll production yet. Click Add Production.',
    deleteTitle: 'Delete roll',
    entity: 'roll',
  },
  chaat: {
    title: 'Chaat',
    addLabel: 'Add Production',
    empty: 'No chaat production yet. Click Add Production.',
    deleteTitle: 'Delete chaat',
    entity: 'chaat',
  },
  dewaar: {
    title: 'Dewaar',
    addLabel: 'Add Production',
    empty: 'No dewaar production yet. Click Add Production.',
    deleteTitle: 'Delete dewaar',
    entity: 'dewaar',
  },
}

function ProductionPage({ kind }) {
  const meta = KIND_META[kind] || KIND_META.roll
  const { items: materials, refresh: refreshMaterials } = useRawMaterials()
  const { confirm } = useConfirm()
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
      const { data } = await api.get(`/productions/${kind}`)
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
  }, [kind, refreshMaterials, showToast])

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
        const { data } = await api.put(`/productions/${kind}/${editingId}`, body)
        const payload = data.data
        setItems((prev) => prev.map((row) => (row.id === editingId ? payload.item : row)))
        setTotals(payload.totals)
        showToast(`${meta.title} updated`)
      } else {
        const { data } = await api.post(`/productions/${kind}`, body)
        const payload = data.data
        setItems((prev) => [payload.item, ...prev])
        setTotals(payload.totals)
        showToast(`${meta.title} production added`)
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
    const ok = await confirm({
      title: meta.deleteTitle,
      message: `Delete ${item.materialName} ${meta.entity} ${item.size} (${formatNum(item.kg)} kg)? KG will return to raw material.`,
    })
    if (!ok) return
    try {
      const { data } = await api.delete(`/productions/${kind}/${item.id}`)
      setItems((prev) => prev.filter((row) => row.id !== item.id))
      setTotals(data.data.totals)
      if (editingId === item.id) closeForm()
      await refreshMaterials()
      showToast(`${meta.title} deleted — kg returned to raw material`)
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    }
  }

  return (
    <div className="page-shell page-shell--wide">
      <header className="page-toolbar">
        <div className="detail-heading">
          <div className="detail-title-row">
            <h1>{meta.title}</h1>
          </div>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => (showForm && !editingId ? closeForm() : openCreate())}
          disabled={!loading && materials.length === 0}
        >
          {showForm && !editingId ? 'Cancel' : meta.addLabel}
        </button>
      </header>

      <section className="stock-totals card">
        <div>
          <span className="stock-totals__label">Available {meta.title} Production</span>
          <strong className="stock-totals__value">{formatNum(totals.totalKg)} kg</strong>
        </div>
      </section>

      {showForm && (
        <form className="card panel-form panel-form--stock" onSubmit={handleSubmit}>
          <div className="form-grid">
            <div>
              <label htmlFor={`${kind}-date`}>Date</label>
              <input
                id={`${kind}-date`}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor={`${kind}-color`}>Color</label>
              <ColorSelect
                id={`${kind}-color`}
                materials={materials}
                value={materialSlug}
                onChange={setMaterialSlug}
                required
              />
              {availableHint != null && (
                <p className="help-muted" style={{ marginTop: '0.35rem' }}>
                  Available after cut check: {formatNum(availableHint)} kg
                </p>
              )}
            </div>
            <div>
              <label htmlFor={`${kind}-size`}>Size</label>
              <select
                id={`${kind}-size`}
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
              <label htmlFor={`${kind}-kg`}>KG</label>
              <input
                id={`${kind}-kg`}
                type="number"
                min="0.01"
                step="0.01"
                value={kg}
                onChange={(e) => setKg(e.target.value)}
                placeholder="e.g. 18.5"
                required
              />
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
        <p className="help-muted">Loading {meta.title.toLowerCase()} production…</p>
      ) : materials.length === 0 ? (
        <p className="help-muted">Add a raw material color first, then record production.</p>
      ) : (
        <div className="stock-table-wrap card">
          <table className="stock-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Color</th>
                <th>Size</th>
                <th>Remaining KG</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="stock-table__empty">
                    {meta.empty}
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const remaining = Number(item.remainingKg ?? item.kg)
                  const produced = Number(item.kg)
                  const used = item.status === 'used' || remaining <= 0
                  const locked = used || remaining < produced
                  return (
                    <tr key={item.id} className={used ? 'stock-table__row--used' : undefined}>
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
                      <td>
                        {formatNum(remaining)}
                        {remaining < produced ? (
                          <span className="help-muted"> / {formatNum(produced)}</span>
                        ) : null}
                      </td>
                      <td>
                        <span className={`status-pill ${used ? 'status-pill--used' : 'status-pill--available'}`}>
                          {used ? 'Used' : 'Available'}
                        </span>
                      </td>
                      <td className="stock-table__actions">
                        {!locked && (
                          <>
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
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default ProductionPage
