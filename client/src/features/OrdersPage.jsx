import { useCallback, useEffect, useMemo, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import { useConfirm } from '../context/ConfirmContext'
import { useRawMaterials } from '../context/RawMaterialContext'
import { useRoutes } from '../context/RouteContext'
import { useToast } from '../context/ToastContext'
import { formatDateDisplay, formatNum, todayIso } from '../utils/format'

const DEFAULT_SIZES = ['1/2"', '3/4"', '1"']
const DEFAULT_KINDS = [
  { key: 'roll', label: 'Roll' },
  { key: 'chaat', label: 'Chaat' },
  { key: 'dewaar', label: 'Dewaar' },
]

function newLine(defaults = {}) {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind: defaults.kind || 'roll',
    size: defaults.size || '1/2"',
    materialSlug: '',
    kg: '',
  }
}

function kindLabel(kind, kinds) {
  return kinds.find((k) => k.key === kind)?.label || kind || '—'
}

function formatOrderLine(item, kinds) {
  const type = kindLabel(item.kind, kinds)
  const size = item.size || '—'
  const material = item.materialName || '—'
  return `${type} ${size} · ${material} ${formatNum(item.kg)} kg`
}

function formatMoney(value) {
  return `Rs ${formatNum(value)}`
}

function OrdersPage() {
  const { items: routes, refresh: refreshRoutes } = useRoutes()
  const { refresh: refreshMaterials } = useRawMaterials()
  const { confirm } = useConfirm()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [orders, setOrders] = useState([])
  const [materials, setMaterials] = useState([])
  const [sizes, setSizes] = useState(DEFAULT_SIZES)
  const [kinds, setKinds] = useState(DEFAULT_KINDS)

  const [date, setDate] = useState(todayIso())
  const [routeSlug, setRouteSlug] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [shops, setShops] = useState([])
  const [shopsLoading, setShopsLoading] = useState(false)
  const [lines, setLines] = useState([newLine()])

  const rateBySlug = useMemo(() => {
    const map = new Map()
    for (const row of materials) map.set(row.slug, row)
    return map
  }, [materials])

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
      const meta = ratesRes.data.data || {}
      const list = Array.isArray(meta) ? meta : meta.materials || []
      setMaterials(list)
      setSizes(Array.isArray(meta.sizes) && meta.sizes.length ? meta.sizes : DEFAULT_SIZES)
      setKinds(Array.isArray(meta.kinds) && meta.kinds.length ? meta.kinds : DEFAULT_KINDS)
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
    setLines([newLine({ size: sizes[0], kind: kinds[0]?.key })])
  }

  function closeForm() {
    setShowForm(false)
    resetForm()
  }

  function openCreate() {
    resetForm()
    setShowForm(true)
  }

  function updateLine(key, patch) {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  function addLine() {
    setLines((prev) => [...prev, newLine({ size: sizes[0], kind: kinds[0]?.key })])
  }

  function removeLine(key) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((line) => line.key !== key)))
  }

  function validateClient() {
    if (!date) return 'Date is required'
    if (!routeSlug) return 'Route is required'
    if (!customerId) return 'Shop name is required'

    const used = new Set()
    let hasValidLine = false
    for (const line of lines) {
      const empty = !line.materialSlug && !line.kg
      if (empty) continue
      if (!line.kind) return 'Select product type (Roll / Chaat / Dewaar) on each line'
      if (!line.size) return 'Select size (1/2", 3/4", 1") on each line'
      if (!line.materialSlug) return 'Select raw material on each filled line'
      const lineKey = `${line.kind}|${line.size}|${line.materialSlug}`
      if (used.has(lineKey)) {
        return 'Duplicate line: same type, size and material cannot repeat'
      }
      used.add(lineKey)
      const kg = Number(line.kg)
      if (!Number.isFinite(kg) || kg <= 0) return 'KG must be a positive number'
      hasValidLine = true
    }
    if (!hasValidLine) return 'Add at least one order line with type, size, material and kg'
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
        kind: line.kind,
        size: line.size,
        materialSlug: line.materialSlug,
        kg: Number(line.kg),
      }))

    setSaving(true)
    try {
      const { data } = await api.post('/orders', {
        date,
        routeSlug,
        customerId: Number(customerId),
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

  async function handleDeliver(order) {
    const ok = await confirm({
      title: 'Mark delivered',
      message: `Deliver order for "${order.shopName}"? Stock will be reduced and this cannot be undone.`,
    })
    if (!ok) return
    try {
      const { data } = await api.post(`/orders/${order.id}/deliver`)
      setOrders((prev) => {
        const next = prev.map((row) => (row.id === order.id ? data.data : row))
        return [...next].sort((a, b) => {
          if (a.status !== b.status) return a.status === 'pending' ? -1 : 1
          return String(b.date).localeCompare(String(a.date))
        })
      })
      await refreshMaterials()
      showToast('Order delivered — stock updated')
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    }
  }

  async function handleDelete(order) {
    if (order.status === 'delivered') {
      showToast('Delivered orders cannot be deleted', 'error')
      return
    }
    const ok = await confirm({
      title: 'Delete order',
      message: `Delete pending order for "${order.shopName}" on ${formatDateDisplay(order.date)}?`,
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
          <p>Each line: product type + inch size + material + kg. Stock cuts on Deliver.</p>
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
          </div>

          <div className="order-lines">
            <div className="order-lines__head">
              <h2>Order lines</h2>
              <button type="button" className="btn-secondary btn-compact" onClick={addLine}>
                Add line
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
                <div key={line.key} className="order-line order-line--full">
                  <div>
                    <label>Type</label>
                    <select
                      value={line.kind}
                      onChange={(e) => updateLine(line.key, { kind: e.target.value })}
                      required
                    >
                      {kinds.map((k) => (
                        <option key={k.key} value={k.key}>
                          {k.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Size</label>
                    <select
                      value={line.size}
                      onChange={(e) => updateLine(line.key, { size: e.target.value })}
                      required
                    >
                      {sizes.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Raw material</label>
                    <select
                      value={line.materialSlug}
                      onChange={(e) => updateLine(line.key, { materialSlug: e.target.value })}
                      required
                    >
                      <option value="">Select material</option>
                      {materials.map((m) => (
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
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="stock-table__empty">
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
                      {(order.items || []).length === 0 ? (
                        '—'
                      ) : (
                        <ul className="order-items-list">
                          {(order.items || []).map((item) => (
                            <li key={item.id}>{formatOrderLine(item, kinds)}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td>{formatMoney(order.totalBill)}</td>
                    <td>
                      <span
                        className={`status-pill status-pill--${order.status === 'delivered' ? 'delivered' : 'pending'}`}
                      >
                        {order.status === 'delivered' ? 'Delivered' : 'Pending'}
                      </span>
                    </td>
                    <td className="stock-table__actions">
                      {order.status !== 'delivered' && (
                        <button
                          type="button"
                          className="btn-primary btn-compact"
                          onClick={() => handleDeliver(order)}
                        >
                          Deliver
                        </button>
                      )}
                      {order.status !== 'delivered' && (
                        <button
                          type="button"
                          className="btn-danger btn-compact"
                          onClick={() => handleDelete(order)}
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
      )}
    </div>
  )
}

export default OrdersPage
