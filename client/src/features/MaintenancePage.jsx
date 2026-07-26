import { useCallback, useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import { useConfirm } from '../context/ConfirmContext'
import { useToast } from '../context/ToastContext'
import { usePermissions } from '../hooks/usePermissions'
import { formatDateDisplay, formatNum, todayIso } from '../utils/format'

function formatMoney(value) {
  return `Rs ${formatNum(value)}`
}

function MaintenancePage() {
  const { confirm } = useConfirm()
  const { showToast } = useToast()
  const { canEdit, canDelete } = usePermissions()

  const [selectedDate, setSelectedDate] = useState(todayIso())
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [totals, setTotals] = useState({ dayTotal: 0, total: 0 })

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [date, setDate] = useState(todayIso())
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const applyPayload = useCallback((payload) => {
    setItems(payload.items || [])
    setTotals(payload.totals || { dayTotal: 0, total: 0 })
    if (payload.date) setSelectedDate(payload.date)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/maintenance', { params: { date: selectedDate } })
      applyPayload(data.data || {})
    } catch (err) {
      setItems([])
      setTotals({ dayTotal: 0, total: 0 })
      showToast(getErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [selectedDate, applyPayload, showToast])

  useEffect(() => {
    load()
  }, [load])

  function resetForm() {
    setEditingId(null)
    setDate(selectedDate || todayIso())
    setTitle('')
    setAmount('')
    setNote('')
  }

  function closeForm() {
    setShowForm(false)
    resetForm()
  }

  function openCreate() {
    resetForm()
    setDate(selectedDate || todayIso())
    setShowForm(true)
  }

  function openEdit(item) {
    setEditingId(item.id)
    setDate(item.date)
    setTitle(item.title)
    setAmount(String(item.amount))
    setNote(item.note || '')
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmedTitle = title.trim()
    const amountNum = Number(amount)
    if (!date) {
      showToast('Date is required', 'error')
      return
    }
    if (!trimmedTitle) {
      showToast('Machine / work title is required', 'error')
      return
    }
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      showToast('Amount must be a positive number', 'error')
      return
    }
    if (editingId && !canEdit) {
      showToast('Managers cannot edit records', 'error')
      return
    }

    setSaving(true)
    try {
      const body = { date, title: trimmedTitle, amount: amountNum, note: note.trim() }
      if (editingId) {
        const { data } = await api.put(`/maintenance/${editingId}`, body)
        applyPayload(data.data || {})
        showToast('Maintenance updated')
      } else {
        const { data } = await api.post('/maintenance', body)
        applyPayload(data.data || {})
        showToast('Maintenance added')
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
      title: 'Delete maintenance',
      message: `Delete "${item.title}" (${formatMoney(item.amount)}) on ${formatDateDisplay(item.date)}?`,
    })
    if (!ok) return
    try {
      const { data } = await api.delete(`/maintenance/${item.id}`, {
        params: { date: selectedDate },
      })
      applyPayload(data.data || {})
      if (editingId === item.id) closeForm()
      showToast('Maintenance deleted')
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    }
  }

  return (
    <div className="page-shell page-shell--wide">
      <header className="page-toolbar">
        <div>
          <h1>Maintenance</h1>
          <p>Machine wear & tear aur repair kharcha yahan manage karo.</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => (showForm && !editingId ? closeForm() : openCreate())}
        >
          {showForm && !editingId ? 'Cancel' : 'Add Maintenance'}
        </button>
      </header>

      <section className="card panel-form panel-form--stock">
        <div className="form-grid form-grid--order">
          <div>
            <label htmlFor="maint-filter-date">View date</label>
            <input
              id="maint-filter-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="stock-totals card stock-totals--split">
        <div>
          <span className="stock-totals__label">Selected day</span>
          <strong className="stock-totals__value">{formatMoney(totals.dayTotal)}</strong>
          <p className="help-muted" style={{ marginTop: '0.35rem' }}>
            {formatDateDisplay(selectedDate)}
          </p>
        </div>
        <div>
          <span className="stock-totals__label">Total (all days)</span>
          <strong className="stock-totals__value">{formatMoney(totals.total)}</strong>
        </div>
      </section>

      {showForm && (
        <form className="card panel-form panel-form--stock" onSubmit={handleSubmit} noValidate>
          <div className="form-grid">
            <div>
              <label htmlFor="maint-date">Date</label>
              <input
                id="maint-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="maint-title">Machine / Work</label>
              <input
                id="maint-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Extruder belt, Motor repair"
                required
                maxLength={160}
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="maint-amount">Amount (Rs)</label>
              <input
                id="maint-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 2500"
                required
              />
            </div>
            <div>
              <label htmlFor="maint-note">Note (optional)</label>
              <input
                id="maint-note"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Parts + labour"
                maxLength={255}
              />
            </div>
          </div>
          <div className="panel-form__actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Update' : 'Save'}
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
        <p className="help-muted">Loading maintenance…</p>
      ) : (
        <div className="stock-table-wrap card">
          <table className="stock-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Machine / Work</th>
                <th>Amount</th>
                <th>Note</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="stock-table__empty">
                    Is din koi maintenance nahi. Add Maintenance se pehla entry add karo.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDateDisplay(item.date)}</td>
                    <td>{item.title}</td>
                    <td>{formatMoney(item.amount)}</td>
                    <td className="stock-table__wrap">{item.note || '—'}</td>
                    <td className="stock-table__actions">
                      {canEdit && (
                        <button type="button" className="btn-secondary btn-compact" onClick={() => openEdit(item)}>
                          Edit
                        </button>
                      )}
                      {canDelete && (
                        <button type="button" className="btn-danger btn-compact" onClick={() => handleDelete(item)}>
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

export default MaintenancePage
