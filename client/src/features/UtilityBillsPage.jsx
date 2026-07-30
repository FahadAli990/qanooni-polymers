import { useCallback, useEffect, useMemo, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import PhoneNumbersField from '../components/PhoneNumbersField'
import { useConfirm } from '../context/ConfirmContext'
import { useToast } from '../context/ToastContext'
import { usePermissions } from '../hooks/usePermissions'
import { formatContactDisplay, validateContactNumbers } from '../utils/contactNumbers'
import { formatDateDisplay, formatNum, todayIso } from '../utils/format'

const OTHER_CATEGORIES = ['Electricity', 'Water', 'Internet', 'Other']

function formatMoney(value) {
  return `Rs ${formatNum(value)}`
}

function payStatusLabel(status) {
  if (status === 'paid') return 'Paid'
  if (status === 'partial') return 'Partial'
  return 'Unpaid'
}

function emptySupplierForm() {
  return { name: '', contact: '', note: '' }
}

function emptyPurchaseForm() {
  return {
    date: todayIso(),
    dueDate: todayIso(),
    cylinderKg: '',
    cylindersCount: '1',
    pricePerKg: '',
    note: '',
  }
}

function emptyBillForm() {
  return {
    date: todayIso(),
    dueDate: todayIso(),
    category: 'Electricity',
    title: '',
    amount: '',
    payStatus: 'unpaid',
    note: '',
  }
}

function UtilityBillsPage() {
  const { confirm } = useConfirm()
  const { showToast } = useToast()
  const { canEdit, canDelete, isAdmin } = usePermissions()
  const [statusUpdatingId, setStatusUpdatingId] = useState(null)
  const [dueUpdatingId, setDueUpdatingId] = useState(null)

  const [tab, setTab] = useState('gas')

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
    totalCylinders: 0,
    totalKg: 0,
  })
  const [purchases, setPurchases] = useState([])
  const [payments, setPayments] = useState([])

  const [showPurchaseForm, setShowPurchaseForm] = useState(false)
  const [editingPurchaseId, setEditingPurchaseId] = useState(null)
  const [purchaseForm, setPurchaseForm] = useState(emptyPurchaseForm())
  const [savingPurchase, setSavingPurchase] = useState(false)

  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [editingPaymentId, setEditingPaymentId] = useState(null)
  const [paymentDate, setPaymentDate] = useState(todayIso())
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [savingPayment, setSavingPayment] = useState(false)

  const [billDate, setBillDate] = useState(todayIso())
  const [bills, setBills] = useState([])
  const [billTotals, setBillTotals] = useState({ dayTotal: 0, total: 0 })
  const [billsLoading, setBillsLoading] = useState(false)
  const [showBillForm, setShowBillForm] = useState(false)
  const [editingBillId, setEditingBillId] = useState(null)
  const [billForm, setBillForm] = useState(emptyBillForm())
  const [savingBill, setSavingBill] = useState(false)

  const purchasePreviewTotal = useMemo(() => {
    const kg = Number(purchaseForm.cylinderKg)
    const count = Number(purchaseForm.cylindersCount)
    const price = Number(purchaseForm.pricePerKg)
    if (
      !Number.isFinite(kg) ||
      !Number.isFinite(count) ||
      !Number.isFinite(price) ||
      kg <= 0 ||
      count <= 0 ||
      price <= 0
    ) {
      return 0
    }
    return Number((kg * count * price).toFixed(2))
  }, [purchaseForm.cylinderKg, purchaseForm.cylindersCount, purchaseForm.pricePerKg])

  const visibleSuppliers = useMemo(
    () =>
      supplierId ? suppliers.filter((s) => String(s.id) === String(supplierId)) : suppliers,
    [suppliers, supplierId],
  )

  const loadSuppliers = useCallback(async () => {
    setSuppliersLoading(true)
    try {
      const { data } = await api.get('/utility/suppliers')
      const list = Array.isArray(data.data) ? data.data : []
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
        totalCylinders: 0,
        totalKg: 0,
      },
    )
    setPurchases(payload.purchases || [])
    setPayments(payload.payments || [])
  }, [])

  const loadLedger = useCallback(async () => {
    if (!supplierId) {
      setSupplier(null)
      setSummary({
        totalPurchased: 0,
        totalPaid: 0,
        remaining: 0,
        advance: 0,
        totalCylinders: 0,
        totalKg: 0,
      })
      setPurchases([])
      setPayments([])
      return
    }
    setLedgerLoading(true)
    try {
      const { data } = await api.get(`/utility/suppliers/${supplierId}/ledger`)
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

  const loadBills = useCallback(async () => {
    setBillsLoading(true)
    try {
      const { data } = await api.get('/utility/bills', { params: { date: billDate } })
      const payload = data.data || {}
      setBills(payload.items || [])
      setBillTotals(payload.totals || { dayTotal: 0, total: 0 })
      if (payload.date) setBillDate(payload.date)
    } catch (err) {
      setBills([])
      showToast(getErrorMessage(err), 'error')
    } finally {
      setBillsLoading(false)
    }
  }, [billDate, showToast])

  useEffect(() => {
    if (tab === 'other') loadBills()
  }, [tab, loadBills])

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
    setSupplierForm({
      name: row.name,
      contact: row.contact || '',
      note: row.note || '',
    })
    setShowSupplierForm(true)
  }

  async function handleSupplierSubmit(e) {
    e.preventDefault()
    const name = supplierForm.name.trim()
    const contact = supplierForm.contact.trim()
    if (!name) {
      showToast('Gas supplier name is required', 'error')
      return
    }
    const contactError = validateContactNumbers(contact, { fieldLabel: 'Contact' })
    if (contactError) {
      showToast(contactError, 'error')
      return
    }
    if (editingSupplierId && !canEdit) {
      showToast('Managers cannot edit records', 'error')
      return
    }
    setSavingSupplier(true)
    try {
      const body = { name, contact, note: supplierForm.note.trim() }
      if (editingSupplierId) {
        const { data } = await api.put(`/utility/suppliers/${editingSupplierId}`, body)
        const updated = data.data
        setSuppliers((prev) => prev.map((row) => (row.id === editingSupplierId ? updated : row)))
        if (String(supplierId) === String(editingSupplierId)) setSupplier(updated)
        showToast('Gas supplier updated')
      } else {
        const { data } = await api.post('/utility/suppliers', body)
        const created = data.data
        setSuppliers((prev) => [...prev, created])
        setSupplierId(String(created.id))
        showToast('Gas supplier added')
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
      title: 'Delete gas supplier',
      message: `Delete gas supplier "${row.name}"?`,
    })
    if (!ok) return
    try {
      await api.delete(`/utility/suppliers/${row.id}`)
      setSuppliers((prev) => prev.filter((s) => s.id !== row.id))
      if (String(supplierId) === String(row.id)) setSupplierId('')
      if (editingSupplierId === row.id) closeSupplierForm()
      showToast('Gas supplier deleted')
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    }
  }

  function resetPurchaseForm() {
    setEditingPurchaseId(null)
    setPurchaseForm(emptyPurchaseForm())
  }

  function closePurchaseForm() {
    setShowPurchaseForm(false)
    resetPurchaseForm()
  }

  function openCreatePurchase() {
    resetPurchaseForm()
    setShowPurchaseForm(true)
  }

  function openEditPurchase(row) {
    setEditingPurchaseId(row.id)
    setPurchaseForm({
      date: row.date,
      dueDate: row.dueDate || row.date || todayIso(),
      cylinderKg: String(row.cylinderKg),
      cylindersCount: String(row.cylindersCount),
      pricePerKg: String(row.pricePerKg),
      note: row.note || '',
    })
    setShowPurchaseForm(true)
  }

  async function handlePurchaseSubmit(e) {
    e.preventDefault()
    if (!supplierId) {
      showToast('Select a gas supplier first', 'error')
      return
    }
    const cylinderKg = Number(purchaseForm.cylinderKg)
    const cylindersCount = Number(purchaseForm.cylindersCount)
    const pricePerKg = Number(purchaseForm.pricePerKg)
    if (!purchaseForm.date) {
      showToast('Date is required', 'error')
      return
    }
    if (!purchaseForm.dueDate) {
      showToast('Due date is required', 'error')
      return
    }
    if (!Number.isFinite(cylinderKg) || cylinderKg <= 0) {
      showToast('Cylinder kg must be a positive number', 'error')
      return
    }
    if (!Number.isInteger(cylindersCount) || cylindersCount <= 0) {
      showToast('Cylinders count must be a positive whole number', 'error')
      return
    }
    if (!Number.isFinite(pricePerKg) || pricePerKg <= 0) {
      showToast('Price per kg must be a positive number', 'error')
      return
    }
    if (editingPurchaseId && !canEdit) {
      showToast('Managers cannot edit records', 'error')
      return
    }
    setSavingPurchase(true)
    try {
      const body = {
        date: purchaseForm.date,
        dueDate: purchaseForm.dueDate,
        cylinderKg,
        cylindersCount,
        pricePerKg,
        note: purchaseForm.note.trim(),
      }
      if (editingPurchaseId) {
        const { data } = await api.put(
          `/utility/suppliers/${supplierId}/purchases/${editingPurchaseId}`,
          body,
        )
        applyLedger(data.data || {})
        showToast('Cylinder purchase updated')
      } else {
        const { data } = await api.post(`/utility/suppliers/${supplierId}/purchases`, body)
        applyLedger(data.data || {})
        showToast('Cylinder purchase added')
      }
      closePurchaseForm()
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setSavingPurchase(false)
    }
  }

  async function handleDeletePurchase(row) {
    const ok = await confirm({
      title: 'Delete purchase',
      message: `Delete ${row.cylindersCount} × ${formatNum(row.cylinderKg)} kg purchase?`,
    })
    if (!ok) return
    try {
      const { data } = await api.delete(`/utility/suppliers/${supplierId}/purchases/${row.id}`)
      applyLedger(data.data || {})
      if (editingPurchaseId === row.id) closePurchaseForm()
      showToast('Purchase deleted')
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
    if (!supplierId) {
      showToast('Select a gas supplier first', 'error')
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
      const body = { date: paymentDate, amount, note: paymentNote.trim() }
      if (editingPaymentId) {
        const { data } = await api.put(
          `/utility/suppliers/${supplierId}/payments/${editingPaymentId}`,
          body,
        )
        applyLedger(data.data || {})
        showToast('Payment updated')
      } else {
        const { data } = await api.post(`/utility/suppliers/${supplierId}/payments`, body)
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
      const { data } = await api.delete(`/utility/suppliers/${supplierId}/payments/${row.id}`)
      applyLedger(data.data || {})
      if (editingPaymentId === row.id) closePaymentForm()
      showToast('Payment deleted')
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    }
  }

  function resetBillForm() {
    setEditingBillId(null)
    setBillForm({ ...emptyBillForm(), date: billDate })
  }

  function closeBillForm() {
    setShowBillForm(false)
    resetBillForm()
  }

  function openCreateBill() {
    resetBillForm()
    setShowBillForm(true)
  }

  function openEditBill(row) {
    setEditingBillId(row.id)
    setBillForm({
      date: row.date,
      dueDate: row.dueDate || row.date || todayIso(),
      category: row.category,
      title: row.title,
      amount: String(row.amount),
      payStatus: row.payStatus === 'paid' ? 'paid' : 'unpaid',
      note: row.note || '',
    })
    setShowBillForm(true)
  }

  async function handleBillSubmit(e) {
    e.preventDefault()
    const title = billForm.title.trim()
    const amount = Number(billForm.amount)
    if (!billForm.date) {
      showToast('Date is required', 'error')
      return
    }
    if (!billForm.dueDate) {
      showToast('Due date is required', 'error')
      return
    }
    if (!billForm.category) {
      showToast('Category is required', 'error')
      return
    }
    if (!title) {
      showToast('Title is required', 'error')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('Amount must be a positive number', 'error')
      return
    }
    if (editingBillId && !canEdit) {
      showToast('Managers cannot edit records', 'error')
      return
    }
    setSavingBill(true)
    try {
      const body = {
        date: billForm.date,
        dueDate: billForm.dueDate,
        category: billForm.category,
        title,
        amount,
        payStatus: billForm.payStatus,
        note: billForm.note.trim(),
      }
      if (editingBillId) {
        const { data } = await api.put(`/utility/bills/${editingBillId}`, body)
        const payload = data.data || {}
        setBills(payload.items || [])
        setBillTotals(payload.totals || { dayTotal: 0, total: 0 })
        if (payload.date) setBillDate(payload.date)
        showToast('Utility bill updated')
      } else {
        const { data } = await api.post('/utility/bills', body)
        const payload = data.data || {}
        setBills(payload.items || [])
        setBillTotals(payload.totals || { dayTotal: 0, total: 0 })
        if (payload.date) setBillDate(payload.date)
        showToast('Utility bill added')
      }
      closeBillForm()
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setSavingBill(false)
    }
  }

  async function handleBillStatusChange(row, nextStatus) {
    if (row.payStatus === nextStatus) return
    if (row.payStatus === 'paid' && nextStatus === 'unpaid' && !isAdmin) {
      showToast('Only admin can mark a paid bill as unpaid', 'error')
      return
    }
    if (!row.dueDate && nextStatus === 'paid') {
      showToast('Set due date in the Due date column first, then mark as Paid', 'error')
      return
    }
    setStatusUpdatingId(row.id)
    try {
      const { data } = await api.patch(`/utility/bills/${row.id}/status`, {
        payStatus: nextStatus,
        listDate: billDate,
        dueDate: row.dueDate || undefined,
      })
      const payload = data.data || {}
      setBills(payload.items || [])
      setBillTotals(payload.totals || { dayTotal: 0, total: 0 })
      showToast(nextStatus === 'paid' ? 'Bill marked as Paid' : 'Bill marked as Unpaid')
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setStatusUpdatingId(null)
    }
  }

  async function handleBillDueDateChange(row, nextDueDate) {
    if (!nextDueDate) {
      showToast('Due date is required', 'error')
      return
    }
    if (row.dueDate === nextDueDate) return
    setDueUpdatingId(row.id)
    try {
      if (canEdit) {
        const { data } = await api.put(`/utility/bills/${row.id}`, {
          date: row.date,
          dueDate: nextDueDate,
          category: row.category,
          title: row.title,
          amount: row.amount,
          payStatus: row.payStatus === 'paid' ? 'paid' : 'unpaid',
          note: row.note || '',
        })
        const payload = data.data || {}
        setBills(payload.items || [])
        setBillTotals(payload.totals || { dayTotal: 0, total: 0 })
        if (payload.date) setBillDate(payload.date)
      } else {
        const { data } = await api.patch(`/utility/bills/${row.id}/status`, {
          payStatus: row.payStatus === 'paid' ? 'paid' : 'unpaid',
          dueDate: nextDueDate,
          listDate: billDate,
        })
        const payload = data.data || {}
        setBills(payload.items || [])
        setBillTotals(payload.totals || { dayTotal: 0, total: 0 })
      }
      showToast('Due date updated')
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setDueUpdatingId(null)
    }
  }

  async function handleDeleteBill(row) {
    const ok = await confirm({
      title: 'Delete bill',
      message: `Delete "${row.title}" (${formatMoney(row.amount)})?`,
    })
    if (!ok) return
    try {
      const { data } = await api.delete(`/utility/bills/${row.id}`, {
        params: { date: billDate },
      })
      const payload = data.data || {}
      setBills(payload.items || [])
      setBillTotals(payload.totals || { dayTotal: 0, total: 0 })
      if (editingBillId === row.id) closeBillForm()
      showToast('Utility bill deleted')
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    }
  }

  return (
    <div className="page-shell page-shell--wide">
      <header className="page-toolbar">
        <div>
          <h1>Utility Bills</h1>
          <p>Gas cylinders (suppliers + daily purchases + payments) aur baqi utility bills yahan manage karo.</p>
        </div>
      </header>

      <div className="form-grid form-grid--order" style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          className={tab === 'gas' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setTab('gas')}
        >
          Gas cylinders
        </button>
        <button
          type="button"
          className={tab === 'other' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setTab('other')}
        >
          Other utility bills
        </button>
      </div>

      {tab === 'gas' ? (
        <>
          <div className="page-toolbar" style={{ marginBottom: '0.75rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Gas suppliers</h2>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={() =>
                showSupplierForm && !editingSupplierId ? closeSupplierForm() : openCreateSupplier()
              }
            >
              {showSupplierForm && !editingSupplierId ? 'Cancel' : 'Add Gas Supplier'}
            </button>
          </div>

          {showSupplierForm && (
            <form className="card panel-form panel-form--stock" onSubmit={handleSupplierSubmit} noValidate>
              <div className="form-grid">
                <div>
                  <label htmlFor="gas-supplier-name">Name</label>
                  <input
                    id="gas-supplier-name"
                    type="text"
                    value={supplierForm.name}
                    onChange={(e) => setSupplierForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Ahmed Gas Agency"
                    required
                    maxLength={160}
                    autoFocus
                  />
                </div>
                <div>
                  <PhoneNumbersField
                    id="gas-supplier-contact"
                    label="Contact"
                    value={supplierForm.contact}
                    onChange={(next) => setSupplierForm((p) => ({ ...p, contact: next }))}
                  />
                </div>
                <div>
                  <label htmlFor="gas-supplier-note">Note (optional)</label>
                  <input
                    id="gas-supplier-note"
                    type="text"
                    value={supplierForm.note}
                    onChange={(e) => setSupplierForm((p) => ({ ...p, note: e.target.value }))}
                    maxLength={255}
                  />
                </div>
              </div>
              <div className="panel-form__actions">
                <button type="submit" className="btn-primary" disabled={savingSupplier}>
                  {savingSupplier ? 'Saving…' : editingSupplierId ? 'Update Supplier' : 'Save Supplier'}
                </button>
                {editingSupplierId && (
                  <button type="button" className="btn-secondary" onClick={closeSupplierForm} disabled={savingSupplier}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}

          <section className="card panel-form panel-form--stock">
            <div className="form-grid form-grid--order">
              <div>
                <label htmlFor="gas-supplier-select">Gas supplier</label>
                <select
                  id="gas-supplier-select"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  disabled={suppliersLoading}
                >
                  <option value="">
                    {suppliersLoading
                      ? 'Loading…'
                      : suppliers.length
                        ? 'Select gas supplier (or click a row)'
                        : 'No gas suppliers yet'}
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
                  <th>Note</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="stock-table__empty">
                      No gas suppliers yet. Click Add Gas Supplier.
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
                      <td>{formatContactDisplay(row.contact)}</td>
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
            <p className="help-muted">Select a gas supplier to manage cylinder purchases and payments.</p>
          ) : ledgerLoading ? (
            <p className="help-muted">Loading ledger…</p>
          ) : !supplier ? (
            <p className="help-muted">Gas supplier not found.</p>
          ) : (
            <>
              <section className="card stock-totals stock-totals--split bills-shop-card">
                <div>
                  <span className="stock-totals__label">Supplier</span>
                  <strong className="stock-totals__value">{supplier.name}</strong>
                  <p className="help-muted" style={{ marginTop: '0.35rem' }}>
                    {formatContactDisplay(supplier.contact)}
                    {supplier.note ? ` · ${supplier.note}` : ''}
                  </p>
                </div>
              </section>

              <section className="stock-totals card stock-totals--split">
                <div>
                  <span className="stock-totals__label">Purchased</span>
                  <strong className="stock-totals__value">{formatMoney(summary.totalPurchased)}</strong>
                  <p className="help-muted" style={{ marginTop: '0.35rem' }}>
                    {formatNum(summary.totalCylinders)} cyl · {formatNum(summary.totalKg)} kg
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
                    <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Cylinder purchases</h2>
                  </div>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() =>
                      showPurchaseForm && !editingPurchaseId
                        ? closePurchaseForm()
                        : openCreatePurchase()
                    }
                  >
                    {showPurchaseForm && !editingPurchaseId ? 'Cancel' : 'Add Purchase'}
                  </button>
                </div>

                {showPurchaseForm && (
                  <form className="card panel-form panel-form--stock" onSubmit={handlePurchaseSubmit}>
                    <div className="form-grid form-grid--order">
                      <div>
                        <label htmlFor="gas-purchase-date">Date</label>
                        <input
                          id="gas-purchase-date"
                          type="date"
                          value={purchaseForm.date}
                          onChange={(e) => setPurchaseForm((p) => ({ ...p, date: e.target.value }))}
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="gas-purchase-due">Due date</label>
                        <input
                          id="gas-purchase-due"
                          type="date"
                          value={purchaseForm.dueDate}
                          onChange={(e) =>
                            setPurchaseForm((p) => ({ ...p, dueDate: e.target.value }))
                          }
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="gas-purchase-kg">Cylinder kg</label>
                        <input
                          id="gas-purchase-kg"
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={purchaseForm.cylinderKg}
                          onChange={(e) =>
                            setPurchaseForm((p) => ({ ...p, cylinderKg: e.target.value }))
                          }
                          placeholder="e.g. 11.8 / 15 / 45"
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="gas-purchase-count">Cylinders</label>
                        <input
                          id="gas-purchase-count"
                          type="number"
                          min="1"
                          step="1"
                          value={purchaseForm.cylindersCount}
                          onChange={(e) =>
                            setPurchaseForm((p) => ({ ...p, cylindersCount: e.target.value }))
                          }
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="gas-purchase-price">Price / kg (Rs)</label>
                        <input
                          id="gas-purchase-price"
                          type="number"
                          min="1"
                          step="1"
                          value={purchaseForm.pricePerKg}
                          onChange={(e) =>
                            setPurchaseForm((p) => ({ ...p, pricePerKg: e.target.value }))
                          }
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="gas-purchase-note">Note (optional)</label>
                        <input
                          id="gas-purchase-note"
                          type="text"
                          value={purchaseForm.note}
                          onChange={(e) => setPurchaseForm((p) => ({ ...p, note: e.target.value }))}
                          maxLength={255}
                        />
                      </div>
                    </div>
                    <p className="help-muted">
                      Total: <strong>{formatMoney(purchasePreviewTotal)}</strong>
                    </p>
                    <div className="panel-form__actions">
                      <button type="submit" className="btn-primary" disabled={savingPurchase}>
                        {savingPurchase
                          ? 'Saving…'
                          : editingPurchaseId
                            ? 'Update Purchase'
                            : 'Save Purchase'}
                      </button>
                      {editingPurchaseId && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={closePurchaseForm}
                          disabled={savingPurchase}
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
                        <th>Due date</th>
                        <th>Kg</th>
                        <th>Cylinders</th>
                        <th>Price / kg</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Note</th>
                        <th aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {purchases.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="stock-table__empty">
                            No cylinder purchases yet.
                          </td>
                        </tr>
                      ) : (
                        purchases.map((row) => (
                          <tr key={row.id}>
                            <td>{formatDateDisplay(row.date)}</td>
                            <td>{row.dueDate ? formatDateDisplay(row.dueDate) : '—'}</td>
                            <td>{formatNum(row.cylinderKg)}</td>
                            <td>{row.cylindersCount}</td>
                            <td>{formatMoney(row.pricePerKg)}</td>
                            <td>{formatMoney(row.totalAmount)}</td>
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
                                  onClick={() => openEditPurchase(row)}
                                >
                                  Edit
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  type="button"
                                  className="btn-danger btn-compact"
                                  onClick={() => handleDeletePurchase(row)}
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
                        <label htmlFor="gas-pay-date">Date</label>
                        <input
                          id="gas-pay-date"
                          type="date"
                          value={paymentDate}
                          onChange={(e) => setPaymentDate(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="gas-pay-amount">Amount (Rs)</label>
                        <input
                          id="gas-pay-amount"
                          type="number"
                          min="1"
                          step="1"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="gas-pay-note">Note (optional)</label>
                        <input
                          id="gas-pay-note"
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
        </>
      ) : (
        <>
          <div className="page-toolbar" style={{ marginBottom: '0.75rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Other utility bills</h2>
              <p className="help-muted" style={{ margin: '0.25rem 0 0' }}>
                Electricity, water, internet, wagaira.
              </p>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={() => (showBillForm && !editingBillId ? closeBillForm() : openCreateBill())}
            >
              {showBillForm && !editingBillId ? 'Cancel' : 'Add Bill'}
            </button>
          </div>

          <section className="card panel-form panel-form--stock">
            <div className="form-grid form-grid--order">
              <div>
                <label htmlFor="utility-bill-date">Date</label>
                <input
                  id="utility-bill-date"
                  type="date"
                  value={billDate}
                  onChange={(e) => setBillDate(e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="stock-totals card stock-totals--split">
            <div>
              <span className="stock-totals__label">Selected day</span>
              <strong className="stock-totals__value">{formatMoney(billTotals.dayTotal)}</strong>
            </div>
            <div>
              <span className="stock-totals__label">All-time</span>
              <strong className="stock-totals__value">{formatMoney(billTotals.total)}</strong>
            </div>
          </section>

          {showBillForm && (
            <form className="card panel-form panel-form--stock" onSubmit={handleBillSubmit}>
              <div className="form-grid form-grid--order">
                <div>
                  <label htmlFor="ub-date">Date</label>
                  <input
                    id="ub-date"
                    type="date"
                    value={billForm.date}
                    onChange={(e) => setBillForm((p) => ({ ...p, date: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="ub-due">Due date</label>
                  <input
                    id="ub-due"
                    type="date"
                    value={billForm.dueDate}
                    onChange={(e) => setBillForm((p) => ({ ...p, dueDate: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="ub-category">Category</label>
                  <select
                    id="ub-category"
                    value={billForm.category}
                    onChange={(e) => setBillForm((p) => ({ ...p, category: e.target.value }))}
                  >
                    {OTHER_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="ub-title">Title</label>
                  <input
                    id="ub-title"
                    type="text"
                    value={billForm.title}
                    onChange={(e) => setBillForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. WAPDA March bill"
                    required
                    maxLength={160}
                  />
                </div>
                <div>
                  <label htmlFor="ub-amount">Amount (Rs)</label>
                  <input
                    id="ub-amount"
                    type="number"
                    min="1"
                    step="1"
                    value={billForm.amount}
                    onChange={(e) => setBillForm((p) => ({ ...p, amount: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="ub-status">Payment status</label>
                  <select
                    id="ub-status"
                    value={billForm.payStatus}
                    onChange={(e) => setBillForm((p) => ({ ...p, payStatus: e.target.value }))}
                  >
                    <option value="unpaid">Unpaid</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="ub-note">Note (optional)</label>
                  <input
                    id="ub-note"
                    type="text"
                    value={billForm.note}
                    onChange={(e) => setBillForm((p) => ({ ...p, note: e.target.value }))}
                    maxLength={255}
                  />
                </div>
              </div>
              <div className="panel-form__actions">
                <button type="submit" className="btn-primary" disabled={savingBill}>
                  {savingBill ? 'Saving…' : editingBillId ? 'Update Bill' : 'Save Bill'}
                </button>
                {editingBillId && (
                  <button type="button" className="btn-secondary" onClick={closeBillForm} disabled={savingBill}>
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
                  <th>Due date</th>
                  <th>Category</th>
                  <th>Title</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Note</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {billsLoading ? (
                  <tr>
                    <td colSpan={8} className="stock-table__empty">
                      Loading…
                    </td>
                  </tr>
                ) : bills.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="stock-table__empty">
                      No utility bills for this day.
                    </td>
                  </tr>
                ) : (
                  bills.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDateDisplay(row.date)}</td>
                      <td>
                        {canEdit || !row.dueDate ? (
                          <input
                            type="date"
                            value={row.dueDate || ''}
                            disabled={dueUpdatingId === row.id}
                            onChange={(e) => handleBillDueDateChange(row, e.target.value)}
                            aria-label={`Due date for ${row.title}`}
                            style={{ minWidth: '9.5rem' }}
                          />
                        ) : (
                          formatDateDisplay(row.dueDate)
                        )}
                      </td>
                      <td>{row.category}</td>
                      <td>{row.title}</td>
                      <td>{formatMoney(row.amount)}</td>
                      <td>
                        <select
                          value={row.payStatus === 'paid' ? 'paid' : 'unpaid'}
                          disabled={statusUpdatingId === row.id}
                          onChange={(e) => handleBillStatusChange(row, e.target.value)}
                          aria-label={`Payment status for ${row.title}`}
                          className={`status-pill status-pill--${row.payStatus === 'paid' ? 'paid' : 'unpaid'}`}
                          style={{
                            minWidth: '6.5rem',
                            fontWeight: 600,
                            cursor: statusUpdatingId === row.id ? 'wait' : 'pointer',
                          }}
                        >
                          <option value="unpaid">Unpaid</option>
                          <option value="paid">Paid</option>
                        </select>
                      </td>
                      <td className="stock-table__wrap">{row.note || '—'}</td>
                      <td className="stock-table__actions">
                        {canEdit && (
                          <button
                            type="button"
                            className="btn-secondary btn-compact"
                            onClick={() => openEditBill(row)}
                          >
                            Edit
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            className="btn-danger btn-compact"
                            onClick={() => handleDeleteBill(row)}
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
        </>
      )}
    </div>
  )
}

export default UtilityBillsPage
