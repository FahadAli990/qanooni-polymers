import { useCallback, useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import { useConfirm } from '../context/ConfirmContext'
import { useRoutes } from '../context/RouteContext'
import { useToast } from '../context/ToastContext'
import { usePermissions } from '../hooks/usePermissions'
import { formatDateDisplay, formatNum, todayIso } from '../utils/format'
import { downloadCustomerLedgerPdf } from '../utils/ledgerPdf'

function formatMoney(value) {
  return `Rs ${formatNum(value)}`
}

function payStatusLabel(status) {
  if (status === 'paid') return 'Paid'
  if (status === 'partial') return 'Partial'
  return 'Unpaid'
}

function BillsPaymentsPage() {
  const { items: routes, refresh: refreshRoutes, loading: routesLoading } = useRoutes()
  const { confirm } = useConfirm()
  const { showToast } = useToast()
  const { canEdit, canDelete } = usePermissions()

  const [routeSlug, setRouteSlug] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [shops, setShops] = useState([])
  const [shopsLoading, setShopsLoading] = useState(false)

  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [shop, setShop] = useState(null)
  const [routeInfo, setRouteInfo] = useState(null)
  const [summary, setSummary] = useState({ totalBilled: 0, totalPaid: 0, remaining: 0 })
  const [bills, setBills] = useState([])
  const [payments, setPayments] = useState([])

  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [editingPaymentId, setEditingPaymentId] = useState(null)
  const [paymentDate, setPaymentDate] = useState(todayIso())
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    refreshRoutes()
  }, [refreshRoutes])

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

  const applyLedger = useCallback((payload) => {
    setRouteInfo(payload.route || null)
    setShop(payload.shop || null)
    setSummary(payload.summary || { totalBilled: 0, totalPaid: 0, remaining: 0 })
    setBills(payload.bills || [])
    setPayments(payload.payments || [])
  }, [])

  const loadLedger = useCallback(async () => {
    if (!routeSlug || !customerId) {
      setShop(null)
      setRouteInfo(null)
      setSummary({ totalBilled: 0, totalPaid: 0, remaining: 0 })
      setBills([])
      setPayments([])
      return
    }
    setLedgerLoading(true)
    try {
      const { data } = await api.get('/bills/shop', {
        params: { routeSlug, customerId },
      })
      applyLedger(data.data || {})
    } catch (err) {
      setShop(null)
      setBills([])
      setPayments([])
      showToast(getErrorMessage(err), 'error')
    } finally {
      setLedgerLoading(false)
    }
  }, [routeSlug, customerId, applyLedger, showToast])

  useEffect(() => {
    loadLedger()
  }, [loadLedger])

  function resetPaymentForm() {
    setEditingPaymentId(null)
    setPaymentDate(todayIso())
    setPaymentAmount('')
    setPaymentNote('')
  }

  function closePaymentForm() {
    setShowPaymentForm(false)
    resetPaymentForm()
  }

  function openCreatePayment() {
    resetPaymentForm()
    setShowPaymentForm(true)
  }

  function openEditPayment(payment) {
    setEditingPaymentId(payment.id)
    setPaymentDate(payment.date)
    setPaymentAmount(String(payment.amount))
    setPaymentNote(payment.note || '')
    setShowPaymentForm(true)
  }

  async function handlePaymentSubmit(e) {
    e.preventDefault()
    if (!routeSlug || !customerId) {
      showToast('Select route and shop first', 'error')
      return
    }
    const amount = Number(paymentAmount)
    if (!paymentDate) {
      showToast('Date is required', 'error')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('Amount must be a positive number', 'error')
      return
    }
    if (editingPaymentId && !canEdit) {
      showToast('Managers cannot edit records', 'error')
      return
    }

    setSaving(true)
    try {
      const body = {
        routeSlug,
        customerId: Number(customerId),
        date: paymentDate,
        amount,
        note: paymentNote.trim(),
      }
      if (editingPaymentId) {
        const { data } = await api.put(`/bills/payments/${editingPaymentId}`, body)
        applyLedger(data.data || {})
        showToast('Payment updated')
      } else {
        const { data } = await api.post('/bills/payments', body)
        applyLedger(data.data || {})
        showToast('Payment recorded')
      }
      closePaymentForm()
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeletePayment(payment) {
    const ok = await confirm({
      title: 'Delete payment',
      message: `Delete payment of ${formatMoney(payment.amount)} on ${formatDateDisplay(payment.date)}?`,
    })
    if (!ok) return
    try {
      const { data } = await api.delete(`/bills/payments/${payment.id}`, {
        params: { routeSlug, customerId },
      })
      applyLedger(data.data || {})
      if (editingPaymentId === payment.id) closePaymentForm()
      showToast('Payment deleted')
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    }
  }

  function handlePrintPdf() {
    if (!shop) {
      showToast('Select a shop first', 'error')
      return
    }
    try {
      downloadCustomerLedgerPdf({
        routeName: routeInfo?.name,
        shop,
        summary,
        bills,
        payments,
      })
      showToast('PDF downloaded')
    } catch (err) {
      showToast(getErrorMessage(err) || 'Could not create PDF', 'error')
    }
  }

  return (
    <div className="page-shell page-shell--wide">
      <header className="page-toolbar">
        <div>
          <h1>Bills & Payments</h1>
          <p>Select route and shop to view delivered bills, payments, and remaining balance.</p>
        </div>
      </header>

      <section className="card panel-form panel-form--stock">
        <div className="form-grid form-grid--order">
          <div>
            <label htmlFor="bills-route">Route</label>
            <select
              id="bills-route"
              value={routeSlug}
              onChange={(e) => setRouteSlug(e.target.value)}
              disabled={routesLoading}
            >
              <option value="">{routesLoading ? 'Loading routes…' : 'Select route'}</option>
              {routes.map((route) => (
                <option key={route.id} value={route.slug}>
                  {route.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="bills-shop">Shop</label>
            <select
              id="bills-shop"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
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
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shopName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {!routeSlug || !customerId ? (
        <p className="help-muted">Choose a route and shop to open the customer ledger.</p>
      ) : ledgerLoading ? (
        <p className="help-muted">Loading ledger…</p>
      ) : !shop ? (
        <p className="help-muted">Shop not found.</p>
      ) : (
        <>
          <section className="card stock-totals stock-totals--split bills-shop-card">
            <div>
              <span className="stock-totals__label">Shop</span>
              <strong className="stock-totals__value">{shop.shopName}</strong>
              <p className="help-muted" style={{ marginTop: '0.35rem' }}>
                {routeInfo?.name ? `${routeInfo.name} · ` : ''}
                {shop.ownerName} · {shop.contactNumber}
              </p>
              <p className="help-muted">{shop.address}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={handlePrintPdf}>
                Print PDF
              </button>
            </div>
          </section>

          <section className="stock-totals card stock-totals--split">
            <div>
              <span className="stock-totals__label">Total Billed</span>
              <strong className="stock-totals__value">{formatMoney(summary.totalBilled)}</strong>
            </div>
            <div>
              <span className="stock-totals__label">Total Paid</span>
              <strong className="stock-totals__value">{formatMoney(summary.totalPaid)}</strong>
            </div>
            <div>
              <span className="stock-totals__label">Remaining</span>
              <strong className="stock-totals__value">{formatMoney(summary.remaining)}</strong>
            </div>
          </section>

          <section className="bills-section">
            <div className="page-toolbar" style={{ marginBottom: '0.75rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Bills (Delivered Orders)</h2>
                <p className="help-muted" style={{ margin: '0.25rem 0 0' }}>
                  Oldest bills settle first when payments are recorded.
                </p>
              </div>
            </div>
            <div className="stock-table-wrap card">
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Ordered</th>
                    <th>Bill</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="stock-table__empty">
                        No delivered orders for this shop yet.
                      </td>
                    </tr>
                  ) : (
                    bills.map((bill) => (
                      <tr key={bill.id}>
                        <td>{formatDateDisplay(bill.date)}</td>
                        <td className="stock-table__wrap">
                          {(bill.lines || []).length === 0 ? (
                            '—'
                          ) : (
                            <ul className="order-items-list">
                              {(bill.lines || []).map((line, idx) => (
                                <li key={`${bill.id}-${idx}`}>{line}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td>{formatMoney(bill.amount)}</td>
                        <td>
                          <span className={`status-pill status-pill--${bill.payStatus || 'unpaid'}`}>
                            {payStatusLabel(bill.payStatus)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bills-section" style={{ marginTop: '1.5rem' }}>
            <div className="page-toolbar" style={{ marginBottom: '0.75rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Payments</h2>
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={() => (showPaymentForm && !editingPaymentId ? closePaymentForm() : openCreatePayment())}
              >
                {showPaymentForm && !editingPaymentId ? 'Cancel' : 'Add Payment'}
              </button>
            </div>

            {showPaymentForm && (
              <form className="card panel-form panel-form--stock" onSubmit={handlePaymentSubmit}>
                <div className="form-grid form-grid--order">
                  <div>
                    <label htmlFor="payment-date">Date</label>
                    <input
                      id="payment-date"
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="payment-amount">Amount (Rs)</label>
                    <input
                      id="payment-amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="e.g. 5000"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="payment-note">Note (optional)</label>
                    <input
                      id="payment-note"
                      type="text"
                      value={paymentNote}
                      onChange={(e) => setPaymentNote(e.target.value)}
                      placeholder="e.g. Cash / JazzCash"
                      maxLength={255}
                    />
                  </div>
                </div>
                <div className="panel-form__actions">
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? 'Saving…' : editingPaymentId ? 'Update Payment' : 'Save Payment'}
                  </button>
                  {editingPaymentId && (
                    <button type="button" className="btn-secondary" onClick={closePaymentForm} disabled={saving}>
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
                    <th>Amount</th>
                    <th>Note</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="stock-table__empty">
                        No payments recorded yet.
                      </td>
                    </tr>
                  ) : (
                    payments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{formatDateDisplay(payment.date)}</td>
                        <td>{formatMoney(payment.amount)}</td>
                        <td className="stock-table__wrap">{payment.note || '—'}</td>
                        <td className="stock-table__actions">
                          {canEdit && (
                            <button
                              type="button"
                              className="btn-secondary btn-compact"
                              onClick={() => openEditPayment(payment)}
                            >
                              Edit
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              className="btn-danger btn-compact"
                              onClick={() => handleDeletePayment(payment)}
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
          </section>
        </>
      )}
    </div>
  )
}

export default BillsPaymentsPage
