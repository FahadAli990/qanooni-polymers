import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api, { getErrorMessage } from '../api/client'
import { useConfirm } from '../context/ConfirmContext'
import { useRawMaterials } from '../context/RawMaterialContext'
import { useToast } from '../context/ToastContext'
import { formatDateDisplay, formatNum, todayIso } from '../utils/format'

const KG_PER_BAG = 40

function RawMaterialDetailPage() {
  const { slug } = useParams()
  const { confirm } = useConfirm()
  const { refresh: refreshMaterials } = useRawMaterials()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingPrice, setSavingPrice] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [material, setMaterial] = useState(null)
  const [priceInput, setPriceInput] = useState('')
  const [items, setItems] = useState([])
  const [totals, setTotals] = useState({
    totalBags: 0,
    stockedBags: 0,
    usedBags: 0,
    stockedKg: 0,
    usedKg: 0,
    totalKg: 0,
    kgPerBag: KG_PER_BAG,
  })
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
      setPriceInput(
        payload.material?.pricePerKg != null && Number(payload.material.pricePerKg) > 0
          ? String(payload.material.pricePerKg)
          : '',
      )
      setItems(payload.items || [])
      setTotals(payload.totals || {
        totalBags: 0,
        stockedBags: 0,
        usedBags: 0,
        stockedKg: 0,
        usedKg: 0,
        totalKg: 0,
        kgPerBag: KG_PER_BAG,
      })
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
    setBags(String(Math.round(Number(item.bags))))
    setShowForm(true)
  }

  async function handlePriceSave(e) {
    e.preventDefault()
    const pricePerKg = Number(priceInput)
    if (!Number.isFinite(pricePerKg) || pricePerKg < 0) {
      showToast('Price per kg must be zero or a positive number', 'error')
      return
    }
    setSavingPrice(true)
    try {
      const { data } = await api.put(`/raw-materials/${slug}/price`, { pricePerKg })
      setMaterial(data.data)
      setPriceInput(String(data.data.pricePerKg ?? ''))
      await refreshMaterials()
      showToast('Price updated')
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setSavingPrice(false)
    }
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
    const ok = await confirm({
      title: 'Delete stock',
      message: `Delete stock from ${item.supplier} (${formatNum(item.bags, 0)} bags)?`,
    })
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
          <span className="stock-totals__label">Total Quantity (Available)</span>
          <strong className="stock-totals__value">
            {formatNum(totals.totalBags)} bags
            <span className="stock-totals__sep">·</span>
            {formatNum(totals.totalKg)} kg
          </strong>
          {(totals.usedKg > 0 || totals.stockedKg > 0) && (
            <p className="help-muted" style={{ marginTop: '0.35rem' }}>
              Stocked {formatNum(totals.stockedBags)} bags ({formatNum(totals.stockedKg)} kg)
              {' · '}
              Used {formatNum(totals.usedBags)} bags ({formatNum(totals.usedKg)} kg)
            </p>
          )}
        </div>
      </section>

      <form className="card panel-form panel-form--price" onSubmit={handlePriceSave}>
        <div className="form-grid form-grid--price">
          <div>
            <label htmlFor="material-price">Price per kg (Rs)</label>
            <input
              id="material-price"
              type="number"
              min="0"
              step="0.01"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              placeholder="e.g. 220"
              required
            />
          </div>
          <div className="panel-form__actions panel-form__actions--inline">
            <button type="submit" className="btn-primary" disabled={savingPrice}>
              {savingPrice ? 'Saving…' : 'Save Price'}
            </button>
          </div>
        </div>
        <p className="help-muted" style={{ marginTop: '0.65rem' }}>
          This rate is used when creating Orders for this material.
        </p>
      </form>

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
                min="1"
                step="1"
                value={bags}
                onChange={(e) => setBags(e.target.value)}
                placeholder="e.g. 1, 2, 3, 4"
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
                  <td>{formatDateDisplay(item.date)}</td>
                  <td>{item.supplier}</td>
                  <td>{formatNum(item.bags, 0)}</td>
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
