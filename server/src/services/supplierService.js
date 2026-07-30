import {
  deleteSupplierById,
  findAllSuppliers,
  findPurchasesBySupplierId,
  findSupplierById,
  findSupplierByName,
  insertSupplier,
  sumPurchasesBySupplierId,
  updateSupplierById,
} from '../repositories/supplierRepository.js'
import {
  deleteSupplierPaymentById,
  findPaymentsBySupplierId,
  findSupplierPaymentById,
  insertSupplierPayment,
  sumPaymentsBySupplierId,
  updateSupplierPaymentById,
} from '../repositories/supplierPaymentRepository.js'
import {
  deletePreviousBalanceById,
  findPreviousBalanceById,
  findPreviousBalancesBySupplierId,
  insertPreviousBalance,
  sumPreviousBalancesBySupplierId,
  updatePreviousBalanceById,
} from '../repositories/supplierPreviousBalanceRepository.js'
import { normalizeContactNumbers } from '../utils/contactNumbers.js'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

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

function normalizeSupplierInput(body = {}) {
  const name = String(body.name || '').trim()
  if (!name) throw badRequest('Supplier name is required')
  if (name.length > 160) throw badRequest('Supplier name must be 160 characters or less')
  const contact = normalizeContactNumbers(body.contact, { fieldLabel: 'Contact' })
  if (!contact.ok) throw badRequest(contact.error)
  return { name, contact: contact.value }
}

function normalizePaymentInput(body = {}) {
  const date = String(body.date || '').trim()
  if (!DATE_RE.test(date)) throw badRequest('Date is required (YYYY-MM-DD)')
  const amount = Number(body.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw badRequest('Amount must be a positive number')
  }
  const note = String(body.note || '').trim().slice(0, 255)
  return { date, amount: Number(amount.toFixed(2)), note }
}

