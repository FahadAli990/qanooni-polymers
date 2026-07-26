import { useCallback, useEffect, useMemo, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import { useConfirm } from '../context/ConfirmContext'
import { useRawMaterials } from '../context/RawMaterialContext'
import { useRoutes } from '../context/RouteContext'
import { useToast } from '../context/ToastContext'
import { usePermissions } from '../hooks/usePermissions'
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
    ratePerKg: '',
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
  const { canEdit, canDelete } = usePermissions()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
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

  function sortOrders(list) {
    return [...list].sort((a, b) => {
      if (a.status !== b.status) return a.status === 'pending' ? -1 : 1
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : Number(a.id)
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : Number(b.id)
      if (ta !== tb) return ta - tb
      return Number(a.id) - Number(b.id)
    })
  }

  const previewTotal = useMemo(() => {
    return lines.reduce((sum, line) => {
      const kg = Number(line.kg)
      const rate = Number(line.ratePerKg)
      if (!Number.isFinite(kg) || kg <= 0 || !Number.isFinite(rate) || rate <= 0) return sum
      return sum + kg * rate
    }, 0)
  }, [lines])

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
    setEditingId(null)
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

  function openEdit(order) {
    setEditingId(order.id)
    setDate(order.date)
    setRouteSlug(order.routeSlug || '')
    setCustomerId(order.routeCustomerId ? String(order.routeCustomerId) : '')
    setLines(
      (order.items || []).length
        ? order.items.map((item) => ({
            key: `${item.id}-${Math.random().toString(36).slice(2, 6)}`,
            kind: item.kind || 'roll',
            size: item.size || sizes[0],
            materialSlug: item.materialSlug || '',
            kg: item.kg != null ? String(item.kg) : '',
            ratePerKg: item.ratePerKg != null ? String(item.ratePerKg) : '',
          }))
        : [newLine({ size: sizes[0], kind: kinds[0]?.key })],
    )
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
      const rate = Number(line.ratePerKg)
      if (!Number.isFinite(rate) || rate <= 0) return 'Sell rate / kg must be a positive number'
      hasValidLine = true
    }
    if (!hasValidLine) return 'Add at least one order line with type, size, material, kg and rate'
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const clientError = validateClient()
    if (clientError) {
      showToast(clientError, 'error')
      return
    }
    if (editingId && !canEdit) {
      showToast('Managers cannot edit records', 'error')
      return
    }

    const items = lines
      .filter((line) => line.materialSlug)
      .map((line) => ({
        kind: line.kind,
        size: line.size,
        materialSlug: line.materialSlug,
        kg: Number(line.kg),
        ratePerKg: Number(line.ratePerKg),
      }))

    setSaving(true)
    try {
      if (editingId) {
        const { data } = await api.put(`/orders/${editingId}`, {
          date,
          routeSlug,
          customerId: Number(customerId),
          items,
        })
        setOrders((prev) => sortOrders(prev.map((row) => (row.id === editingId ? data.data : row))))
        showToast(
          data.data.status === 'pending'
            ? 'Order updated (Pending — deliver again if needed)'
            : 'Order updated',
        )
      } else {
        const { data } = await api.post('/orders', {
          date,
          routeSlug,
          customerId: Number(customerId),
          items,
        })
        setOrders((prev) => sortOrders([...prev, data.data]))
        showToast('Order added')
      }
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
      message: `Deliver order for "${order.shopName}"? Matching production will be reduced (FIFO).`,
      confirmLabel: 'Deliver',
      confirmTone: 'primary',
    })
    if (!ok) return
    try {
      const { data } = await api.post(`/orders/${order.id}/deliver`)
      setOrders((prev) => sortOrders(prev.map((row) => (row.id === order.id ? data.data : row))))
      await refreshMaterials()
      showToast('Order delivered — production updated')
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    }
  }

  async function handlePending(order) {
    const ok = await confirm({
      title: 'Move to Pending',
      message: `Move delivered order for "${order.shopName}" back to Pending? Production stock will be restored.`,
      confirmLabel: 'Pending',
      confirmTone: 'primary',
    })
    if (!ok) return
    try {
      const { data } = await api.post(`/orders/${order.id}/pending`)
      setOrders((prev) => sortOrders(prev.map((row) => (row.id === order.id ? data.data : row))))
      await refreshMaterials()
      showToast('Order set to Pending — production restored')
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    }
  }

  async function handleDelete(order) {
    const ok = await confirm({
      title: 'Delete order',
      message:
        order.status === 'delivered'
          ? `Delete delivered order for "${order.shopName}"? Production stock will be restored.`
          : `Delete pending order for "${order.shopName}" on ${formatDateDisplay(order.date)}?`,
    })
    if (!ok) return
    try {
      await api.delete(`/orders/${order.id}`)
      setOrders((prev) => prev.filter((row) => row.id !== order.id))
      if (editingId === order.id) closeForm()
      await refreshMaterials()
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
          onClick={() => (showForm && !editingId ? closeForm() : openCreate())}
        >
          {showForm && !editingId ? 'Cancel' : 'Add New Order'}
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
              const kg = Number(line.kg)
              const rate = Number(line.ratePerKg)
              const lineTotal =
                Number.isFinite(kg) && kg > 0 && Number.isFinite(rate) && rate > 0 ? kg * rate : 0
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
                    <label>Sell Rate / kg (Rs)</label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={line.ratePerKg}
                      onChange={(e) => updateLine(line.key, { ratePerKg: e.target.value })}
                      placeholder="e.g. 220"
                      required
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
              {saving ? 'Saving…' : editingId ? 'Update Order' : 'Save Order'}
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
                      {canEdit &&
                        (order.status === 'pending' ? (
                          <button
                            type="button"
                            className="btn-primary btn-compact"
                            onClick={() => handleDeliver(order)}
                          >
                            Deliver
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-primary btn-compact"
                            onClick={() => handlePending(order)}
                          >
                            Pending
                          </button>
                        ))}
                      {canEdit && (
                        <button
                          type="button"
                          className="btn-secondary btn-compact"
                          onClick={() => openEdit(order)}
                        >
                          Edit
                        </button>
                      )}
                      {canDelete && (
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
