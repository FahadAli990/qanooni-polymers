import { useCallback, useEffect, useMemo, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import { useConfirm } from '../context/ConfirmContext'
import { useToast } from '../context/ToastContext'
import { usePermissions } from '../hooks/usePermissions'
import { formatDateDisplay, formatNum, todayIso } from '../utils/format'
import { fileToCompressedDataUrl } from '../utils/imageUpload'

const CONTACT_RE = /^\d{11}$/

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

function emptyWorkerForm() {
  return {
    name: '',
    contact: '',
    address: '',
    fixedSalary: '',
    note: '',
    photo: '',
    idCardFront: '',
    idCardBack: '',
  }
}

function WorkersPage() {
  const { confirm } = useConfirm()
  const { showToast } = useToast()
  const { canEdit, canDelete } = usePermissions()

  const [workers, setWorkers] = useState([])
  const [workersLoading, setWorkersLoading] = useState(true)
  const [workerId, setWorkerId] = useState('')
  const [month, setMonth] = useState(currentMonth())

  const [showWorkerForm, setShowWorkerForm] = useState(false)
  const [editingWorkerId, setEditingWorkerId] = useState(null)
  const [workerForm, setWorkerForm] = useState(emptyWorkerForm())
  const [savingWorker, setSavingWorker] = useState(false)

  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [worker, setWorker] = useState(null)
  const [summary, setSummary] = useState({
    fixedSalary: 0,
    leaveDays: 0,
    leaveCut: 0,
    payable: 0,
    paid: 0,
    remaining: 0,
    advance: 0,
    payStatus: 'unpaid',
  })
  const [leaves, setLeaves] = useState([])
  const [payments, setPayments] = useState([])

  const [showLeaveForm, setShowLeaveForm] = useState(false)
  const [editingLeaveId, setEditingLeaveId] = useState(null)
  const [leaveDate, setLeaveDate] = useState(todayIso())
  const [leaveDays, setLeaveDays] = useState('1')
  const [leaveNote, setLeaveNote] = useState('')
  const [savingLeave, setSavingLeave] = useState(false)

  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [editingPaymentId, setEditingPaymentId] = useState(null)
  const [paymentDate, setPaymentDate] = useState(todayIso())
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [savingPayment, setSavingPayment] = useState(false)

  const visibleWorkers = useMemo(
    () => (workerId ? workers.filter((w) => String(w.id) === String(workerId)) : workers),
    [workers, workerId],
  )

  const loadWorkers = useCallback(async () => {
    setWorkersLoading(true)
    try {
      const { data } = await api.get('/workers')
      const list = Array.isArray(data.data) ? data.data : []
      setWorkers(list)
      setWorkerId((prev) => (list.some((w) => String(w.id) === String(prev)) ? prev : ''))
    } catch (err) {
      setWorkers([])
      showToast(getErrorMessage(err), 'error')
    } finally {
      setWorkersLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    loadWorkers()
  }, [loadWorkers])

  const applyLedger = useCallback((payload) => {
    setWorker(payload.worker || null)
    setSummary(
      payload.summary || {
        fixedSalary: 0,
        leaveDays: 0,
        leaveCut: 0,
        payable: 0,
        paid: 0,
        remaining: 0,
        advance: 0,
        payStatus: 'unpaid',
      },
    )
    setLeaves(payload.leaves || [])
    setPayments(payload.payments || [])
    if (payload.month) setMonth(payload.month)
  }, [])

  const loadLedger = useCallback(async () => {
    if (!workerId) {
      setWorker(null)
      setSummary({
        fixedSalary: 0,
        leaveDays: 0,
        leaveCut: 0,
        payable: 0,
        paid: 0,
        remaining: 0,
        advance: 0,
        payStatus: 'unpaid',
      })
      setLeaves([])
      setPayments([])
      return
    }
    setLedgerLoading(true)
    try {
      const [ledgerRes, detailRes] = await Promise.all([
        api.get(`/workers/${workerId}/ledger`, { params: { month } }),
        api.get(`/workers/${workerId}`),
      ])
      const ledger = ledgerRes.data.data || {}
      const detail = detailRes.data.data || {}
      applyLedger({
        ...ledger,
        worker: {
          ...(ledger.worker || {}),
          ...detail,
        },
      })
    } catch (err) {
      setWorker(null)
      setLeaves([])
      setPayments([])
      showToast(getErrorMessage(err), 'error')
    } finally {
      setLedgerLoading(false)
    }
  }, [workerId, month, applyLedger, showToast])

  useEffect(() => {
    loadLedger()
  }, [loadLedger])

  function resetWorkerForm() {
    setEditingWorkerId(null)
    setWorkerForm(emptyWorkerForm())
  }

  function closeWorkerForm() {
    setShowWorkerForm(false)
    resetWorkerForm()
  }

  function openCreateWorker() {
    resetWorkerForm()
    setShowWorkerForm(true)
  }

  async function openEditWorker(row) {
    setEditingWorkerId(row.id)
    setShowWorkerForm(true)
    try {
      const { data } = await api.get(`/workers/${row.id}`)
      const full = data.data || row
      setWorkerForm({
        name: full.name || '',
        contact: full.contact || '',
        address: full.address || '',
        fixedSalary: full.fixedSalary != null ? String(full.fixedSalary) : '',
        note: full.note || '',
        photo: full.photo || '',
        idCardFront: full.idCardFront || '',
        idCardBack: full.idCardBack || '',
      })
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
      setWorkerForm({
        name: row.name,
        contact: row.contact || '',
        address: row.address || '',
        fixedSalary: String(row.fixedSalary || ''),
        note: row.note || '',
        photo: '',
        idCardFront: '',
        idCardBack: '',
      })
    }
  }

  function onContactChange(value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 11)
    setWorkerForm((prev) => ({ ...prev, contact: digits }))
  }

  async function onWorkerPhotoChange(file) {
    if (!file) return
    try {
      const dataUrl = await fileToCompressedDataUrl(file)
      setWorkerForm((prev) => ({ ...prev, photo: dataUrl }))
    } catch (err) {
      showToast(err.message || 'Could not process image', 'error')
    }
  }

  async function onIdCardChange(side, file) {
    if (!file) return
    try {
      const dataUrl = await fileToCompressedDataUrl(file)
      setWorkerForm((prev) => ({
        ...prev,
        [side === 'front' ? 'idCardFront' : 'idCardBack']: dataUrl,
      }))
    } catch (err) {
      showToast(err.message || 'Could not process image', 'error')
    }
  }

  async function handleWorkerSubmit(e) {
    e.preventDefault()
    const name = workerForm.name.trim()
    const contact = workerForm.contact.trim()
    const address = workerForm.address.trim()
    const fixedSalary = Number(workerForm.fixedSalary)
    if (!name) {
      showToast('Worker name is required', 'error')
      return
    }
    if (!CONTACT_RE.test(contact)) {
      showToast('Contact must be exactly 11 digits', 'error')
      return
    }
    if (!address) {
      showToast('Address is required', 'error')
      return
    }
    if (!Number.isFinite(fixedSalary) || fixedSalary <= 0) {
      showToast('Fixed salary must be a positive number', 'error')
      return
    }
    if (!workerForm.photo) {
      showToast('Worker photo is required', 'error')
      return
    }
    if (!workerForm.idCardFront) {
      showToast('ID card front image is required', 'error')
      return
    }
    if (!workerForm.idCardBack) {
      showToast('ID card back image is required', 'error')
      return
    }
    if (editingWorkerId && !canEdit) {
      showToast('Managers cannot edit records', 'error')
      return
    }
    setSavingWorker(true)
    try {
      const body = {
        name,
        contact,
        address,
        fixedSalary,
        note: workerForm.note.trim(),
        photo: workerForm.photo,
        idCardFront: workerForm.idCardFront,
        idCardBack: workerForm.idCardBack,
      }
      if (editingWorkerId) {
        const { data } = await api.put(`/workers/${editingWorkerId}`, body)
        const updated = data.data
        setWorkers((prev) =>
          prev.map((row) =>
            row.id === editingWorkerId
              ? {
                  ...updated,
                  photo: undefined,
                  idCardFront: undefined,
                  idCardBack: undefined,
                  hasPhoto: Boolean(updated.photo),
                  hasIdCardFront: Boolean(updated.idCardFront),
                  hasIdCardBack: Boolean(updated.idCardBack),
                }
              : row,
          ),
        )
        if (String(workerId) === String(editingWorkerId)) {
          setWorker(updated)
          loadLedger()
        }
        showToast('Worker updated')
      } else {
        const { data } = await api.post('/workers', body)
        const created = data.data
        setWorkers((prev) => [
          ...prev,
          {
            ...created,
            photo: undefined,
            idCardFront: undefined,
            idCardBack: undefined,
            hasPhoto: Boolean(created.photo),
            hasIdCardFront: Boolean(created.idCardFront),
            hasIdCardBack: Boolean(created.idCardBack),
          },
        ])
        setWorkerId(String(created.id))
        showToast('Worker added')
      }
      closeWorkerForm()
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setSavingWorker(false)
    }
  }

  async function handleDeleteWorker(row) {
    const ok = await confirm({
      title: 'Delete worker',
      message: `Delete worker "${row.name}"?`,
    })
    if (!ok) return
    try {
      await api.delete(`/workers/${row.id}`)
      setWorkers((prev) => prev.filter((w) => w.id !== row.id))
      if (String(workerId) === String(row.id)) setWorkerId('')
      if (editingWorkerId === row.id) closeWorkerForm()
      showToast('Worker deleted')
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    }
  }

  function resetLeaveForm() {
    setEditingLeaveId(null)
    setLeaveDate(todayIso())
    setLeaveDays('1')
    setLeaveNote('')
  }

  function closeLeaveForm() {
    setShowLeaveForm(false)
    resetLeaveForm()
  }

  function openCreateLeave() {
    resetLeaveForm()
    setShowLeaveForm(true)
  }

  function openEditLeave(leave) {
    setEditingLeaveId(leave.id)
    setLeaveDate(leave.date)
    setLeaveDays(String(leave.days))
    setLeaveNote(leave.note || '')
    setShowLeaveForm(true)
  }

  async function handleLeaveSubmit(e) {
    e.preventDefault()
    if (!workerId) {
      showToast('Select a worker first', 'error')
      return
    }
    const days = Number(leaveDays)
    if (!leaveDate) {
      showToast('Leave date is required', 'error')
      return
    }
    if (!Number.isFinite(days) || days <= 0) {
      showToast('Leave days must be greater than 0', 'error')
      return
    }
    if (editingLeaveId && !canEdit) {
      showToast('Managers cannot edit records', 'error')
      return
    }
    setSavingLeave(true)
    try {
      const body = { date: leaveDate, days, note: leaveNote.trim() }
      if (editingLeaveId) {
        const { data } = await api.put(`/workers/${workerId}/leaves/${editingLeaveId}`, body)
        applyLedger(data.data || {})
        showToast('Leave updated')
      } else {
        const { data } = await api.post(`/workers/${workerId}/leaves`, body)
        applyLedger(data.data || {})
        showToast('Leave recorded')
      }
      closeLeaveForm()
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setSavingLeave(false)
    }
  }

  async function handleDeleteLeave(leave) {
    const ok = await confirm({
      title: 'Delete leave',
      message: `Delete leave on ${formatDateDisplay(leave.date)} (${formatNum(leave.days)} day)?`,
    })
    if (!ok) return
    try {
      const { data } = await api.delete(`/workers/${workerId}/leaves/${leave.id}`, {
        params: { month },
      })
      applyLedger(data.data || {})
      if (editingLeaveId === leave.id) closeLeaveForm()
      showToast('Leave deleted')
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
    if (!workerId) {
      showToast('Select a worker first', 'error')
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
        forMonth: month,
        amount,
        note: paymentNote.trim(),
      }
      if (editingPaymentId) {
        const { data } = await api.put(`/workers/${workerId}/payments/${editingPaymentId}`, body)
        applyLedger(data.data || {})
        showToast('Salary payment updated')
      } else {
        const { data } = await api.post(`/workers/${workerId}/payments`, body)
        applyLedger(data.data || {})
        showToast('Salary payment recorded')
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
      title: 'Delete salary payment',
      message: `Delete payment of ${formatMoney(payment.amount)} on ${formatDateDisplay(payment.date)}?`,
    })
    if (!ok) return
    try {
      const { data } = await api.delete(`/workers/${workerId}/payments/${payment.id}`, {
        params: { month },
      })
      applyLedger(data.data || {})
      if (editingPaymentId === payment.id) closePaymentForm()
      showToast('Salary payment deleted')
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    }
  }

  return (
    <div className="page-shell page-shell--wide">
      <header className="page-toolbar">
        <div>
          <h1>Workers & Salary</h1>
          <p>Workers add karo, chuttiyan record karo, aur monthly salary paid / unpaid manage karo.</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() =>
            showWorkerForm && !editingWorkerId ? closeWorkerForm() : openCreateWorker()
          }
        >
          {showWorkerForm && !editingWorkerId ? 'Cancel' : 'Add Worker'}
        </button>
      </header>

      {showWorkerForm && (
        <form className="card panel-form panel-form--stock" onSubmit={handleWorkerSubmit} noValidate>
          <div className="form-grid">
            <div>
              <label htmlFor="worker-name">Name</label>
              <input
                id="worker-name"
                type="text"
                value={workerForm.name}
                onChange={(e) => setWorkerForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Worker name"
                required
                maxLength={160}
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="worker-contact">Contact</label>
              <input
                id="worker-contact"
                type="text"
                inputMode="numeric"
                value={workerForm.contact}
                onChange={(e) => onContactChange(e.target.value)}
                placeholder="11-digit number"
                required
                maxLength={11}
              />
            </div>
            <div>
              <label htmlFor="worker-salary">Fixed monthly salary (Rs)</label>
              <input
                id="worker-salary"
                type="number"
                min="1"
                step="1"
                value={workerForm.fixedSalary}
                onChange={(e) => setWorkerForm((p) => ({ ...p, fixedSalary: e.target.value }))}
                placeholder="e.g. 25000"
                required
              />
            </div>
            <div>
              <label htmlFor="worker-note">Note (optional)</label>
              <input
                id="worker-note"
                type="text"
                value={workerForm.note}
                onChange={(e) => setWorkerForm((p) => ({ ...p, note: e.target.value }))}
                placeholder="Role / shift"
                maxLength={255}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="worker-address">Address</label>
              <input
                id="worker-address"
                type="text"
                value={workerForm.address}
                onChange={(e) => setWorkerForm((p) => ({ ...p, address: e.target.value }))}
                placeholder="Full residential address"
                required
                maxLength={255}
              />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div>
              <label htmlFor="worker-photo">Worker photo</label>
              <input
                id="worker-photo"
                type="file"
                accept="image/*"
                onChange={(e) => onWorkerPhotoChange(e.target.files?.[0])}
              />
              {workerForm.photo ? (
                <img
                  src={workerForm.photo}
                  alt="Worker photo preview"
                  style={{
                    marginTop: '0.5rem',
                    width: '100%',
                    maxHeight: '160px',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                  }}
                />
              ) : (
                <p className="help-muted" style={{ marginTop: '0.35rem' }}>
                  Worker photo required
                </p>
              )}
            </div>
            <div>
              <label htmlFor="worker-id-front">ID card front</label>
              <input
                id="worker-id-front"
                type="file"
                accept="image/*"
                onChange={(e) => onIdCardChange('front', e.target.files?.[0])}
              />
              {workerForm.idCardFront ? (
                <img
                  src={workerForm.idCardFront}
                  alt="ID card front preview"
                  style={{
                    marginTop: '0.5rem',
                    width: '100%',
                    maxHeight: '160px',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                  }}
                />
              ) : (
                <p className="help-muted" style={{ marginTop: '0.35rem' }}>
                  Front photo required
                </p>
              )}
            </div>
            <div>
              <label htmlFor="worker-id-back">ID card back</label>
              <input
                id="worker-id-back"
                type="file"
                accept="image/*"
                onChange={(e) => onIdCardChange('back', e.target.files?.[0])}
              />
              {workerForm.idCardBack ? (
                <img
                  src={workerForm.idCardBack}
                  alt="ID card back preview"
                  style={{
                    marginTop: '0.5rem',
                    width: '100%',
                    maxHeight: '160px',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                  }}
                />
              ) : (
                <p className="help-muted" style={{ marginTop: '0.35rem' }}>
                  Back photo required
                </p>
              )}
            </div>
            </div>
          </div>
          <div className="panel-form__actions">
            <button type="submit" className="btn-primary" disabled={savingWorker}>
              {savingWorker ? 'Saving…' : editingWorkerId ? 'Update Worker' : 'Save Worker'}
            </button>
            {editingWorkerId && (
              <button type="button" className="btn-secondary" onClick={closeWorkerForm} disabled={savingWorker}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      <section className="card panel-form panel-form--stock">
        <div className="form-grid form-grid--order">
          <div>
            <label htmlFor="worker-select">Worker</label>
            <select
              id="worker-select"
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              disabled={workersLoading}
            >
              <option value="">
                {workersLoading
                  ? 'Loading…'
                  : workers.length
                    ? 'Select worker (or click a row)'
                    : 'No workers yet'}
              </option>
              {workers.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="worker-month">Month</label>
            <input
              id="worker-month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
          {workerId ? (
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setWorkerId('')}>
                Show all workers
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
              <th>Address</th>
              <th>Fixed salary</th>
              <th>Photos</th>
              <th>Note</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {workers.length === 0 ? (
              <tr>
                <td colSpan={7} className="stock-table__empty">
                  No workers yet. Click Add Worker.
                </td>
              </tr>
            ) : (
              visibleWorkers.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setWorkerId(String(row.id))}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{row.name}</td>
                  <td>{row.contact}</td>
                  <td className="stock-table__wrap">{row.address || '—'}</td>
                  <td>{formatMoney(row.fixedSalary)}</td>
                  <td>
                    {(() => {
                      const parts = []
                      if (row.hasPhoto) parts.push('Photo')
                      if (row.hasIdCardFront) parts.push('Front')
                      if (row.hasIdCardBack) parts.push('Back')
                      return parts.length ? parts.join(' + ') : '—'
                    })()}
                  </td>
                  <td className="stock-table__wrap">{row.note || '—'}</td>
                  <td
                    className="stock-table__actions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {canEdit && (
                      <button
                        type="button"
                        className="btn-secondary btn-compact"
                        onClick={() => {
                          setWorkerId(String(row.id))
                          openEditWorker(row)
                        }}
                      >
                        Edit
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        className="btn-danger btn-compact"
                        onClick={() => handleDeleteWorker(row)}
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
      {!workerId ? (
        <p className="help-muted">Select a worker to open leave & salary hisab.</p>
      ) : ledgerLoading ? (
        <p className="help-muted">Loading ledger…</p>
      ) : !worker ? (
        <p className="help-muted">Worker not found.</p>
      ) : (
        <>
          <section className="card stock-totals stock-totals--split bills-shop-card">
            <div>
              <span className="stock-totals__label">Worker</span>
              <strong className="stock-totals__value">{worker.name}</strong>
              <p className="help-muted" style={{ marginTop: '0.35rem' }}>
                {worker.contact} · Month {month}
              </p>
              <p className="help-muted">{worker.address || 'No address'}</p>
              {worker.note ? <p className="help-muted">{worker.note}</p> : null}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              <div>
                <span className="stock-totals__label">Worker photo</span>
                {worker.photo ? (
                  <img
                    src={worker.photo}
                    alt="Worker"
                    style={{
                      marginTop: '0.35rem',
                      width: '100%',
                      maxHeight: '140px',
                      objectFit: 'cover',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                    }}
                  />
                ) : (
                  <p className="help-muted">Not attached</p>
                )}
              </div>
              <div>
                <span className="stock-totals__label">ID front</span>
                {worker.idCardFront ? (
                  <img
                    src={worker.idCardFront}
                    alt="ID card front"
                    style={{
                      marginTop: '0.35rem',
                      width: '100%',
                      maxHeight: '140px',
                      objectFit: 'cover',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                    }}
                  />
                ) : (
                  <p className="help-muted">Not attached</p>
                )}
              </div>
              <div>
                <span className="stock-totals__label">ID back</span>
                {worker.idCardBack ? (
                  <img
                    src={worker.idCardBack}
                    alt="ID card back"
                    style={{
                      marginTop: '0.35rem',
                      width: '100%',
                      maxHeight: '140px',
                      objectFit: 'cover',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                    }}
                  />
                ) : (
                  <p className="help-muted">Not attached</p>
                )}
              </div>
            </div>
          </section>

          <section className="stock-totals card stock-totals--split">
            <div>
              <span className="stock-totals__label">Fixed salary</span>
              <strong className="stock-totals__value">{formatMoney(summary.fixedSalary)}</strong>
            </div>
            <div>
              <span className="stock-totals__label">Leave days</span>
              <strong className="stock-totals__value">{formatNum(summary.leaveDays)}</strong>
              <p className="help-muted" style={{ marginTop: '0.35rem' }}>
                Cut {formatMoney(summary.leaveCut)}
              </p>
            </div>
            <div>
              <span className="stock-totals__label">Payable</span>
              <strong className="stock-totals__value">{formatMoney(summary.payable)}</strong>
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

          <section className="bills-section">
            <div className="page-toolbar" style={{ marginBottom: '0.75rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Leaves (Chutti)</h2>
                <p className="help-muted" style={{ margin: '0.25rem 0 0' }}>
                  Cut = fixed salary ÷ 30 × leave days.
                </p>
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={() =>
                  showLeaveForm && !editingLeaveId ? closeLeaveForm() : openCreateLeave()
                }
              >
                {showLeaveForm && !editingLeaveId ? 'Cancel' : 'Add Leave'}
              </button>
            </div>

            {showLeaveForm && (
              <form className="card panel-form panel-form--stock" onSubmit={handleLeaveSubmit}>
                <div className="form-grid form-grid--order">
                  <div>
                    <label htmlFor="leave-date">Date</label>
                    <input
                      id="leave-date"
                      type="date"
                      value={leaveDate}
                      onChange={(e) => setLeaveDate(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="leave-days">Days</label>
                    <input
                      id="leave-days"
                      type="number"
                      min="0.01"
                      step="0.5"
                      value={leaveDays}
                      onChange={(e) => setLeaveDays(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="leave-note">Note (optional)</label>
                    <input
                      id="leave-note"
                      type="text"
                      value={leaveNote}
                      onChange={(e) => setLeaveNote(e.target.value)}
                      maxLength={255}
                    />
                  </div>
                </div>
                <div className="panel-form__actions">
                  <button type="submit" className="btn-primary" disabled={savingLeave}>
                    {savingLeave ? 'Saving…' : editingLeaveId ? 'Update Leave' : 'Save Leave'}
                  </button>
                  {editingLeaveId && (
                    <button type="button" className="btn-secondary" onClick={closeLeaveForm} disabled={savingLeave}>
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
                    <th>Days</th>
                    <th>Note</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {leaves.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="stock-table__empty">
                        No leaves this month.
                      </td>
                    </tr>
                  ) : (
                    leaves.map((leave) => (
                      <tr key={leave.id}>
                        <td>{formatDateDisplay(leave.date)}</td>
                        <td>{formatNum(leave.days)}</td>
                        <td className="stock-table__wrap">{leave.note || '—'}</td>
                        <td className="stock-table__actions">
                          {canEdit && (
                            <button
                              type="button"
                              className="btn-secondary btn-compact"
                              onClick={() => openEditLeave(leave)}
                            >
                              Edit
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              className="btn-danger btn-compact"
                              onClick={() => handleDeleteLeave(leave)}
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
                <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Salary Payments</h2>
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
                    <label htmlFor="salary-pay-date">Date</label>
                    <input
                      id="salary-pay-date"
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="salary-pay-amount">Amount (Rs)</label>
                    <input
                      id="salary-pay-amount"
                      type="number"
                      min="1"
                      step="1"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="salary-pay-note">Note (optional)</label>
                    <input
                      id="salary-pay-note"
                      type="text"
                      value={paymentNote}
                      onChange={(e) => setPaymentNote(e.target.value)}
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
                        No salary payments for this month yet.
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

export default WorkersPage
