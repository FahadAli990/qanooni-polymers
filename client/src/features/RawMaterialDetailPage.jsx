import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api, { getErrorMessage } from '../api/client'
import { useConfirm } from '../context/ConfirmContext'
import { useToast } from '../context/ToastContext'
import { usePermissions } from '../hooks/usePermissions'
import { formatDateDisplay, formatNum, todayIso } from '../utils/format'

const KG_PER_BAG = 40

function formatMoney(value) {
  return `Rs ${formatNum(value)}`
}

function RawMaterialDetailPage() {
  const { slug } = useParams()
  const { confirm } = useConfirm()
  const { showToast } = useToast()
  const { canEdit, canDelete } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [isPreviousEntry, setIsPreviousEntry] = useState(false)
  const [material, setMaterial] = useState(null)
  const [items, setItems] = useState([])
  const [totals, setTotals] = useState({
    totalBags: 0,
    stockedBags: 0,
    usedBags: 0,
    stockedKg: 0,
    usedKg: 0,
    totalKg: 0,
    totalPurchaseAmount: 0,
    kgPerBag: KG_PER_BAG,
  })
  const [date, setDate] = useState(todayIso())
  const [supplierId, setSupplierId] = useState('')
  const [suppliers, setSuppliers] = useState([])
  const [suppliersLoading, setSuppliersLoading] = useState(false)
  const [bags, setBags] = useState('')
  const [pricePerKg, setPricePerKg] = useState('')

  const computedKg = useMemo(() => {
    const n = Number(bags)
    if (!Number.isFinite(n) || n <= 0) return 0
    return Number((n * (totals.kgPerBag || KG_PER_BAG)).toFixed(2))
  }, [bags, totals.kgPerBag])

  const computedPurchaseTotal = useMemo(() => {
    if (isPreviousEntry) return 0
    const price = Number(pricePerKg)
    if (!computedKg || !Number.isFinite(price) || price <= 0) return 0
    return Number((computedKg * price).toFixed(2))
  }, [computedKg, pricePerKg, isPreviousEntry])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/raw-materials/${slug}/stocks`)
      const payload = data.data
      setMaterial(payload.material)
      setItems(payload.items || [])
      setTotals(payload.totals || {
        totalBags: 0,
        stockedBags: 0,
        usedBags: 0,
        stockedKg: 0,
        usedKg: 0,
        totalKg: 0,
        totalPurchaseAmount: 0,
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

  useEffect(() => {
    let cancelled = false
    async function loadSuppliers() {
      setSuppliersLoading(true)
      try {
        const { data } = await api.get('/suppliers')
        if (cancelled) return
        const list = Array.isArray(data.data) ? data.data : data.data?.items || []
        setSuppliers(list)
      } catch (err) {
        if (!cancelled) {
          setSuppliers([])
          showToast(getErrorMessage(err), 'error')
        }
      } finally {
        if (!cancelled) setSuppliersLoading(false)
      }
    }
    loadSuppliers()
    return () => {
      cancelled = true
    }
  }, [showToast])

  function resetForm() {
    setEditingId(null)
    setIsPreviousEntry(false)
    setDate(todayIso())
    setSupplierId('')
    setBags('')
    setPricePerKg('')
  }

  function closeForm() {
    setShowForm(false)
    resetForm()
  }

  function openCreate(previous = false) {
    resetForm()
    setIsPreviousEntry(Boolean(previous))
    setShowForm(true)
  }

  function openEdit(item) {
    setEditingId(item.id)
    setIsPreviousEntry(Boolean(item.isPrevious))
    setDate(item.date)
    setSupplierId(item.supplierId != null ? String(item.supplierId) : '')
    setBags(String(Math.round(Number(item.bags))))
    setPricePerKg(item.pricePerKg != null ? String(item.pricePerKg) : '')
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!isPreviousEntry && !supplierId) {
      showToast('Select a supplier', 'error')
      return
    }
    if (!isPreviousEntry) {
      const price = Number(pricePerKg)
      if (!Number.isFinite(price) || price <= 0) {
        showToast('Purchase price per kg is required', 'error')
        return
      }
    }
    if (editingId && !canEdit) {
      showToast('Managers cannot edit records', 'error')
      return
    }

    setSaving(true)
    try {
      const body = isPreviousEntry
        ? {
            date,
            bags: Number(bags),
            previous: true,
          }
        : {
            date,
            supplierId: Number(supplierId),
            bags: Number(bags),
            pricePerKg: Number(pricePerKg),
            previous: false,
          }
      if (editingId) {
        const { data } = await api.put(`/raw-materials/${slug}/stocks/${editingId}`, body)
        const payload = data.data
        setItems((prev) => prev.map((row) => (row.id === editingId ? payload.item : row)))
        setTotals(payload.totals)
        showToast(isPreviousEntry ? 'Previous stock updated' : 'Stock updated')
      } else {
        const { data } = await api.post(`/raw-materials/${slug}/stocks`, body)
        const payload = data.data
        setItems((prev) => [...prev, payload.item])
        setTotals(payload.totals)
        showToast(isPreviousEntry ? 'Previous stock added' : 'Stock added')
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
      message: item.isPrevious
        ? `Delete previous stock (${formatNum(item.bags, 0)} bags)?`
        : `Delete stock from ${item.supplier} (${formatNum(item.bags, 0)} bags)?`,
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
          <p className="help-muted" style={{ margin: '0.35rem 0 0' }}>
            Add supplier purchase stock, or previous stock already in the factory (no supplier needed).
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              showForm && !editingId && isPreviousEntry ? closeForm() : openCreate(true)
            }
          >
            {showForm && !editingId && isPreviousEntry ? 'Cancel' : 'Add Previous Stock'}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() =>
              showForm && !editingId && !isPreviousEntry ? closeForm() : openCreate(false)
            }
          >
            {showForm && !editingId && !isPreviousEntry ? 'Cancel' : 'Add Stock'}
          </button>
        </div>
      </header>

      <section className="stock-totals card stock-totals--split">
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
        <div>
          <span className="stock-totals__label">Total Purchased (All Entries)</span>
          <strong className="stock-totals__value">
            {formatMoney(totals.totalPurchaseAmount || 0)}
          </strong>
        </div>
      </section>

      {showForm && (
        <form className="card panel-form panel-form--stock" onSubmit={handleSubmit}>
          {isPreviousEntry ? (
            <p className="help-muted" style={{ marginTop: 0 }}>
              Previous stock: raw material already in factory. No supplier or purchase price —
              supplier old dues go under Suppliers → Add Previous Balance.
            </p>
          ) : null}
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
            {!isPreviousEntry && (
              <div>
                <label htmlFor="stock-supplier">Supplier</label>
                <select
                  id="stock-supplier"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  required
                  disabled={suppliersLoading}
                >
                  <option value="">
                    {suppliersLoading
                      ? 'Loading suppliers…'
                      : suppliers.length
                        ? 'Select supplier'
                        : 'No suppliers — add in Suppliers'}
                  </option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
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
            {!isPreviousEntry && (
              <>
                <div>
                  <label htmlFor="stock-price">Purchase Amount / kg (Rs)</label>
                  <input
                    id="stock-price"
                    type="number"
                    min="1"
                    step="1"
                    value={pricePerKg}
                    onChange={(e) => setPricePerKg(e.target.value)}
                    placeholder="e.g. 180"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="stock-total">Total amount (auto)</label>
                  <input
                    id="stock-total"
                    type="text"
                    value={computedPurchaseTotal ? formatMoney(computedPurchaseTotal) : '—'}
                    readOnly
                  />
                </div>
              </>
            )}
          </div>
          <div className="panel-form__actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving
                ? 'Saving…'
                : editingId
                  ? 'Update'
                  : isPreviousEntry
                    ? 'Save Previous Stock'
                    : 'Save Stock'}
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
              <th>Supplier / Type</th>
              <th>Bags</th>
              <th>KG</th>
              <th>Purchase Amount / kg</th>
              <th>Total Paid</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="stock-table__empty">
                  No stock yet. Click Add Stock or Add Previous Stock.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td>{formatDateDisplay(item.date)}</td>
                  <td>
                    {item.isPrevious ? (
                      <span className="status-pill status-pill--partial">Previous stock</span>
                    ) : (
                      item.supplier
                    )}
                  </td>
                  <td>{formatNum(item.bags, 0)}</td>
                  <td>{formatNum(item.kg)}</td>
                  <td>{item.isPrevious ? '—' : formatMoney(item.pricePerKg || 0)}</td>
                  <td>{item.isPrevious ? '—' : formatMoney(item.totalAmount || 0)}</td>
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default RawMaterialDetailPage