function normalizePreviousBalanceInput(body = {}) {
  const date = String(body.date || '').trim()
  if (!DATE_RE.test(date)) throw badRequest('Date is required (YYYY-MM-DD)')
  const amount = Number(body.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw badRequest('Amount must be a positive number')
  }
  const note = String(body.note || '').trim().slice(0, 255)
  return {
    date,
    amount: Number(amount.toFixed(2)),
    note: note || 'Previous balance',
  }
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

function sortPurchasesByDate(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  if (a.source !== b.source) return a.source === 'previous' ? -1 : 1
  return Number(a.refId || 0) - Number(b.refId || 0)
}

export async function listSuppliers() {
  return findAllSuppliers()
}

export async function createSupplier(body = {}) {
  const payload = normalizeSupplierInput(body)
  const existing = await findSupplierByName(payload.name)
  if (existing) {
    const error = new Error('A supplier with this name already exists')
    error.status = 409
    throw error
  }
  return insertSupplier(payload)
}

export async function updateSupplier(idInput, body = {}) {
  const id = Number(idInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid supplier id')
  const existing = await findSupplierById(id)
  if (!existing) throw notFound('Supplier not found')

  const payload = normalizeSupplierInput(body)
  const byName = await findSupplierByName(payload.name)
  if (byName && byName.id !== id) {
    const error = new Error('A supplier with this name already exists')
    error.status = 409
    throw error
  }
  const updated = await updateSupplierById(id, payload)
  if (!updated) throw notFound('Supplier not found')
  return updated
}

export async function removeSupplier(idInput) {
  const id = Number(idInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid supplier id')
  const existing = await findSupplierById(id)
  if (!existing) throw notFound('Supplier not found')

  const purchases = await sumPurchasesBySupplierId(id)
  const previous = await sumPreviousBalancesBySupplierId(id)
  const payments = await sumPaymentsBySupplierId(id)
  if (purchases > 0 || previous > 0 || payments > 0) {
    const error = new Error(
      'Cannot delete supplier with purchase, previous balance, or payment history. Clear linked stock/payments first.',
    )
    error.status = 409
    throw error
  }

  const deleted = await deleteSupplierById(id)
  if (!deleted) throw notFound('Supplier not found')
  return { deleted: true }
}

export async function getSupplierLedger(supplierIdInput) {
  const id = Number(supplierIdInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid supplier id')

  const supplier = await findSupplierById(id)
  if (!supplier) throw notFound('Supplier not found')

  const stockPurchases = (await findPurchasesBySupplierId(id)).map((row) => ({
    ...row,
    id: `stock-${row.id}`,
    source: 'stock',
    refId: row.id,
    stockId: row.id,
    note: '',
  }))

  const previousRows = await findPreviousBalancesBySupplierId(id)
  const previousPurchases = previousRows.map((row) => ({
    id: `previous-${row.id}`,
    source: 'previous',
    refId: row.id,
    previousBalanceId: row.id,
    stockId: null,
    date: row.date,
    bags: 0,
    kg: 0,
    pricePerKg: 0,
    totalAmount: Number(row.amount) || 0,
    materialName: row.note || 'Previous balance',
    materialSlug: '',
    materialSwatch: '',
    supplierName: supplier.name,
    note: row.note || 'Previous balance',
  }))

  const purchasesRaw = [...previousPurchases, ...stockPurchases].sort(sortPurchasesByDate)
  const totalPaid = await sumPaymentsBySupplierId(id)
  const purchases = allocatePurchaseStatuses(purchasesRaw, totalPaid)
  const payments = await findPaymentsBySupplierId(id)

  const totalPurchased = Number(
    purchasesRaw.reduce((sum, row) => sum + Number(row.totalAmount || 0), 0).toFixed(2),
  )
  const paid = Number(Number(totalPaid).toFixed(2))
  const remaining = Number((totalPurchased - paid).toFixed(2))
  const advance = remaining < 0 ? Number(Math.abs(remaining).toFixed(2)) : 0

  return {
    supplier,
    summary: {
      totalPurchased,
      totalPaid: paid,
      remaining: remaining > 0 ? remaining : 0,
      advance,
    },
    purchases,
    payments,
  }
}

export async function createSupplierPayment(supplierIdInput, body = {}) {
  const id = Number(supplierIdInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid supplier id')
  const supplier = await findSupplierById(id)
  if (!supplier) throw notFound('Supplier not found')

  const payload = normalizePaymentInput(body)
  const payment = await insertSupplierPayment({
    supplierId: id,
    ...payload,
  })
  const ledger = await getSupplierLedger(id)
  return { payment, ...ledger }
}

export async function updateSupplierPayment(supplierIdInput, paymentIdInput, body = {}) {
  const supplierId = Number(supplierIdInput)
  const paymentId = Number(paymentIdInput)
  if (!Number.isInteger(supplierId) || supplierId <= 0) throw badRequest('Invalid supplier id')
  if (!Number.isInteger(paymentId) || paymentId <= 0) throw badRequest('Invalid payment id')

  const existing = await findSupplierPaymentById(paymentId)
  if (!existing || existing.supplierId !== supplierId) throw notFound('Payment not found')

  const payload = normalizePaymentInput(body)
  const payment = await updateSupplierPaymentById(paymentId, payload)
  if (!payment) throw notFound('Payment not found')
  const ledger = await getSupplierLedger(supplierId)
  return { payment, ...ledger }
}

export async function removeSupplierPayment(supplierIdInput, paymentIdInput) {
  const supplierId = Number(supplierIdInput)
  const paymentId = Number(paymentIdInput)
  if (!Number.isInteger(supplierId) || supplierId <= 0) throw badRequest('Invalid supplier id')
  if (!Number.isInteger(paymentId) || paymentId <= 0) throw badRequest('Invalid payment id')

  const existing = await findSupplierPaymentById(paymentId)
  if (!existing || existing.supplierId !== supplierId) throw notFound('Payment not found')

  const deleted = await deleteSupplierPaymentById(paymentId)
  if (!deleted) throw notFound('Payment not found')
  const ledger = await getSupplierLedger(supplierId)
  return { deleted: true, ...ledger }
}

export async function createSupplierPreviousBalance(supplierIdInput, body = {}) {
  const id = Number(supplierIdInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid supplier id')
  const supplier = await findSupplierById(id)
  if (!supplier) throw notFound('Supplier not found')

  const payload = normalizePreviousBalanceInput(body)
  const balance = await insertPreviousBalance({
    supplierId: id,
    date: payload.date,
    amount: payload.amount,
    note: payload.note,
  })
  const ledger = await getSupplierLedger(id)
  return { balance, ...ledger }
}

export async function updateSupplierPreviousBalance(supplierIdInput, balanceIdInput, body = {}) {
  const supplierId = Number(supplierIdInput)
  const balanceId = Number(balanceIdInput)
  if (!Number.isInteger(supplierId) || supplierId <= 0) throw badRequest('Invalid supplier id')
  if (!Number.isInteger(balanceId) || balanceId <= 0) throw badRequest('Invalid previous balance id')

  const existing = await findPreviousBalanceById(balanceId)
  if (!existing || existing.supplierId !== supplierId) throw notFound('Previous balance not found')

  const payload = normalizePreviousBalanceInput(body)
  const balance = await updatePreviousBalanceById(balanceId, payload)
  if (!balance) throw notFound('Previous balance not found')
  const ledger = await getSupplierLedger(supplierId)
  return { balance, ...ledger }
}

export async function removeSupplierPreviousBalance(supplierIdInput, balanceIdInput) {
  const supplierId = Number(supplierIdInput)
  const balanceId = Number(balanceIdInput)
  if (!Number.isInteger(supplierId) || supplierId <= 0) throw badRequest('Invalid supplier id')
  if (!Number.isInteger(balanceId) || balanceId <= 0) throw badRequest('Invalid previous balance id')

  const existing = await findPreviousBalanceById(balanceId)
  if (!existing || existing.supplierId !== supplierId) throw notFound('Previous balance not found')

  const deleted = await deletePreviousBalanceById(balanceId)
  if (!deleted) throw notFound('Previous balance not found')
  const ledger = await getSupplierLedger(supplierId)
  return { deleted: true, ...ledger }
}
