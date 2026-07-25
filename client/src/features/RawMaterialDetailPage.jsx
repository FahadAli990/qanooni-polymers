import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api, { getErrorMessage } from '../api/client'
import { useToast } from '../context/ToastContext'

const KG_PER_BAG = 40

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function formatNum(value) {
  const n = Number(value || 0)
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function RawMaterialDetailPage() {
  const { slug } = useParams()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [material, setMaterial] = useState(null)
  const [items, setItems] = useState([])
  const [totals, setTotals] = useState({ totalBags: 0, totalKg: 0, kgPerBag: KG_PER_BAG })
  const [date, setDate] = useState(todayIso())
  const [supplier, setSupplier] = useState('')
  const [bags, setBags] = useState('')

  const computedKg = useMemo(() => {
    const n = Number(bags)
    if (!Number.isFinite(n) || n <= 0) return 0
    return Number((n * (totals.kgPerBag || KG_PER_BAG)).toFixed(2))
  }, [bags, totals.kgPerBag])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/raw-materials/${slug}/stocks`)
      const payload = data.data
      setMaterial(payload.material)
      setItems(payload.items || [])
      setTotals(payload.totals || { totalBags: 0, totalKg: 0, kgPerBag: KG_PER_BAG })
    } catch (err) {
      setMaterial(null)
      setItems([])
      showToast(getErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [slug, showToast])

  useEffect(() => {
    load()
  }, [load])

  function resetForm() {
    setEditingId(null)
    setDate(todayIso())
    setSupplier('')
    setBags('')
  }

  function closeForm() {
    setShowForm(false)
    resetForm()
  }

  function openCreate() {
    resetForm()
    setShowForm(true)
  }

  function openEdit(item) {
    setEditingId(item.id)
    setDate(item.date)
    setSupplier(item.supplier)
    setBags(String(item.bags))
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const body = {
        date,
        supplier,
        bags: Number(bags),
      }
      if (editingId) {
        const { data } = await api.put(`/raw-materials/${slug}/stocks/${editingId}`, body)
        const payload = data.data
        setItems((prev) => prev.map((row) => (row.id === editingId ? payload.item : row)))
        setTotals(payload.totals)
        showToast('Stock updated')
      } else {
        const { data } = await api.post(`/raw-materials/${slug}/stocks`, body)
        const payload = data.data
        setItems((prev) => [payload.item, ...prev])
        setTotals(payload.totals)
        showToast('Stock added')
      }
      closeForm()
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item) {
    const ok = window.confirm(`Delete stock from ${item.supplier} (${formatNum(item.bags)} bags)?`)
    if (!ok) return
    try {
      const { data } = await api.delete(`/raw-materials/${slug}/stocks/${item.id}`)
      setItems((prev) => prev.filter((row) => row.id !== item.id))
      setTotals(data.data.totals)
      if (editingId === item.id) closeForm()
      showToast('Stock deleted')
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    }
  }

  if (loading) {
    return (
      <div className="page-shell">
        <p className="help-muted">Loading stock…</p>
      </div>
    )
  }

  if (!material) {
    return (
      <div className="page-shell">
        <p className="help-muted">Raw material not found.</p>
        <Link to="/raw-material" className="btn-secondary" style={{ display: 'inline-flex', marginTop: '1rem' }}>
          Back to Raw Material
        </Link>
      </div>
    )
  }

  return (
    <div className="page-shell page-shell--wide">
      <header className="page-toolbar">
        <div className="detail-heading">
          <div className="detail-title-row">
            <span className="material-card__swatch" style={{ backgroundColor: material.swatch }} />
            <h1>{material.name}</h1>
          </div>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => (showForm && !editingId ? closeForm() : openCreate())}
        >
          {showForm && !editingId ? 'Cancel' : 'Add Stock'}
        </button>
      </header>

      <section className="stock-totals card">
        <div>
          <span className="stock-totals__label">Total Quantity</span>
          <strong className="stock-totals__value">
            {formatNum(totals.totalBags)} bags
            <span className="stock-totals__sep">·</span>
            {formatNum(totals.totalKg)} kg
          </strong>
        </div>
      </section>

      {showForm && (
        <form className="card panel-form panel-form--stock" onSubmit={handleSubmit}>
          <div className="form-grid">
            <div>
              <label htmlFor="stock-date">Date</label>
              <input
                id="stock-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="stock-supplier">Supplier</label>
              <input
                id="stock-supplier"
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Supplier name"
                required
                maxLength={160}
              />
            </div>
            <div>
              <label htmlFor="stock-bags">Quantity (Bags)</label>
              <input
                id="stock-bags"
                type="number"
                min="0.01"
                step="0.01"
                value={bags}
                onChange={(e) => setBags(e.target.value)}
                placeholder="e.g. 20"
                required
              />
            </div>
            <div>
              <label htmlFor="stock-kg">KG (auto)</label>
              <input
                id="stock-kg"
                type="text"
                value={computedKg ? `${formatNum(computedKg)} kg` : '—'}
                readOnly
              />
            </div>
          </div>
          <div className="panel-form__actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Update Stock' : 'Save Stock'}
            </button>
            {editingId && (
              <button type="button" className="btn-secondary" onClick={closeForm} disabled={saving}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      <div className="stock-table-wrap card">
        <table className="stock-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Supplier</th>
              <th>Quantity (Bags)</th>
              <th>KG</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="stock-table__empty">
                  No stock yet. Click Add Stock to add the first entry.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td>{item.date}</td>
                  <td>{item.supplier}</td>
                  <td>{formatNum(item.bags)}</td>
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
    </div>
  )
}

export default RawMaterialDetailPage
