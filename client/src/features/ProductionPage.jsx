import { useCallback, useEffect, useMemo, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import { useConfirm } from '../context/ConfirmContext'
import { useRawMaterials } from '../context/RawMaterialContext'
import { useToast } from '../context/ToastContext'
import { usePermissions } from '../hooks/usePermissions'
import ColorSelect from '../ui/ColorSelect'
import { formatDateDisplay, formatNum, todayIso } from '../utils/format'

const DEFAULT_SIZES = ['1/2"', '3/4"', '1"']

const KIND_META = {
  roll: {
    title: 'Roll',
    addLabel: 'Add Production',
    previousLabel: 'Add Previous Stock',
    empty: 'No roll production yet. Click Add Production or Add Previous Stock.',
    deleteTitle: 'Delete roll',
    entity: 'roll',
  },
  chaat: {
    title: 'Chaat',
    addLabel: 'Add Production',
    previousLabel: 'Add Previous Stock',
    empty: 'No chaat production yet. Click Add Production or Add Previous Stock.',
    deleteTitle: 'Delete chaat',
    entity: 'chaat',
  },
  dewaar: {
    title: 'Dewaar',
    addLabel: 'Add Production',
    previousLabel: 'Add Previous Stock',
    empty: 'No dewaar production yet. Click Add Production or Add Previous Stock.',
    deleteTitle: 'Delete dewaar',
    entity: 'dewaar',
  },
}

function ProductionPage({ kind }) {
  const meta = KIND_META[kind] || KIND_META.roll
  const { items: materials, refresh: refreshMaterials } = useRawMaterials()
  const { confirm } = useConfirm()
  const { showToast } = useToast()
  const { canEdit, canDelete } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [isPreviousEntry, setIsPreviousEntry] = useState(false)
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
    if (isPreviousEntry) return null
    if (!selectedMaterial) return null
    const editing = editingId ? items.find((i) => i.id === editingId) : null
    if (editing?.isPrevious) return null
    const credit =
      editing && editing.materialSlug === materialSlug && !editing.isPrevious
        ? Number(editing.kg || 0)
        : 0
    return Number(selectedMaterial.totalKg || 0) + credit
  }, [selectedMaterial, editingId, items, materialSlug, isPreviousEntry])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/productions/${kind}`)
      const payload = data.data
      const list = (payload.items || []).filter((row) => Number(row.remainingKg ?? row.kg) > 0)
      setItems(list)
      setSizes(payload.sizes?.length ? payload.sizes : DEFAULT_SIZES)
      const totalKg = Number(
        list
          .reduce((sum, row) => sum + Number(row.remainingKg ?? row.kg ?? 0), 0)
          .toFixed(2),
      )
      setTotals({ totalKg })
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
    setIsPreviousEntry(false)
    setDate(todayIso())
    setMaterialSlug(materials[0]?.slug || '')
    setSize(DEFAULT_SIZES[0])
    setKg('')
  }

  function closeForm() {
    setShowForm(false)
    resetForm()
  }

  function openCreate(previous = false) {
    resetForm()
    setIsPreviousEntry(Boolean(previous))
    setMaterialSlug(materials[0]?.slug || '')
    setShowForm(true)
  }

  function openEdit(item) {
    setEditingId(item.id)
    setIsPreviousEntry(Boolean(item.isPrevious))
    setDate(item.date)
    setMaterialSlug(item.materialSlug)
    setSize(item.size)
    setKg(String(item.kg))
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (editingId && !canEdit) {
      showToast('Managers cannot edit records', 'error')
      return
    }
    setSaving(true)
    try {
      const body = {
        date,
        materialSlug,
        size,
        kg: Number(kg),
        previous: isPreviousEntry,
      }
      if (editingId) {
        const { data } = await api.put(`/productions/${kind}/${editingId}`, body)
        const payload = data.data
        setItems((prev) =>
          prev
            .map((row) => (row.id === editingId ? payload.item : row))
            .filter((row) => Number(row.remainingKg ?? row.kg) > 0),
        )
        setTotals(payload.totals)
        showToast(`${meta.title} updated`)
      } else {
        const { data } = await api.post(`/productions/${kind}`, body)
        const payload = data.data
        setItems((prev) => [...prev, payload.item])
        setTotals(payload.totals)
        showToast(
          isPreviousEntry
            ? `${meta.title} previous stock added`
            : `${meta.title} production added`,
        )
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
    const remaining = Number(item.remainingKg ?? item.kg)
    const ok = await confirm({
      title: meta.deleteTitle,
      message: item.isPrevious
        ? `Delete previous ${item.materialName} ${meta.entity} ${item.size} (${formatNum(remaining)} kg)? This does not change raw material stock.`
        : `Delete ${item.materialName} ${meta.entity} ${item.size} (${formatNum(remaining)} kg remaining)?`,
    })
    if (!ok) return
    try {
      const { data } = await api.delete(`/productions/${kind}/${item.id}`)
      setItems((prev) => prev.filter((row) => row.id !== item.id))
      setTotals(data.data.totals)
      if (editingId === item.id) closeForm()
      await refreshMaterials()
      showToast(
        item.isPrevious
          ? `${meta.title} previous stock deleted`
          : `${meta.title} deleted — kg returned to raw material`,
      )
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
          <p className="help-muted" style={{ margin: '0.35rem 0 0' }}>
            Add new production (cuts raw stock) or previous stock already made before the software.
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              showForm && !editingId && isPreviousEntry ? closeForm() : openCreate(true)
            }
            disabled={!loading && materials.length === 0}
          >
            {showForm && !editingId && isPreviousEntry ? 'Cancel' : meta.previousLabel}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() =>
              showForm && !editingId && !isPreviousEntry ? closeForm() : openCreate(false)
            }
            disabled={!loading && materials.length === 0}
          >
            {showForm && !editingId && !isPreviousEntry ? 'Cancel' : meta.addLabel}
          </button>
        </div>
      </header>

      <section className="stock-totals card">
        <div>
          <span className="stock-totals__label">Available {meta.title} Production</span>
          <strong className="stock-totals__value">{formatNum(totals.totalKg)} kg</strong>
        </div>
      </section>

      {showForm && (
        <form className="card panel-form panel-form--stock" onSubmit={handleSubmit}>
          {isPreviousEntry ? (
            <p className="help-muted" style={{ marginTop: 0 }}>
              Previous stock: old finished {meta.entity} already made — does not cut raw material.
            </p>
          ) : null}
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
              {saving
                ? 'Saving…'
                : editingId
                  ? 'Update'
                  : isPreviousEntry
                    ? 'Save Previous Stock'
                    : 'Save Production'}
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
                <th>Type</th>
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
                  return (
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
                      <td>
                        {formatNum(remaining)}
                        {remaining < produced ? (
                          <span className="help-muted"> / {formatNum(produced)}</span>
                        ) : null}
                      </td>
                      <td>
                        {item.isPrevious ? (
                          <span className="status-pill status-pill--partial">Previous</span>
                        ) : (
                          <span className="help-muted">New</span>
                        )}
                      </td>
                      <td className="stock-table__actions">
                        {canEdit && (
                          <button
                            type="button"
                            className="btn-secondary btn-compact"
                            onClick={() => openEdit(item)}
                          >
                            Edit
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            className="btn-danger btn-compact"
                            onClick={() => handleDelete(item)}
                          >
                            Delete
                          </button>
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
