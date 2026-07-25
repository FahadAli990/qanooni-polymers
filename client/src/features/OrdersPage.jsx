import { useCallback, useEffect, useMemo, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import { useConfirm } from '../context/ConfirmContext'
import { useRoutes } from '../context/RouteContext'
import { useToast } from '../context/ToastContext'
import { formatDateDisplay, formatNum, todayIso } from '../utils/format'

const KIND_OPTIONS = [
  { key: 'roll', label: 'Roll' },
  { key: 'chaat', label: 'Chaat' },
  { key: 'dewaar', label: 'Dewaar' },
]

function emptyKinds() {
  return { roll: false, chaat: false, dewaar: false }
}

function newLine() {
  return { key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, materialSlug: '', kg: '' }
}

function kindsLabel(kinds = {}) {
  return KIND_OPTIONS.filter((k) => kinds[k.key]).map((k) => k.label).join(', ') || '—'
}

function formatMoney(value) {
  return `Rs ${formatNum(value)}`
}

function OrdersPage() {
  const { items: routes, refresh: refreshRoutes } = useRoutes()
  const { confirm } = useConfirm()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [orders, setOrders] = useState([])
  const [rates, setRates] = useState([])

  const [date, setDate] = useState(todayIso())
  const [routeSlug, setRouteSlug] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [shops, setShops] = useState([])
  const [shopsLoading, setShopsLoading] = useState(false)
  const [kinds, setKinds] = useState(emptyKinds)
  const [lines, setLines] = useState([newLine()])

  const rateBySlug = useMemo(() => {
    const map = new Map()
    for (const row of rates) map.set(row.slug, row)
    return map
  }, [rates])

  const previewTotal = useMemo(() => {
    return lines.reduce((sum, line) => {
      const material = rateBySlug.get(line.materialSlug)
      const kg = Number(line.kg)
      if (!material || !Number.isFinite(kg) || kg <= 0) return sum
      return sum + kg * Number(material.ratePerKg)
    }, 0)
  }, [lines, rateBySlug])

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      const [ordersRes, ratesRes] = await Promise.all([
        api.get('/orders'),
        api.get('/orders/rates'),
      ])
      setOrders(ordersRes.data.data || [])
      setRates(ratesRes.data.data || [])
    } catch (err) {
      setOrders([])
      showToast(getErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    refreshRoutes()
    loadOrders()
  }, [refreshRoutes, loadOrders])

  useEffect(() => {
    let cancelled = false
    async function loadShops() {
      if (!routeSlug) {
        setShops([])
        setCustomerId('')
        return
      }
      setShopsLoading(true)
      try {
        const { data } = await api.get(`/routes/${routeSlug}/customers`)
        if (cancelled) return
        const list = data.data?.items || []
        setShops(list)
        setCustomerId((prev) => (list.some((s) => String(s.id) === String(prev)) ? prev : ''))
      } catch (err) {
        if (!cancelled) {
          setShops([])
          setCustomerId('')
          showToast(getErrorMessage(err), 'error')
        }
      } finally {
        if (!cancelled) setShopsLoading(false)
      }
    }
    loadShops()
    return () => {
      cancelled = true
    }
  }, [routeSlug, showToast])

  function resetForm() {
    setDate(todayIso())
    setRouteSlug('')
    setCustomerId('')
    setShops([])
    setKinds(emptyKinds())
    setLines([newLine()])
  }

  function closeForm() {
    setShowForm(false)
    resetForm()
  }

  function openCreate() {
    resetForm()
    setShowForm(true)
  }

  function toggleKind(key) {
    setKinds((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function updateLine(key, patch) {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  function addLine() {
    setLines((prev) => [...prev, newLine()])
  }

  function removeLine(key) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((line) => line.key !== key)))
  }

  function validateClient() {
    if (!date) return 'Date is required'
    if (!routeSlug) return 'Route is required'
    if (!customerId) return 'Shop name is required'
    if (!kinds.roll && !kinds.chaat && !kinds.dewaar) {
      return 'Select at least one of Roll, Chaat, or Dewaar'
    }
    const used = new Set()
    let hasValidLine = false
    for (const line of lines) {
      if (!line.materialSlug && !line.kg) continue
      if (!line.materialSlug) return 'Select raw material on each filled line'
      if (used.has(line.materialSlug)) return 'Each raw material can only appear once'
      used.add(line.materialSlug)
      const kg = Number(line.kg)
      if (!Number.isFinite(kg) || kg <= 0) return 'KG must be a positive number'
      hasValidLine = true
    }
    if (!hasValidLine) return 'Add at least one raw material with kg'
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const clientError = validateClient()
    if (clientError) {
      showToast(clientError, 'error')
      return
    }

    const items = lines
      .filter((line) => line.materialSlug)
      .map((line) => ({
        materialSlug: line.materialSlug,
        kg: Number(line.kg),
      }))

    setSaving(true)
    try {
      const { data } = await api.post('/orders', {
        date,
        routeSlug,
        customerId: Number(customerId),
        kinds,
        items,
      })
      setOrders((prev) => [data.data, ...prev])
      showToast('Order added')
      closeForm()
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(order) {
    const ok = await confirm({
      title: 'Delete order',
      message: `Delete order for "${order.shopName}" on ${formatDateDisplay(order.date)}?`,
    })
    if (!ok) return
    try {
      await api.delete(`/orders/${order.id}`)
      setOrders((prev) => prev.filter((row) => row.id !== order.id))
      showToast('Order deleted')
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    }
  }

  return (
    <div className="page-shell page-shell--wide">
      <header className="page-toolbar">
        <div>
          <h1>Orders</h1>
          <p>Create orders by route & shop — bill uses each material&apos;s price per kg.</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => (showForm ? closeForm() : openCreate())}
        >
          {showForm ? 'Cancel' : 'Add New Order'}
        </button>
      </header>

      {showForm && (
        <form className="card panel-form panel-form--stock" onSubmit={handleSubmit} noValidate>
          <div className="form-grid form-grid--order">
            <div>
              <label htmlFor="order-date">Date</label>
              <input
                id="order-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="order-route">Route</label>
              <select
                id="order-route"
                value={routeSlug}
                onChange={(e) => setRouteSlug(e.target.value)}
                required
              >
                <option value="">Select route</option>
                {routes.map((route) => (
                  <option key={route.id} value={route.slug}>
                    {route.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="order-shop">Shop Name</label>
              <select
                id="order-shop"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required
                disabled={!routeSlug || shopsLoading}
              >
                <option value="">
                  {!routeSlug
                    ? 'Select route first'
                    : shopsLoading
                      ? 'Loading shops…'
                      : shops.length
                        ? 'Select shop'
                        : 'No shops on this route'}
                </option>
                {shops.map((shop) => (
                  <option key={shop.id} value={shop.id}>
                    {shop.shopName}
                  </option>
                ))}
              </select>
            </div>
            <div className="order-kinds">
              <span className="order-kinds__label">Product type</span>
              <div className="order-kinds__list" role="group" aria-label="Product type">
                {KIND_OPTIONS.map((opt) => (
                  <label key={opt.key} className="order-check">
                    <input
                      type="checkbox"
                      checked={Boolean(kinds[opt.key])}
                      onChange={() => toggleKind(opt.key)}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="order-lines">
            <div className="order-lines__head">
              <h2>Raw materials & kg</h2>
              <button type="button" className="btn-secondary btn-compact" onClick={addLine}>
                Add material
              </button>
            </div>
            {lines.map((line) => {
              const material = rateBySlug.get(line.materialSlug)
              const kg = Number(line.kg)
              const lineTotal =
                material && Number.isFinite(kg) && kg > 0
                  ? kg * Number(material.ratePerKg)
                  : 0
              return (
                <div key={line.key} className="order-line">
                  <div>
                    <label>Raw material</label>
                    <select
                      value={line.materialSlug}
                      onChange={(e) => updateLine(line.key, { materialSlug: e.target.value })}
                      required
                    >
                      <option value="">Select material</option>
                      {rates.map((m) => (
                        <option key={m.id} value={m.slug}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>KG</label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={line.kg}
                      onChange={(e) => updateLine(line.key, { kg: e.target.value })}
                      placeholder="e.g. 40"
                      required
                    />
                  </div>
                  <div>
                    <label>Rate / kg</label>
                    <input
                      type="text"
                      value={material ? formatMoney(material.ratePerKg) : '—'}
                      readOnly
                    />
                  </div>
                  <div>
                    <label>Line total</label>
                    <input type="text" value={lineTotal ? formatMoney(lineTotal) : '—'} readOnly />
                  </div>
                  <div className="order-line__actions">
                    <button
                      type="button"
                      className="btn-danger btn-compact"
                      onClick={() => removeLine(line.key)}
                      disabled={lines.length <= 1}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )
            })}
            <p className="order-preview-total">
              Estimated bill: <strong>{formatMoney(previewTotal)}</strong>
            </p>
          </div>

          <div className="panel-form__actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Order'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="help-muted">Loading orders…</p>
      ) : (
        <div className="stock-table-wrap card">
          <table className="stock-table stock-table--orders">
            <thead>
              <tr>
                <th>Date</th>
                <th>Route</th>
                <th>Shop Name</th>
                <th>Address</th>
                <th>Phone</th>
                <th>Ordered</th>
                <th>Total Bill</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="stock-table__empty">
                    No orders yet. Click Add New Order to create one.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id}>
                    <td>{formatDateDisplay(order.date)}</td>
                    <td>{order.routeName}</td>
                    <td>{order.shopName}</td>
                    <td className="stock-table__wrap">{order.address}</td>
                    <td>{order.contactNumber}</td>
                    <td className="stock-table__wrap">
                      <div><strong>{kindsLabel(order.kinds)}</strong></div>
                      <div className="help-muted">
                        {(order.items || [])
                          .map((item) => `${item.materialName} ${formatNum(item.kg)} kg`)
                          .join(' · ') || '—'}
                      </div>
                    </td>
                    <td>{formatMoney(order.totalBill)}</td>
                    <td className="stock-table__actions">
                      <button
                        type="button"
                        className="btn-danger btn-compact"
                        onClick={() => handleDelete(order)}
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

export default OrdersPage
