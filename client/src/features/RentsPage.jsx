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

function emptyBuildingForm() {
  return { name: '', monthlyRent: '', note: '' }
}

function RentsPage() {
  const { confirm } = useConfirm()
  const { showToast } = useToast()

  const [buildings, setBuildings] = useState([])
  const [buildingsLoading, setBuildingsLoading] = useState(true)
  const [buildingId, setBuildingId] = useState('')
  const [month, setMonth] = useState(currentMonth())

  const [showBuildingForm, setShowBuildingForm] = useState(false)
  const [editingBuildingId, setEditingBuildingId] = useState(null)
  const [buildingForm, setBuildingForm] = useState(emptyBuildingForm())
  const [savingBuilding, setSavingBuilding] = useState(false)

  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [building, setBuilding] = useState(null)
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

  const loadBuildings = useCallback(async () => {
    setBuildingsLoading(true)
    try {
      const { data } = await api.get('/rents')
      const list = Array.isArray(data.data) ? data.data : []
      setBuildings(list)
      setBuildingId((prev) => (list.some((b) => String(b.id) === String(prev)) ? prev : ''))
    } catch (err) {
      setBuildings([])
      showToast(getErrorMessage(err), 'error')
    } finally {
      setBuildingsLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    loadBuildings()
  }, [loadBuildings])

  const applyLedger = useCallback((payload) => {
    setBuilding(payload.building || null)
    setSummary(
      payload.summary || { due: 0, paid: 0, remaining: 0, advance: 0, payStatus: 'unpaid' },
    )
    setPayments(payload.payments || [])
    if (payload.month) setMonth(payload.month)
  }, [])

  const loadLedger = useCallback(async () => {
    if (!buildingId) {
      setBuilding(null)
      setSummary({ due: 0, paid: 0, remaining: 0, advance: 0, payStatus: 'unpaid' })
      setPayments([])
      return
    }
    setLedgerLoading(true)
    try {
      const { data } = await api.get(`/rents/${buildingId}/ledger`, { params: { month } })
      applyLedger(data.data || {})
    } catch (err) {
      setBuilding(null)
      setPayments([])
      showToast(getErrorMessage(err), 'error')
    } finally {
      setLedgerLoading(false)
    }
  }, [buildingId, month, applyLedger, showToast])

  useEffect(() => {
    loadLedger()
  }, [loadLedger])

  function resetBuildingForm() {
    setEditingBuildingId(null)
    setBuildingForm(emptyBuildingForm())
  }

  function closeBuildingForm() {
    setShowBuildingForm(false)
    resetBuildingForm()
  }

  function openCreateBuilding() {
    resetBuildingForm()
    setShowBuildingForm(true)
  }

  function openEditBuilding(row) {
    setEditingBuildingId(row.id)
    setBuildingForm({
      name: row.name,
      monthlyRent: String(row.monthlyRent),
      note: row.note || '',
    })
    setShowBuildingForm(true)
  }

  async function handleBuildingSubmit(e) {
    e.preventDefault()
    const name = buildingForm.name.trim()
    const monthlyRent = Number(buildingForm.monthlyRent)
    if (!name) {
      showToast('Building name is required', 'error')
      return
    }
    if (!Number.isFinite(monthlyRent) || monthlyRent <= 0) {
      showToast('Monthly rent must be a positive number', 'error')
      return
    }
    setSavingBuilding(true)
    try {
      const body = { name, monthlyRent, note: buildingForm.note.trim() }
      if (editingBuildingId) {
        const { data } = await api.put(`/rents/${editingBuildingId}`, body)
        const updated = data.data
        setBuildings((prev) => prev.map((row) => (row.id === editingBuildingId ? updated : row)))
        if (String(buildingId) === String(editingBuildingId)) {
          setBuilding(updated)
          loadLedger()
        }
        showToast('Building updated')
      } else {
        const { data } = await api.post('/rents', body)
        const created = data.data
        setBuildings((prev) => [...prev, created])
        setBuildingId(String(created.id))
        showToast('Building added')
      }
      closeBuildingForm()
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setSavingBuilding(false)
    }
  }

  async function handleDeleteBuilding(row) {
    const ok = await confirm({
      title: 'Delete building',
      message: `Delete building "${row.name}"?`,
    })
    if (!ok) return
    try {
      await api.delete(`/rents/${row.id}`)
      setBuildings((prev) => prev.filter((b) => b.id !== row.id))
      if (String(buildingId) === String(row.id)) setBuildingId('')
      if (editingBuildingId === row.id) closeBuildingForm()
      showToast('Building deleted')
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
    if (!buildingId) {
      showToast('Select a building first', 'error')
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
        const { data } = await api.put(`/rents/${buildingId}/payments/${editingPaymentId}`, body)
        applyLedger(data.data || {})
        showToast('Payment updated')
      } else {
        const { data } = await api.post(`/rents/${buildingId}/payments`, body)
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
      const { data } = await api.delete(`/rents/${buildingId}/payments/${payment.id}`, {
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
          <p>Buildings ke monthly rents aur payments yahan manage karo.</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() =>
            showBuildingForm && !editingBuildingId ? closeBuildingForm() : openCreateBuilding()
          }
        >
          {showBuildingForm && !editingBuildingId ? 'Cancel' : 'Add Building'}
        </button>
      </header>

      {showBuildingForm && (
        <form className="card panel-form panel-form--stock" onSubmit={handleBuildingSubmit} noValidate>
          <div className="form-grid">
            <div>
              <label htmlFor="rent-building-name">Building name</label>
              <input
                id="rent-building-name"
                type="text"
                value={buildingForm.name}
                onChange={(e) => setBuildingForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Factory shed A"
                required
                maxLength={160}
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="rent-building-rent">Monthly rent (Rs)</label>
              <input
                id="rent-building-rent"
                type="number"
                min="0.01"
                step="0.01"
                value={buildingForm.monthlyRent}
                onChange={(e) => setBuildingForm((p) => ({ ...p, monthlyRent: e.target.value }))}
                placeholder="e.g. 50000"
                required
              />
            </div>
            <div>
              <label htmlFor="rent-building-note">Note (optional)</label>
              <input
                id="rent-building-note"
                type="text"
                value={buildingForm.note}
                onChange={(e) => setBuildingForm((p) => ({ ...p, note: e.target.value }))}
                placeholder="Address / landlord"
                maxLength={255}
              />
            </div>
          </div>
          <div className="panel-form__actions">
            <button type="submit" className="btn-primary" disabled={savingBuilding}>
              {savingBuilding ? 'Saving…' : editingBuildingId ? 'Update Building' : 'Save Building'}
            </button>
            {editingBuildingId && (
              <button type="button" className="btn-secondary" onClick={closeBuildingForm} disabled={savingBuilding}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      <section className="card panel-form panel-form--stock">
        <div className="form-grid form-grid--order">
          <div>
            <label htmlFor="rent-building-select">Building</label>
            <select
              id="rent-building-select"
              value={buildingId}
              onChange={(e) => setBuildingId(e.target.value)}
              disabled={buildingsLoading}
            >
              <option value="">
                {buildingsLoading
                  ? 'Loading…'
                  : buildings.length
                    ? 'Select building'
                    : 'No buildings yet'}
              </option>
              {buildings.map((row) => (
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
            {buildings.length === 0 ? (
              <tr>
                <td colSpan={4} className="stock-table__empty">
                  No buildings yet. Click Add Building.
                </td>
              </tr>
            ) : (
              buildings.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{formatMoney(row.monthlyRent)}</td>
                  <td className="stock-table__wrap">{row.note || '—'}</td>
                  <td className="stock-table__actions">
                    <button
                      type="button"
                      className="btn-secondary btn-compact"
                      onClick={() => {
                        setBuildingId(String(row.id))
                        openEditBuilding(row)
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-danger btn-compact"
                      onClick={() => handleDeleteBuilding(row)}
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

      {!buildingId ? (
        <p className="help-muted">Select a building to open monthly rent hisab.</p>
      ) : ledgerLoading ? (
        <p className="help-muted">Loading ledger…</p>
      ) : !building ? (
        <p className="help-muted">Building not found.</p>
      ) : (
        <>
          <section className="card stock-totals stock-totals--split bills-shop-card">
            <div>
              <span className="stock-totals__label">Building</span>
              <strong className="stock-totals__value">{building.name}</strong>
              <p className="help-muted" style={{ marginTop: '0.35rem' }}>
                Month {month} · Fixed {formatMoney(building.monthlyRent)}
              </p>
              {building.note ? <p className="help-muted">{building.note}</p> : null}
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
