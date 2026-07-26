import { useCallback, useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import { useConfirm } from '../context/ConfirmContext'
import { useToast } from '../context/ToastContext'
import { formatDateDisplay, formatNum, todayIso } from '../utils/format'

function formatMoney(value) {
  return `Rs ${formatNum(value)}`
}

function currentMonth() {
  return todayIso().slice(0, 7)
}

function payStatusLabel(status) {
  if (status === 'paid') return 'Paid'
  if (status === 'partial') return 'Partial'
  return 'Unpaid'
}

function emptyVehicleForm() {
  return { name: '', monthlyRent: '', note: '' }
}

function RentsPage() {
  const { confirm } = useConfirm()
  const { showToast } = useToast()

  const [vehicles, setVehicles] = useState([])
  const [vehiclesLoading, setVehiclesLoading] = useState(true)
  const [vehicleId, setVehicleId] = useState('')
  const [month, setMonth] = useState(currentMonth())

  const [showVehicleForm, setShowVehicleForm] = useState(false)
  const [editingVehicleId, setEditingVehicleId] = useState(null)
  const [vehicleForm, setVehicleForm] = useState(emptyVehicleForm())
  const [savingVehicle, setSavingVehicle] = useState(false)

  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [vehicle, setVehicle] = useState(null)
  const [summary, setSummary] = useState({
    due: 0,
    paid: 0,
    remaining: 0,
    advance: 0,
    payStatus: 'unpaid',
  })
  const [payments, setPayments] = useState([])

  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [editingPaymentId, setEditingPaymentId] = useState(null)
  const [paymentDate, setPaymentDate] = useState(todayIso())
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [savingPayment, setSavingPayment] = useState(false)

  const loadVehicles = useCallback(async () => {
    setVehiclesLoading(true)
    try {
      const { data } = await api.get('/rents')
      const list = Array.isArray(data.data) ? data.data : []
      setVehicles(list)
      setVehicleId((prev) => (list.some((v) => String(v.id) === String(prev)) ? prev : ''))
    } catch (err) {
      setVehicles([])
      showToast(getErrorMessage(err), 'error')
    } finally {
      setVehiclesLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    loadVehicles()
  }, [loadVehicles])

  const applyLedger = useCallback((payload) => {
    setVehicle(payload.vehicle || null)
    setSummary(
      payload.summary || { due: 0, paid: 0, remaining: 0, advance: 0, payStatus: 'unpaid' },
    )
    setPayments(payload.payments || [])
    if (payload.month) setMonth(payload.month)
  }, [])

  const loadLedger = useCallback(async () => {
    if (!vehicleId) {
      setVehicle(null)
      setSummary({ due: 0, paid: 0, remaining: 0, advance: 0, payStatus: 'unpaid' })
      setPayments([])
      return
    }
    setLedgerLoading(true)
    try {
      const { data } = await api.get(`/rents/${vehicleId}/ledger`, { params: { month } })
      applyLedger(data.data || {})
    } catch (err) {
      setVehicle(null)
      setPayments([])
      showToast(getErrorMessage(err), 'error')
    } finally {
      setLedgerLoading(false)
    }
  }, [vehicleId, month, applyLedger, showToast])

  useEffect(() => {
    loadLedger()
  }, [loadLedger])

  function resetVehicleForm() {
    setEditingVehicleId(null)
    setVehicleForm(emptyVehicleForm())
  }

  function closeVehicleForm() {
    setShowVehicleForm(false)
    resetVehicleForm()
  }

  function openCreateVehicle() {
    resetVehicleForm()
    setShowVehicleForm(true)
  }

  function openEditVehicle(row) {
    setEditingVehicleId(row.id)
    setVehicleForm({
      name: row.name,
      monthlyRent: String(row.monthlyRent),
      note: row.note || '',
    })
    setShowVehicleForm(true)
  }

  async function handleVehicleSubmit(e) {
    e.preventDefault()
    const name = vehicleForm.name.trim()
    const monthlyRent = Number(vehicleForm.monthlyRent)
    if (!name) {
      showToast('Vehicle name is required', 'error')
      return
    }
    if (!Number.isFinite(monthlyRent) || monthlyRent <= 0) {
      showToast('Monthly rent must be a positive number', 'error')
      return
    }
    setSavingVehicle(true)
    try {
      const body = { name, monthlyRent, note: vehicleForm.note.trim() }
      if (editingVehicleId) {
        const { data } = await api.put(`/rents/${editingVehicleId}`, body)
        const updated = data.data
        setVehicles((prev) => prev.map((row) => (row.id === editingVehicleId ? updated : row)))
        if (String(vehicleId) === String(editingVehicleId)) {
          setVehicle(updated)
          loadLedger()
        }
        showToast('Vehicle updated')
      } else {
        const { data } = await api.post('/rents', body)
        const created = data.data
        setVehicles((prev) => [...prev, created])
        setVehicleId(String(created.id))
        showToast('Vehicle added')
      }
      closeVehicleForm()
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setSavingVehicle(false)
    }
  }

  async function handleDeleteVehicle(row) {
    const ok = await confirm({
      title: 'Delete vehicle',
      message: `Delete vehicle "${row.name}"?`,
    })
    if (!ok) return
    try {
      await api.delete(`/rents/${row.id}`)
      setVehicles((prev) => prev.filter((v) => v.id !== row.id))
      if (String(vehicleId) === String(row.id)) setVehicleId('')
      if (editingVehicleId === row.id) closeVehicleForm()
      showToast('Vehicle deleted')
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
    if (!vehicleId) {
      showToast('Select a vehicle first', 'error')
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
    setSavingPayment(true)
    try {
      const body = {
        date: paymentDate,
        forMonth: month,
        amount,
        note: paymentNote.trim(),
      }
      if (editingPaymentId) {
        const { data } = await api.put(`/rents/${vehicleId}/payments/${editingPaymentId}`, body)
        applyLedger(data.data || {})
        showToast('Payment updated')
      } else {
        const { data } = await api.post(`/rents/${vehicleId}/payments`, body)
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
      const { data } = await api.delete(`/rents/${vehicleId}/payments/${payment.id}`, {
        params: { month },
      })
      applyLedger(data.data || {})
      if (editingPaymentId === payment.id) closePaymentForm()
      showToast('Payment deleted')
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    }
  }

  return (
    <div className="page-shell page-shell--wide">
      <header className="page-toolbar">
        <div>
          <h1>Rents</h1>
          <p>Vehicles ke monthly rents aur payments yahan manage karo.</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() =>
            showVehicleForm && !editingVehicleId ? closeVehicleForm() : openCreateVehicle()
          }
        >
          {showVehicleForm && !editingVehicleId ? 'Cancel' : 'Add Vehicle'}
        </button>
      </header>

      {showVehicleForm && (
        <form className="card panel-form panel-form--stock" onSubmit={handleVehicleSubmit} noValidate>
          <div className="form-grid">
            <div>
              <label htmlFor="rent-vehicle-name">Vehicle name</label>
              <input
                id="rent-vehicle-name"
                type="text"
                value={vehicleForm.name}
                onChange={(e) => setVehicleForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Suzuki Pickup LEA-1234"
                required
                maxLength={160}
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="rent-vehicle-rent">Monthly rent (Rs)</label>
              <input
                id="rent-vehicle-rent"
                type="number"
                min="0.01"
                step="0.01"
                value={vehicleForm.monthlyRent}
                onChange={(e) => setVehicleForm((p) => ({ ...p, monthlyRent: e.target.value }))}
                placeholder="e.g. 50000"
                required
              />
            </div>
            <div>
              <label htmlFor="rent-vehicle-note">Note (optional)</label>
              <input
                id="rent-vehicle-note"
                type="text"
                value={vehicleForm.note}
                onChange={(e) => setVehicleForm((p) => ({ ...p, note: e.target.value }))}
                placeholder="Driver / plate / owner"
                maxLength={255}
              />
            </div>
          </div>
          <div className="panel-form__actions">
            <button type="submit" className="btn-primary" disabled={savingVehicle}>
              {savingVehicle ? 'Saving…' : editingVehicleId ? 'Update Vehicle' : 'Save Vehicle'}
            </button>
            {editingVehicleId && (
              <button type="button" className="btn-secondary" onClick={closeVehicleForm} disabled={savingVehicle}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      <section className="card panel-form panel-form--stock">
        <div className="form-grid form-grid--order">
          <div>
            <label htmlFor="rent-vehicle-select">Vehicle</label>
            <select
              id="rent-vehicle-select"
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              disabled={vehiclesLoading}
            >
              <option value="">
                {vehiclesLoading
                  ? 'Loading…'
                  : vehicles.length
                    ? 'Select vehicle'
                    : 'No vehicles yet'}
              </option>
              {vehicles.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="rent-month">Month</label>
            <input
              id="rent-month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
        </div>
      </section>

      <div className="stock-table-wrap card" style={{ marginBottom: '1.25rem' }}>
        <table className="stock-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Monthly rent</th>
              <th>Note</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {vehicles.length === 0 ? (
              <tr>
                <td colSpan={4} className="stock-table__empty">
                  No vehicles yet. Click Add Vehicle.
                </td>
              </tr>
            ) : (
              vehicles.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{formatMoney(row.monthlyRent)}</td>
                  <td className="stock-table__wrap">{row.note || '—'}</td>
                  <td className="stock-table__actions">
                    <button
                      type="button"
                      className="btn-secondary btn-compact"
                      onClick={() => {
                        setVehicleId(String(row.id))
                        openEditVehicle(row)
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-danger btn-compact"
                      onClick={() => handleDeleteVehicle(row)}
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

      {!vehicleId ? (
        <p className="help-muted">Select a vehicle to open monthly rent hisab.</p>
      ) : ledgerLoading ? (
        <p className="help-muted">Loading ledger…</p>
      ) : !vehicle ? (
        <p className="help-muted">Vehicle not found.</p>
      ) : (
        <>
          <section className="card stock-totals stock-totals--split bills-shop-card">
            <div>
              <span className="stock-totals__label">Vehicle</span>
              <strong className="stock-totals__value">{vehicle.name}</strong>
              <p className="help-muted" style={{ marginTop: '0.35rem' }}>
                Month {month} · Fixed {formatMoney(vehicle.monthlyRent)}
              </p>
              {vehicle.note ? <p className="help-muted">{vehicle.note}</p> : null}
            </div>
          </section>

          <section className="stock-totals card stock-totals--split">
            <div>
              <span className="stock-totals__label">Due</span>
              <strong className="stock-totals__value">{formatMoney(summary.due)}</strong>
            </div>
            <div>
              <span className="stock-totals__label">Paid</span>
              <strong className="stock-totals__value">{formatMoney(summary.paid)}</strong>
            </div>
            <div>
              <span className="stock-totals__label">Remaining</span>
              <strong className="stock-totals__value">{formatMoney(summary.remaining)}</strong>
            </div>
            <div>
              <span className="stock-totals__label">Status</span>
              <strong className="stock-totals__value">
                <span className={`status-pill status-pill--${summary.payStatus || 'unpaid'}`}>
                  {payStatusLabel(summary.payStatus)}
                </span>
              </strong>
              {summary.advance > 0 ? (
                <p className="help-muted" style={{ marginTop: '0.35rem' }}>
                  Advance {formatMoney(summary.advance)}
                </p>
              ) : null}
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
                    <label htmlFor="rent-pay-date">Date</label>
                    <input
                      id="rent-pay-date"
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="rent-pay-amount">Amount (Rs)</label>
                    <input
                      id="rent-pay-amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="rent-pay-note">Note (optional)</label>
                    <input
                      id="rent-pay-note"
                      type="text"
                      value={paymentNote}
                      onChange={(e) => setPaymentNote(e.target.value)}
                      maxLength={255}
                    />
                  </div>
                </div>
                <div className="panel-form__actions">
                  <button type="submit" className="btn-primary" disabled={savingPayment}>
                    {savingPayment ? 'Saving…' : editingPaymentId ? 'Update Payment' : 'Save Payment'}
                  </button>
                  {editingPaymentId && (
                    <button type="button" className="btn-secondary" onClick={closePaymentForm} disabled={savingPayment}>
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
                    <th>For month</th>
                    <th>Amount</th>
                    <th>Note</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="stock-table__empty">
                        No payments for this month yet.
                      </td>
                    </tr>
                  ) : (
                    payments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{formatDateDisplay(payment.date)}</td>
                        <td>{payment.forMonth}</td>
                        <td>{formatMoney(payment.amount)}</td>
                        <td className="stock-table__wrap">{payment.note || '—'}</td>
                        <td className="stock-table__actions">
                          <button
                            type="button"
                            className="btn-secondary btn-compact"
                            onClick={() => openEditPayment(payment)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn-danger btn-compact"
                            onClick={() => handleDeletePayment(payment)}
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
          </section>
        </>
      )}
    </div>
  )
}

export default RentsPage
