import { useCallback, useEffect, useMemo, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import { useConfirm } from '../context/ConfirmContext'
import { useToast } from '../context/ToastContext'
import { usePermissions } from '../hooks/usePermissions'
import { formatDateDisplay, formatNum, todayIso } from '../utils/format'
import { downloadSupplierLedgerPdf } from '../utils/ledgerPdf'

const CONTACT_RE = /^\d{11}$/

function formatMoney(value) {
  return `Rs ${formatNum(value)}`
}

function payStatusLabel(status) {
  if (status === 'paid') return 'Paid'
  if (status === 'partial') return 'Partial'
  return 'Unpaid'
}

function emptySupplierForm() {
  return { name: '', contact: '' }
}

function SuppliersPage() {
  const { confirm } = useConfirm()
  const { showToast } = useToast()
  const { canEdit, canDelete } = usePermissions()

  const [suppliers, setSuppliers] = useState([])
  const [suppliersLoading, setSuppliersLoading] = useState(true)
  const [supplierId, setSupplierId] = useState('')

  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [editingSupplierId, setEditingSupplierId] = useState(null)
  const [supplierForm, setSupplierForm] = useState(emptySupplierForm())
  const [savingSupplier, setSavingSupplier] = useState(false)

  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [supplier, setSupplier] = useState(null)
  const [summary, setSummary] = useState({
    totalPurchased: 0,
    totalPaid: 0,
    remaining: 0,
    advance: 0,
  })
  const [purchases, setPurchases] = useState([])
  const [payments, setPayments] = useState([])

  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [editingPaymentId, setEditingPaymentId] = useState(null)
  const [paymentDate, setPaymentDate] = useState(todayIso())
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [savingPayment, setSavingPayment] = useState(false)

  const visibleSuppliers = useMemo(
    () =>
      supplierId ? suppliers.filter((s) => String(s.id) === String(supplierId)) : suppliers,
    [suppliers, supplierId],
  )

  const loadSuppliers = useCallback(async () => {
    setSuppliersLoading(true)
    try {
      const { data } = await api.get('/suppliers')
      const list = Array.isArray(data.data) ? data.data : data.data?.items || []
      setSuppliers(list)
      setSupplierId((prev) => (list.some((s) => String(s.id) === String(prev)) ? prev : ''))
    } catch (err) {
      setSuppliers([])
      showToast(getErrorMessage(err), 'error')
    } finally {
      setSuppliersLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    loadSuppliers()
  }, [loadSuppliers])

  const applyLedger = useCallback((payload) => {
    setSupplier(payload.supplier || null)
    setSummary(
      payload.summary || {
        totalPurchased: 0,
        totalPaid: 0,
        remaining: 0,
        advance: 0,
      },
    )
    setPurchases(payload.purchases || [])
    setPayments(payload.payments || [])
  }, [])

  const loadLedger = useCallback(async () => {
    if (!supplierId) {
      setSupplier(null)
      setSummary({ totalPurchased: 0, totalPaid: 0, remaining: 0, advance: 0 })
      setPurchases([])
      setPayments([])
      return
    }
    setLedgerLoading(true)
    try {
      const { data } = await api.get(`/suppliers/${supplierId}/ledger`)
      applyLedger(data.data || {})
    } catch (err) {
      setSupplier(null)
      setPurchases([])
      setPayments([])
      showToast(getErrorMessage(err), 'error')
    } finally {
      setLedgerLoading(false)
    }
  }, [supplierId, applyLedger, showToast])

  useEffect(() => {
    loadLedger()
  }, [loadLedger])

  function resetSupplierForm() {
    setEditingSupplierId(null)
    setSupplierForm(emptySupplierForm())
  }

  function closeSupplierForm() {
    setShowSupplierForm(false)
    resetSupplierForm()
  }

  function openCreateSupplier() {
    resetSupplierForm()
    setShowSupplierForm(true)
  }

  function openEditSupplier(row) {
    setEditingSupplierId(row.id)
    setSupplierForm({ name: row.name, contact: row.contact || '' })
    setShowSupplierForm(true)
  }

  function onContactChange(value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 11)
    setSupplierForm((prev) => ({ ...prev, contact: digits }))
  }

  async function handleSupplierSubmit(e) {
    e.preventDefault()
    const name = supplierForm.name.trim()
    const contact = supplierForm.contact.trim()
    if (!name) {
      showToast('Supplier name is required', 'error')
      return
    }
    if (!CONTACT_RE.test(contact)) {
      showToast('Contact must be exactly 11 digits', 'error')
      return
    }
    if (editingSupplierId && !canEdit) {
      showToast('Managers cannot edit records', 'error')
      return
    }

    setSavingSupplier(true)
    try {
      const body = { name, contact }
      if (editingSupplierId) {
        const { data } = await api.put(`/suppliers/${editingSupplierId}`, body)
        const updated = data.data
        setSuppliers((prev) => prev.map((row) => (row.id === editingSupplierId ? updated : row)))
        if (String(supplierId) === String(editingSupplierId)) {
          setSupplier(updated)
        }
        showToast('Supplier updated')
      } else {
        const { data } = await api.post('/suppliers', body)
        const created = data.data
        setSuppliers((prev) => [...prev, created])
        setSupplierId(String(created.id))
        showToast('Supplier added')
      }
      closeSupplierForm()
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setSavingSupplier(false)
    }
  }

  async function handleDeleteSupplier(row) {
    const ok = await confirm({
      title: 'Delete supplier',
      message: `Delete supplier "${row.name}"?`,
    })
    if (!ok) return
    try {
      await api.delete(`/suppliers/${row.id}`)
      setSuppliers((prev) => prev.filter((s) => s.id !== row.id))
      if (String(supplierId) === String(row.id)) setSupplierId('')
      if (editingSupplierId === row.id) closeSupplierForm()
      showToast('Supplier deleted')
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    }
  }

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
    if (!supplierId) {
      showToast('Select a supplier first', 'error')
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

    setSavingPayment(true)
    try {
      const body = {
        date: paymentDate,
        amount,
        note: paymentNote.trim(),
      }
      if (editingPaymentId) {
        const { data } = await api.put(`/suppliers/${supplierId}/payments/${editingPaymentId}`, body)
        applyLedger(data.data || {})
        showToast('Payment updated')
      } else {
        const { data } = await api.post(`/suppliers/${supplierId}/payments`, body)
        applyLedger(data.data || {})
        showToast('Payment recorded')
      }
      closePaymentForm()
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setSavingPayment(false)
    }
  }

  async function handleDeletePayment(payment) {
    const ok = await confirm({
      title: 'Delete payment',
      message: `Delete payment of ${formatMoney(payment.amount)} on ${formatDateDisplay(payment.date)}?`,
    })
    if (!ok) return
    try {
      const { data } = await api.delete(`/suppliers/${supplierId}/payments/${payment.id}`)
      applyLedger(data.data || {})
      if (editingPaymentId === payment.id) closePaymentForm()
      showToast('Payment deleted')
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    }
  }

  function handlePrintPdf() {
    if (!supplier) {
      showToast('Select a supplier first', 'error')
      return
    }
    try {
      downloadSupplierLedgerPdf({
        supplier,
        summary,
        purchases,
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
          <h1>Suppliers</h1>
          <p>Add suppliers, record purchases via stock, and manage payments / advances.</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() =>
            showSupplierForm && !editingSupplierId ? closeSupplierForm() : openCreateSupplier()
          }
        >
          {showSupplierForm && !editingSupplierId ? 'Cancel' : 'Add Supplier'}
        </button>
      </header>

      {showSupplierForm && (
        <form className="card panel-form panel-form--stock" onSubmit={handleSupplierSubmit} noValidate>
          <div className="form-grid">
            <div>
              <label htmlFor="supplier-name">Name</label>
              <input
                id="supplier-name"
                type="text"
                value={supplierForm.name}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Supplier name"
                required
                maxLength={160}
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="supplier-contact">Contact</label>
              <input
                id="supplier-contact"
                type="text"
                inputMode="numeric"
                value={supplierForm.contact}
                onChange={(e) => onContactChange(e.target.value)}
                placeholder="11-digit number"
                required
                maxLength={11}
              />
            </div>
          </div>
          <div className="panel-form__actions">
            <button type="submit" className="btn-primary" disabled={savingSupplier}>
              {savingSupplier
                ? 'Saving…'
                : editingSupplierId
                  ? 'Update Supplier'
                  : 'Save Supplier'}
            </button>
            {editingSupplierId && (
              <button
                type="button"
                className="btn-secondary"
                onClick={closeSupplierForm}
                disabled={savingSupplier}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      <section className="card panel-form panel-form--stock">
        <div className="form-grid form-grid--order">
          <div>
            <label htmlFor="suppliers-select">Supplier</label>
            <select
              id="suppliers-select"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              disabled={suppliersLoading}
            >
              <option value="">
                {suppliersLoading
                  ? 'Loading suppliers…'
                  : suppliers.length
                    ? 'Select supplier (or click a row)'
                    : 'No suppliers yet — add one'}
              </option>
              {suppliers.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </div>
          {supplierId ? (
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setSupplierId('')}>
                Show all suppliers
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <div className="stock-table-wrap card" style={{ marginBottom: '1.25rem' }}>
        <table className="stock-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {suppliers.length === 0 ? (
              <tr>
                <td colSpan={3} className="stock-table__empty">
                  No suppliers yet. Click Add Supplier.
                </td>
              </tr>
            ) : (
              visibleSuppliers.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setSupplierId(String(row.id))}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{row.name}</td>
                  <td>{row.contact}</td>
                  <td
                    className="stock-table__actions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {canEdit && (
                      <button
                        type="button"
                        className="btn-secondary btn-compact"
                        onClick={() => {
                          setSupplierId(String(row.id))
                          openEditSupplier(row)
                        }}
                      >
                        Edit
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        className="btn-danger btn-compact"
                        onClick={() => handleDeleteSupplier(row)}
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

      {!supplierId ? (
        <p className="help-muted">Select a supplier to open purchase / payment hisab.</p>
      ) : ledgerLoading ? (
        <p className="help-muted">Loading ledger…</p>
      ) : !supplier ? (
        <p className="help-muted">Supplier not found.</p>
      ) : (
        <>
          <section className="card stock-totals stock-totals--split bills-shop-card">
            <div>
              <span className="stock-totals__label">Supplier</span>
              <strong className="stock-totals__value">{supplier.name}</strong>
              <p className="help-muted" style={{ marginTop: '0.35rem' }}>
                Contact: {supplier.contact}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={handlePrintPdf}>
                Print PDF
              </button>
            </div>
          </section>

          <section className="stock-totals card stock-totals--split">
            <div>
              <span className="stock-totals__label">Total Purchased</span>
              <strong className="stock-totals__value">{formatMoney(summary.totalPurchased)}</strong>
            </div>
            <div>
              <span className="stock-totals__label">Total Paid</span>
              <strong className="stock-totals__value">{formatMoney(summary.totalPaid)}</strong>
            </div>
            <div>
              <span className="stock-totals__label">Amount Due</span>
              <strong className="stock-totals__value">{formatMoney(summary.remaining)}</strong>
            </div>
            <div>
              <span className="stock-totals__label">Advance</span>
              <strong className="stock-totals__value">{formatMoney(summary.advance)}</strong>
            </div>
          </section>

          <section className="bills-section">
            <div className="page-toolbar" style={{ marginBottom: '0.75rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Purchases (Raw Material Stock)</h2>
                <p className="help-muted" style={{ margin: '0.25rem 0 0' }}>
                  From Add Stock entries linked to this supplier. Oldest purchases settle first.
                </p>
              </div>
            </div>
            <div className="stock-table-wrap card">
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Material</th>
                    <th>Bags</th>
                    <th>KG</th>
                    <th>Rate / kg</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="stock-table__empty">
                        No purchases yet. Add stock under Raw Material and pick this supplier.
                      </td>
                    </tr>
                  ) : (
                    purchases.map((row) => (
                      <tr key={row.id}>
                        <td>{formatDateDisplay(row.date)}</td>
                        <td>{row.materialName}</td>
                        <td>{formatNum(row.bags, 0)}</td>
                        <td>{formatNum(row.kg)}</td>
                        <td>{formatMoney(row.pricePerKg)}</td>
                        <td>{formatMoney(row.totalAmount)}</td>
                        <td>
                          <span className={`status-pill status-pill--${row.payStatus || 'unpaid'}`}>
                            {payStatusLabel(row.payStatus)}
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
                <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Payments / Advances</h2>
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={() =>
                  showPaymentForm && !editingPaymentId ? closePaymentForm() : openCreatePayment()
                }
              >
                {showPaymentForm && !editingPaymentId ? 'Cancel' : 'Add Payment'}
              </button>
            </div>

            {showPaymentForm && (
              <form className="card panel-form panel-form--stock" onSubmit={handlePaymentSubmit}>
                <div className="form-grid form-grid--order">
                  <div>
                    <label htmlFor="supplier-payment-date">Date</label>
                    <input
                      id="supplier-payment-date"
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="supplier-payment-amount">Amount (Rs)</label>
                    <input
                      id="supplier-payment-amount"
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
                    <label htmlFor="supplier-payment-note">Note (optional)</label>
                    <input
                      id="supplier-payment-note"
                      type="text"
                      value={paymentNote}
                      onChange={(e) => setPaymentNote(e.target.value)}
                      placeholder="e.g. Cash / Advance"
                      maxLength={255}
                    />
                  </div>
                </div>
                <div className="panel-form__actions">
                  <button type="submit" className="btn-primary" disabled={savingPayment}>
                    {savingPayment
                      ? 'Saving…'
                      : editingPaymentId
                        ? 'Update Payment'
                        : 'Save Payment'}
                  </button>
                  {editingPaymentId && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={closePaymentForm}
                      disabled={savingPayment}
                    >
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

export default SuppliersPage
