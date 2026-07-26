import { useCallback, useEffect, useMemo, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import { useConfirm } from '../context/ConfirmContext'
import { useToast } from '../context/ToastContext'
import { usePermissions } from '../hooks/usePermissions'
import { formatDateDisplay, formatNum, todayIso } from '../utils/format'

function formatMoney(value) {
  return `Rs ${formatNum(value)}`
}

function payStatusLabel(status) {
  if (status === 'paid') return 'Paid'
  if (status === 'partial') return 'Partial'
  return 'Unpaid'
}

function emptyVehicleForm() {
  return { name: '', note: '' }
}

function emptyTripForm() {
  return { date: todayIso(), destination: '', fareAmount: '', note: '' }
}

function RentsPage() {
  const { confirm } = useConfirm()
  const { showToast } = useToast()
  const { canEdit, canDelete } = usePermissions()

  const [vehicles, setVehicles] = useState([])
  const [vehiclesLoading, setVehiclesLoading] = useState(true)
  const [vehicleId, setVehicleId] = useState('')

  const [showVehicleForm, setShowVehicleForm] = useState(false)
  const [editingVehicleId, setEditingVehicleId] = useState(null)
  const [vehicleForm, setVehicleForm] = useState(emptyVehicleForm())
  const [savingVehicle, setSavingVehicle] = useState(false)

  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [vehicle, setVehicle] = useState(null)
  const [summary, setSummary] = useState({
    totalFare: 0,
    totalPaid: 0,
    remaining: 0,
    advance: 0,
    tripCount: 0,
  })
  const [trips, setTrips] = useState([])
  const [payments, setPayments] = useState([])

  const [showTripForm, setShowTripForm] = useState(false)
  const [editingTripId, setEditingTripId] = useState(null)
  const [tripForm, setTripForm] = useState(emptyTripForm())
  const [savingTrip, setSavingTrip] = useState(false)

  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [editingPaymentId, setEditingPaymentId] = useState(null)
  const [paymentDate, setPaymentDate] = useState(todayIso())
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [savingPayment, setSavingPayment] = useState(false)

  const visibleVehicles = useMemo(
    () => (vehicleId ? vehicles.filter((v) => String(v.id) === String(vehicleId)) : vehicles),
    [vehicles, vehicleId],
  )

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
      payload.summary || {
        totalFare: 0,
        totalPaid: 0,
        remaining: 0,
        advance: 0,
        tripCount: 0,
      },
    )
    setTrips(payload.trips || [])
    setPayments(payload.payments || [])
  }, [])

  const loadLedger = useCallback(async () => {
    if (!vehicleId) {
      setVehicle(null)
      setSummary({ totalFare: 0, totalPaid: 0, remaining: 0, advance: 0, tripCount: 0 })
      setTrips([])
      setPayments([])
      return
    }
    setLedgerLoading(true)
    try {
      const { data } = await api.get(`/rents/${vehicleId}/ledger`)
      applyLedger(data.data || {})
    } catch (err) {
      setVehicle(null)
      setTrips([])
      setPayments([])
      showToast(getErrorMessage(err), 'error')
    } finally {
      setLedgerLoading(false)
    }
  }, [vehicleId, applyLedger, showToast])

  useEffect(() => {
    loadLedger()
  }, [loadLedger])

  function selectVehicle(id) {
    setVehicleId(String(id || ''))
  }

  function clearSelection() {
    setVehicleId('')
  }

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

  function openEditVehicle(row, e) {
    e?.stopPropagation()
    setEditingVehicleId(row.id)
    setVehicleForm({ name: row.name, note: row.note || '' })
    setShowVehicleForm(true)
    selectVehicle(row.id)
  }

  async function handleVehicleSubmit(e) {
    e.preventDefault()
    const name = vehicleForm.name.trim()
    if (!name) {
      showToast('Vehicle name is required', 'error')
      return
    }
    if (editingVehicleId && !canEdit) {
      showToast('Managers cannot edit records', 'error')
      return
    }
    setSavingVehicle(true)
    try {
      const body = { name, note: vehicleForm.note.trim() }
      if (editingVehicleId) {
        const { data } = await api.put(`/rents/${editingVehicleId}`, body)
        const updated = data.data
        setVehicles((prev) => prev.map((row) => (row.id === editingVehicleId ? updated : row)))
        if (String(vehicleId) === String(editingVehicleId)) setVehicle(updated)
        showToast('Vehicle updated')
      } else {
        const { data } = await api.post('/rents', body)
        const created = data.data
        setVehicles((prev) => [...prev, created])
        selectVehicle(created.id)
        showToast('Vehicle added')
      }
      closeVehicleForm()
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setSavingVehicle(false)
    }
  }

  async function handleDeleteVehicle(row, e) {
    e?.stopPropagation()
    const ok = await confirm({
      title: 'Delete vehicle',
      message: `Delete vehicle "${row.name}"?`,
    })
    if (!ok) return
    try {
      await api.delete(`/rents/${row.id}`)
      setVehicles((prev) => prev.filter((v) => v.id !== row.id))
      if (String(vehicleId) === String(row.id)) clearSelection()
      if (editingVehicleId === row.id) closeVehicleForm()
      showToast('Vehicle deleted')
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    }
  }

  function resetTripForm() {
    setEditingTripId(null)
    setTripForm(emptyTripForm())
  }

  function closeTripForm() {
    setShowTripForm(false)
    resetTripForm()
  }

  function openCreateTrip() {
    resetTripForm()
    setShowTripForm(true)
  }

  function openEditTrip(row) {
    setEditingTripId(row.id)
    setTripForm({
      date: row.date,
      destination: row.destination || '',
      fareAmount: String(row.fareAmount),
      note: row.note || '',
    })
    setShowTripForm(true)
  }

  async function handleTripSubmit(e) {
    e.preventDefault()
    if (!vehicleId) {
      showToast('Select a vehicle first', 'error')
      return
    }
    if (editingTripId && !canEdit) {
      showToast('Managers cannot edit records', 'error')
      return
    }
    const fareAmount = Number(tripForm.fareAmount)
    if (!tripForm.date) {
      showToast('Date is required', 'error')
      return
    }
    if (!tripForm.destination.trim()) {
      showToast('Destination / place is required', 'error')
      return
    }
    if (!Number.isFinite(fareAmount) || fareAmount <= 0) {
      showToast('Fare amount must be a positive number', 'error')
      return
    }
    setSavingTrip(true)
    try {
      const body = {
        date: tripForm.date,
        destination: tripForm.destination.trim(),
        fareAmount,
        note: tripForm.note.trim(),
      }
      if (editingTripId) {
        const { data } = await api.put(`/rents/${vehicleId}/trips/${editingTripId}`, body)
        applyLedger(data.data || {})
        showToast('Trip updated')
      } else {
        const { data } = await api.post(`/rents/${vehicleId}/trips`, body)
        applyLedger(data.data || {})
        showToast('Trip added')
      }
      closeTripForm()
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setSavingTrip(false)
    }
  }

  async function handleDeleteTrip(row) {
    const ok = await confirm({
      title: 'Delete trip',
      message: `Delete trip to "${row.destination}" (${formatMoney(row.fareAmount)})?`,
    })
    if (!ok) return
    try {
      const { data } = await api.delete(`/rents/${vehicleId}/trips/${row.id}`)
      applyLedger(data.data || {})
      if (editingTripId === row.id) closeTripForm()
      showToast('Trip deleted')
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

  function openEditPayment(row) {
    setEditingPaymentId(row.id)
    setPaymentDate(row.date)
    setPaymentAmount(String(row.amount))
    setPaymentNote(row.note || '')
    setShowPaymentForm(true)
  }

  async function handlePaymentSubmit(e) {
    e.preventDefault()
    if (!vehicleId) {
      showToast('Select a vehicle first', 'error')
      return
    }
    if (editingPaymentId && !canEdit) {
      showToast('Managers cannot edit records', 'error')
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
      const body = { date: paymentDate, amount, note: paymentNote.trim() }
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

  async function handleDeletePayment(row) {
    const ok = await confirm({
      title: 'Delete payment',
      message: `Delete payment of ${formatMoney(row.amount)} on ${formatDateDisplay(row.date)}?`,
    })
    if (!ok) return
    try {
      const { data } = await api.delete(`/rents/${vehicleId}/payments/${row.id}`)
      applyLedger(data.data || {})
      if (editingPaymentId === row.id) closePaymentForm()
      showToast('Payment deleted')
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    }
  }

  return (
    <div className="page-shell page-shell--wide">
      <header className="page-toolbar">
        <div>
          <h1>Vehicle Fare</h1>
          <p>
            Har delivery: kahan maal gaya, kis din, kitne paise mange — payment Unpaid/Partial/Paid.
            Lambay chakkar pe fare alag set kar sakte ho.
          </p>
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
              onChange={(e) => selectVehicle(e.target.value)}
              disabled={vehiclesLoading}
            >
              <option value="">
                {vehiclesLoading
                  ? 'Loading…'
                  : vehicles.length
                    ? 'Select vehicle (or click a row)'
                    : 'No vehicles yet'}
              </option>
              {vehicles.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </div>
          {vehicleId ? (
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={clearSelection}>
                Show all vehicles
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
              <th>Note</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {visibleVehicles.length === 0 ? (
              <tr>
                <td colSpan={3} className="stock-table__empty">
                  {vehicles.length === 0
                    ? 'No vehicles yet. Click Add Vehicle.'
                    : 'No vehicle selected.'}
                </td>
              </tr>
            ) : (
              visibleVehicles.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => selectVehicle(row.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{row.name}</td>
                  <td className="stock-table__wrap">{row.note || '—'}</td>
                  <td className="stock-table__actions" onClick={(e) => e.stopPropagation()}>
                    {canEdit && (
                      <button
                        type="button"
                        className="btn-secondary btn-compact"
                        onClick={(e) => openEditVehicle(row, e)}
                      >
                        Edit
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        className="btn-danger btn-compact"
                        onClick={(e) => handleDeleteVehicle(row, e)}
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

      {!vehicleId ? (
        <p className="help-muted">Select a vehicle (dropdown or row) to open delivery fare hisab.</p>
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
              {vehicle.note ? <p className="help-muted">{vehicle.note}</p> : null}
            </div>
          </section>

          <section className="stock-totals card stock-totals--split">
            <div>
              <span className="stock-totals__label">Trips fare</span>
              <strong className="stock-totals__value">{formatMoney(summary.totalFare)}</strong>
              <p className="help-muted" style={{ marginTop: '0.35rem' }}>
                {summary.tripCount} deliveries
              </p>
            </div>
            <div>
              <span className="stock-totals__label">Paid</span>
              <strong className="stock-totals__value">{formatMoney(summary.totalPaid)}</strong>
            </div>
            <div>
              <span className="stock-totals__label">Remaining</span>
              <strong className="stock-totals__value">{formatMoney(summary.remaining)}</strong>
            </div>
            <div>
              <span className="stock-totals__label">Advance</span>
              <strong className="stock-totals__value">{formatMoney(summary.advance)}</strong>
            </div>
          </section>

          <section className="bills-section" style={{ marginTop: '1.5rem' }}>
            <div className="page-toolbar" style={{ marginBottom: '0.75rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Deliveries / trips</h2>
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={() =>
                  showTripForm && !editingTripId ? closeTripForm() : openCreateTrip()
                }
              >
                {showTripForm && !editingTripId ? 'Cancel' : 'Add Trip'}
              </button>
            </div>

            {showTripForm && (
              <form className="card panel-form panel-form--stock" onSubmit={handleTripSubmit}>
                <div className="form-grid form-grid--order">
                  <div>
                    <label htmlFor="rent-trip-date">Date</label>
                    <input
                      id="rent-trip-date"
                      type="date"
                      value={tripForm.date}
                      onChange={(e) => setTripForm((p) => ({ ...p, date: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="rent-trip-dest">Destination</label>
                    <input
                      id="rent-trip-dest"
                      type="text"
                      value={tripForm.destination}
                      onChange={(e) => setTripForm((p) => ({ ...p, destination: e.target.value }))}
                      placeholder="e.g. Lahore / Shop name / area"
                      required
                      maxLength={255}
                    />
                  </div>
                  <div>
                    <label htmlFor="rent-trip-fare">Fare (Rs)</label>
                    <input
                      id="rent-trip-fare"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={tripForm.fareAmount}
                      onChange={(e) => setTripForm((p) => ({ ...p, fareAmount: e.target.value }))}
                      placeholder="Is delivery ke paise"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="rent-trip-note">Note (optional)</label>
                    <input
                      id="rent-trip-note"
                      type="text"
                      value={tripForm.note}
                      onChange={(e) => setTripForm((p) => ({ ...p, note: e.target.value }))}
                      maxLength={255}
                    />
                  </div>
                </div>
                <div className="panel-form__actions">
                  <button type="submit" className="btn-primary" disabled={savingTrip}>
                    {savingTrip ? 'Saving…' : editingTripId ? 'Update Trip' : 'Save Trip'}
                  </button>
                  {editingTripId && (
                    <button type="button" className="btn-secondary" onClick={closeTripForm} disabled={savingTrip}>
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
                    <th>Destination</th>
                    <th>Fare</th>
                    <th>Status</th>
                    <th>Note</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {trips.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="stock-table__empty">
                        No deliveries yet. Click Add Trip.
                      </td>
                    </tr>
                  ) : (
                    trips.map((row) => (
                      <tr key={row.id}>
                        <td>{formatDateDisplay(row.date)}</td>
                        <td className="stock-table__wrap">{row.destination}</td>
                        <td>{formatMoney(row.fareAmount)}</td>
                        <td>
                          <span className={`status-pill status-pill--${row.payStatus || 'unpaid'}`}>
                            {payStatusLabel(row.payStatus)}
                          </span>
                        </td>
                        <td className="stock-table__wrap">{row.note || '—'}</td>
                        <td className="stock-table__actions">
                          {canEdit && (
                            <button
                              type="button"
                              className="btn-secondary btn-compact"
                              onClick={() => openEditTrip(row)}
                            >
                              Edit
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              className="btn-danger btn-compact"
                              onClick={() => handleDeleteTrip(row)}
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
                    <th>Amount</th>
                    <th>Note</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="stock-table__empty">
                        No payments yet.
                      </td>
                    </tr>
                  ) : (
                    payments.map((row) => (
                      <tr key={row.id}>
                        <td>{formatDateDisplay(row.date)}</td>
                        <td>{formatMoney(row.amount)}</td>
                        <td className="stock-table__wrap">{row.note || '—'}</td>
                        <td className="stock-table__actions">
                          {canEdit && (
                            <button
                              type="button"
                              className="btn-secondary btn-compact"
                              onClick={() => openEditPayment(row)}
                            >
                              Edit
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              className="btn-danger btn-compact"
                              onClick={() => handleDeletePayment(row)}
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

export default RentsPage
