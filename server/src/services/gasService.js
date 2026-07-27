import {
  deleteGasPaymentById,
  deleteGasPurchaseById,
  deleteGasSupplierById,
  deleteUtilityBillById,
  findAllGasPurchasesWithSupplier,
  findAllGasSuppliers,
  findGasPaymentById,
  findGasPurchaseById,
  findGasSupplierById,
  findGasSupplierByName,
  findPaymentsByGasSupplierId,
  findPurchasesByGasSupplierId,
  findUnpaidUtilityBillsDueBy,
  findUtilityBillById,
  findUtilityBillsByDate,
  insertGasPayment,
  insertGasPurchase,
  insertGasSupplier,
  insertUtilityBill,
  sumAllUtilityBills,
  sumPaymentsByGasSupplierId,
  sumPurchasesByGasSupplierId,
  sumUtilityBillsByDate,
  updateGasPaymentById,
  updateGasPurchaseById,
  updateGasSupplierById,
  updateUtilityBillById,
} from '../repositories/gasRepository.js'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const CONTACT_RE = /^\d{11}$/

function badRequest(message) {
  const error = new Error(message)
  error.status = 400
  return error
}

function notFound(message) {
  const error = new Error(message)
  error.status = 404
  return error
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function addDaysIso(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function formatMoneyEn(amount) {
  return `Rs ${Number(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

function formatDueDateEn(isoDate) {
  const d = new Date(`${isoDate}T00:00:00.000Z`)
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function normalizeDate(dateInput) {
  const raw = String(dateInput || '').trim()
  if (DATE_RE.test(raw)) return raw
  return todayIso()
}

function allocatePurchaseStatuses(purchases, totalPaid) {
  let remainingPaid = Number(totalPaid) || 0
  return purchases.map((row) => {
    const amount = Number(row.totalAmount) || 0
    let payStatus = 'unpaid'
    let paidAmount = 0
    if (remainingPaid <= 0) {
      payStatus = 'unpaid'
    } else if (remainingPaid + 1e-9 >= amount) {
      payStatus = 'paid'
      paidAmount = amount
      remainingPaid = Number((remainingPaid - amount).toFixed(2))
    } else {
      payStatus = 'partial'
      paidAmount = remainingPaid
      remainingPaid = 0
    }
    return {
      ...row,
      payStatus,
      paidAmount,
      dueAmount: Number((amount - paidAmount).toFixed(2)),
    }
  })
}

function normalizeSupplierInput(body = {}) {
  const name = String(body.name || '').trim()
  const contact = String(body.contact || '').trim()
  const note = String(body.note || '').trim().slice(0, 255)
  if (!name) throw badRequest('Gas supplier name is required')
  if (name.length > 160) throw badRequest('Name must be 160 characters or less')
  if (!CONTACT_RE.test(contact)) throw badRequest('Contact must be exactly 11 digits')
  return { name, contact, note }
}

function normalizePurchaseInput(body = {}) {
  const date = String(body.date || '').trim()
  const dueDate = String(body.dueDate ?? body.due_date ?? '').trim()
  const note = String(body.note || '').trim().slice(0, 255)
  const cylinderKg = Number(body.cylinderKg ?? body.cylinder_kg)
  const cylindersCount = Number(body.cylindersCount ?? body.cylinders_count)
  const pricePerKg = Number(
    body.pricePerKg ?? body.price_per_kg ?? body.pricePerCylinder ?? body.price_per_cylinder,
  )
  if (!DATE_RE.test(date)) throw badRequest('Date is required (YYYY-MM-DD)')
  if (!DATE_RE.test(dueDate)) throw badRequest('Due date is required (YYYY-MM-DD)')
  if (!Number.isFinite(cylinderKg) || cylinderKg <= 0) {
    throw badRequest('Cylinder kg must be a positive number')
  }
  if (!Number.isInteger(cylindersCount) || cylindersCount <= 0) {
    throw badRequest('Cylinders count must be a positive whole number')
  }
  if (!Number.isFinite(pricePerKg) || pricePerKg <= 0) {
    throw badRequest('Price per kg must be a positive number')
  }
  const totalKg = Number((cylinderKg * cylindersCount).toFixed(2))
  const totalAmount = Number((totalKg * pricePerKg).toFixed(2))
  return {
    date,
    dueDate,
    cylinderKg: Number(cylinderKg.toFixed(2)),
    cylindersCount,
    pricePerKg: Number(pricePerKg.toFixed(2)),
    totalAmount,
    note,
  }
}

function normalizePaymentInput(body = {}) {
  const date = String(body.date || '').trim()
  const note = String(body.note || '').trim().slice(0, 255)
  const amount = Number(body.amount)
  if (!DATE_RE.test(date)) throw badRequest('Date is required (YYYY-MM-DD)')
  if (!Number.isFinite(amount) || amount <= 0) {
    throw badRequest('Amount must be a positive number')
  }
  return { date, amount: Number(amount.toFixed(2)), note }
}

function normalizeUtilityBillInput(body = {}) {
  const date = String(body.date || '').trim()
  const dueDate = String(body.dueDate ?? body.due_date ?? '').trim()
  const category = String(body.category || '').trim().slice(0, 80)
  const title = String(body.title || '').trim().slice(0, 160)
  const note = String(body.note || '').trim().slice(0, 255)
  const amount = Number(body.amount)
  const payStatusRaw = String(body.payStatus ?? body.pay_status ?? 'unpaid').trim().toLowerCase()
  const payStatus = payStatusRaw === 'paid' ? 'paid' : 'unpaid'
  if (!DATE_RE.test(date)) throw badRequest('Date is required (YYYY-MM-DD)')
  if (!DATE_RE.test(dueDate)) throw badRequest('Due date is required (YYYY-MM-DD)')
  if (!category) throw badRequest('Category is required')
  if (!title) throw badRequest('Title is required')
  if (!Number.isFinite(amount) || amount <= 0) {
    throw badRequest('Amount must be a positive number')
  }
  return {
    date,
    dueDate,
    category,
    title,
    amount: Number(amount.toFixed(2)),
    payStatus,
    note,
  }
}

export async function listGasSuppliers() {
  return findAllGasSuppliers()
}

export async function createGasSupplier(body = {}) {
  const payload = normalizeSupplierInput(body)
  const existing = await findGasSupplierByName(payload.name)
  if (existing) {
    const error = new Error('A gas supplier with this name already exists')
    error.status = 409
    throw error
  }
  return insertGasSupplier(payload)
}

export async function updateGasSupplier(idInput, body = {}) {
  const id = Number(idInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid supplier id')
  const existing = await findGasSupplierById(id)
  if (!existing) throw notFound('Gas supplier not found')
  const payload = normalizeSupplierInput(body)
  const byName = await findGasSupplierByName(payload.name)
  if (byName && byName.id !== id) {
    const error = new Error('A gas supplier with this name already exists')
    error.status = 409
    throw error
  }
  const updated = await updateGasSupplierById(id, payload)
  if (!updated) throw notFound('Gas supplier not found')
  return updated
}

export async function removeGasSupplier(idInput) {
  const id = Number(idInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid supplier id')
  const existing = await findGasSupplierById(id)
  if (!existing) throw notFound('Gas supplier not found')
  const purchases = await sumPurchasesByGasSupplierId(id)
  const payments = await sumPaymentsByGasSupplierId(id)
  if (purchases > 0 || payments > 0) {
    const error = new Error('Cannot delete gas supplier with purchase or payment history')
    error.status = 409
    throw error
  }
  const deleted = await deleteGasSupplierById(id)
  if (!deleted) throw notFound('Gas supplier not found')
  return { deleted: true }
}

export async function getGasSupplierLedger(supplierIdInput) {
  const id = Number(supplierIdInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid supplier id')
  const supplier = await findGasSupplierById(id)
  if (!supplier) throw notFound('Gas supplier not found')

  const purchasesRaw = await findPurchasesByGasSupplierId(id)
  const totalPaid = await sumPaymentsByGasSupplierId(id)
  const purchases = allocatePurchaseStatuses(purchasesRaw, totalPaid)
  const payments = await findPaymentsByGasSupplierId(id)

  const totalPurchased = Number(
    purchasesRaw.reduce((sum, row) => sum + Number(row.totalAmount || 0), 0).toFixed(2),
  )
  const paid = Number(Number(totalPaid).toFixed(2))
  const remaining = Number((totalPurchased - paid).toFixed(2))
  const advance = remaining < 0 ? Number(Math.abs(remaining).toFixed(2)) : 0
  const totalCylinders = purchasesRaw.reduce((sum, row) => sum + Number(row.cylindersCount || 0), 0)
  const totalKg = Number(
    purchasesRaw
      .reduce((sum, row) => sum + Number(row.cylinderKg || 0) * Number(row.cylindersCount || 0), 0)
      .toFixed(2),
  )

  return {
    supplier,
    summary: {
      totalPurchased,
      totalPaid: paid,
      remaining: remaining > 0 ? remaining : 0,
      advance,
      totalCylinders,
      totalKg,
    },
    purchases,
    payments,
  }
}

export async function createGasPurchase(supplierIdInput, body = {}) {
  const id = Number(supplierIdInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid supplier id')
  const supplier = await findGasSupplierById(id)
  if (!supplier) throw notFound('Gas supplier not found')
  const payload = normalizePurchaseInput(body)
  const purchase = await insertGasPurchase({ supplierId: id, ...payload })
  const ledger = await getGasSupplierLedger(id)
  return { purchase, ...ledger }
}

export async function updateGasPurchase(supplierIdInput, purchaseIdInput, body = {}) {
  const supplierId = Number(supplierIdInput)
  const purchaseId = Number(purchaseIdInput)
  if (!Number.isInteger(supplierId) || supplierId <= 0) throw badRequest('Invalid supplier id')
  if (!Number.isInteger(purchaseId) || purchaseId <= 0) throw badRequest('Invalid purchase id')
  const existing = await findGasPurchaseById(purchaseId)
  if (!existing || existing.supplierId !== supplierId) throw notFound('Gas purchase not found')
  const payload = normalizePurchaseInput(body)
  const purchase = await updateGasPurchaseById(purchaseId, payload)
  if (!purchase) throw notFound('Gas purchase not found')
  const ledger = await getGasSupplierLedger(supplierId)
  return { purchase, ...ledger }
}

export async function removeGasPurchase(supplierIdInput, purchaseIdInput) {
  const supplierId = Number(supplierIdInput)
  const purchaseId = Number(purchaseIdInput)
  if (!Number.isInteger(supplierId) || supplierId <= 0) throw badRequest('Invalid supplier id')
  if (!Number.isInteger(purchaseId) || purchaseId <= 0) throw badRequest('Invalid purchase id')
  const existing = await findGasPurchaseById(purchaseId)
  if (!existing || existing.supplierId !== supplierId) throw notFound('Gas purchase not found')
  const deleted = await deleteGasPurchaseById(purchaseId)
  if (!deleted) throw notFound('Gas purchase not found')
  const ledger = await getGasSupplierLedger(supplierId)
  return { deleted: true, ...ledger }
}

export async function createGasPayment(supplierIdInput, body = {}) {
  const id = Number(supplierIdInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid supplier id')
  const supplier = await findGasSupplierById(id)
  if (!supplier) throw notFound('Gas supplier not found')
  const payload = normalizePaymentInput(body)
  const payment = await insertGasPayment({ supplierId: id, ...payload })
  const ledger = await getGasSupplierLedger(id)
  return { payment, ...ledger }
}

export async function updateGasPayment(supplierIdInput, paymentIdInput, body = {}) {
  const supplierId = Number(supplierIdInput)
  const paymentId = Number(paymentIdInput)
  if (!Number.isInteger(supplierId) || supplierId <= 0) throw badRequest('Invalid supplier id')
  if (!Number.isInteger(paymentId) || paymentId <= 0) throw badRequest('Invalid payment id')
  const existing = await findGasPaymentById(paymentId)
  if (!existing || existing.supplierId !== supplierId) throw notFound('Gas payment not found')
  const payload = normalizePaymentInput(body)
  const payment = await updateGasPaymentById(paymentId, payload)
  if (!payment) throw notFound('Gas payment not found')
  const ledger = await getGasSupplierLedger(supplierId)
  return { payment, ...ledger }
}

export async function removeGasPayment(supplierIdInput, paymentIdInput) {
  const supplierId = Number(supplierIdInput)
  const paymentId = Number(paymentIdInput)
  if (!Number.isInteger(supplierId) || supplierId <= 0) throw badRequest('Invalid supplier id')
  if (!Number.isInteger(paymentId) || paymentId <= 0) throw badRequest('Invalid payment id')
  const existing = await findGasPaymentById(paymentId)
  if (!existing || existing.supplierId !== supplierId) throw notFound('Gas payment not found')
  const deleted = await deleteGasPaymentById(paymentId)
  if (!deleted) throw notFound('Gas payment not found')
  const ledger = await getGasSupplierLedger(supplierId)
  return { deleted: true, ...ledger }
}

export async function listUtilityBills(query = {}) {
  const date = normalizeDate(query.date)
  const items = await findUtilityBillsByDate(date)
  const dayTotal = await sumUtilityBillsByDate(date)
  const total = await sumAllUtilityBills()
  return { date, items, totals: { dayTotal, total } }
}

export async function createUtilityBill(body = {}) {
  const payload = normalizeUtilityBillInput(body)
  const bill = await insertUtilityBill(payload)
  const list = await listUtilityBills({ date: payload.date })
  return { bill, ...list }
}

export async function updateUtilityBill(idInput, body = {}) {
  const id = Number(idInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid bill id')
  const existing = await findUtilityBillById(id)
  if (!existing) throw notFound('Utility bill not found')
  const payload = normalizeUtilityBillInput(body)
  const bill = await updateUtilityBillById(id, payload)
  if (!bill) throw notFound('Utility bill not found')
  const list = await listUtilityBills({ date: payload.date })
  return { bill, ...list }
}

export async function updateUtilityBillStatus(idInput, body = {}, user = {}) {
  const id = Number(idInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid bill id')
  const existing = await findUtilityBillById(id)
  if (!existing) throw notFound('Utility bill not found')

  const payStatusRaw = String(body.payStatus ?? body.pay_status ?? '').trim().toLowerCase()
  if (payStatusRaw !== 'paid' && payStatusRaw !== 'unpaid') {
    throw badRequest('Payment status must be paid or unpaid')
  }

  const role = user?.role === 'manager' ? 'manager' : 'admin'
  if (payStatusRaw === 'unpaid' && existing.payStatus === 'paid' && role !== 'admin') {
    const error = new Error('Only admin can mark a paid bill as unpaid')
    error.status = 403
    throw error
  }

  let dueDate = existing.dueDate || ''
  const incomingDue = String(body.dueDate ?? body.due_date ?? '').trim()
  if (DATE_RE.test(incomingDue)) {
    dueDate = incomingDue
  }
  if (!DATE_RE.test(dueDate)) {
    throw badRequest('Due date is required before marking payment status')
  }

  const bill = await updateUtilityBillById(id, {
    date: existing.date,
    dueDate,
    category: existing.category,
    title: existing.title,
    amount: existing.amount,
    payStatus: payStatusRaw,
    note: existing.note,
  })
  if (!bill) throw notFound('Utility bill not found')
  const listDate = normalizeDate(body.listDate ?? body.date ?? existing.date)
  const list = await listUtilityBills({ date: listDate })
  return { bill, ...list }
}

export async function removeUtilityBill(idInput, query = {}) {
  const id = Number(idInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid bill id')
  const existing = await findUtilityBillById(id)
  if (!existing) throw notFound('Utility bill not found')
  const deleted = await deleteUtilityBillById(id)
  if (!deleted) throw notFound('Utility bill not found')
  const date = normalizeDate(query.date || existing.date)
  const list = await listUtilityBills({ date })
  return { deleted: true, ...list }
}

export async function listDueReminders(query = {}) {
  const today = normalizeDate(query.date || todayIso())
  const reminderCutoff = addDaysIso(today, 2)
  const reminders = []

  const utilityBills = await findUnpaidUtilityBillsDueBy(reminderCutoff)
  for (const bill of utilityBills) {
    const overdue = bill.dueDate < today
    const statusPhrase = overdue
      ? 'is unpaid and overdue'
      : 'is unpaid'
    const duePhrase = overdue
      ? `Due date was ${formatDueDateEn(bill.dueDate)}`
      : `Due date is ${formatDueDateEn(bill.dueDate)}`
    reminders.push({
      id: `utility-bill-${bill.id}`,
      kind: 'utility_bill',
      refId: bill.id,
      dueDate: bill.dueDate,
      payStatus: 'unpaid',
      amount: bill.amount,
      overdue,
      message:
        `Payment reminder: Your ${bill.category} bill "${bill.title}" (${formatMoneyEn(bill.amount)}) ${statusPhrase}. ${duePhrase}. Please pay this bill to avoid late charges.`,
    })
  }

  const purchases = await findAllGasPurchasesWithSupplier()
  const bySupplier = new Map()
  for (const row of purchases) {
    if (!bySupplier.has(row.supplierId)) bySupplier.set(row.supplierId, [])
    bySupplier.get(row.supplierId).push(row)
  }

  for (const [supplierId, supplierPurchases] of bySupplier.entries()) {
    const totalPaid = await sumPaymentsByGasSupplierId(supplierId)
    const withStatus = allocatePurchaseStatuses(supplierPurchases, totalPaid)
    for (const purchase of withStatus) {
      if (!purchase.dueDate || purchase.dueDate > reminderCutoff) continue
      if (purchase.payStatus === 'paid') continue
      const overdue = purchase.dueDate < today
      const statusLabel = purchase.payStatus === 'partial' ? 'partially paid' : 'unpaid'
      const statusPhrase = overdue
        ? `is ${statusLabel} and overdue`
        : `is ${statusLabel}`
      const duePhrase = overdue
        ? `Due date was ${formatDueDateEn(purchase.dueDate)}`
        : `Due date is ${formatDueDateEn(purchase.dueDate)}`
      const remainingNote = purchase.payStatus === 'partial'
        ? ` Remaining balance: ${formatMoneyEn(purchase.dueAmount)}.`
        : ''
      reminders.push({
        id: `gas-purchase-${purchase.id}`,
        kind: 'gas_purchase',
        refId: purchase.id,
        supplierId,
        dueDate: purchase.dueDate,
        payStatus: purchase.payStatus,
        amount: purchase.totalAmount,
        overdue,
        message:
          `Payment reminder: Gas cylinder purchase from ${purchase.supplierName} (${formatMoneyEn(purchase.totalAmount)}) ${statusPhrase}. ${duePhrase}.${remainingNote} Please clear this payment.`,
      })
    }
  }

  reminders.sort((a, b) => {
    if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1
    return String(a.id).localeCompare(String(b.id))
  })

  return { today, reminderCutoff, count: reminders.length, reminders }
}
