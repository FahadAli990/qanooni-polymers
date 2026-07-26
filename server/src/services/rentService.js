import {
  countPaymentsByVehicleId,
  deleteVehicleById,
  deleteRentPaymentById,
  findAllVehicles,
  findVehicleById,
  findVehicleByName,
  findPaymentsByVehicleAndMonth,
  findRentPaymentById,
  insertVehicle,
  insertRentPayment,
  sumPaymentsByVehicleAndMonth,
  updateVehicleById,
  updateRentPaymentById,
} from '../repositories/rentRepository.js'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_RE = /^\d{4}-\d{2}$/

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

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function normalizeMonth(monthInput) {
  const raw = String(monthInput || '').trim()
  if (MONTH_RE.test(raw)) return raw
  if (DATE_RE.test(raw)) return raw.slice(0, 7)
  return currentMonth()
}

function monthToDate(month) {
  return `${month}-01`
}

function payStatus(due, paid) {
  if (paid <= 0) return 'unpaid'
  if (paid + 1e-9 >= due) return 'paid'
  return 'partial'
}

function normalizeVehicleInput(body = {}) {
  const name = String(body.name || '').trim()
  const note = String(body.note || '').trim().slice(0, 255)
  const monthlyRent = Number(body.monthlyRent ?? body.monthly_rent)
  if (!name) throw badRequest('Vehicle name is required')
  if (name.length > 160) throw badRequest('Vehicle name must be 160 characters or less')
  if (!Number.isFinite(monthlyRent) || monthlyRent <= 0) {
    throw badRequest('Monthly rent must be a positive number')
  }
  return { name, monthlyRent: Number(monthlyRent.toFixed(2)), note }
}

function normalizePaymentInput(body = {}) {
  const date = String(body.date || '').trim()
  const forMonth = normalizeMonth(body.forMonth ?? body.for_month ?? body.month)
  const note = String(body.note || '').trim().slice(0, 255)
  const amount = Number(body.amount)
  if (!DATE_RE.test(date)) throw badRequest('Date is required (YYYY-MM-DD)')
  if (!MONTH_RE.test(forMonth)) throw badRequest('Month is required (YYYY-MM)')
  if (!Number.isFinite(amount) || amount <= 0) {
    throw badRequest('Amount must be a positive number')
  }
  return {
    date,
    forMonth,
    forMonthDate: monthToDate(forMonth),
    amount: Number(amount.toFixed(2)),
    note,
  }
}

export async function listVehicles() {
  return findAllVehicles()
}

export async function createVehicle(body = {}) {
  const payload = normalizeVehicleInput(body)
  const existing = await findVehicleByName(payload.name)
  if (existing) {
    const error = new Error('A vehicle with this name already exists')
    error.status = 409
    throw error
  }
  return insertVehicle(payload)
}

export async function updateVehicle(idInput, body = {}) {
  const id = Number(idInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid vehicle id')
  const existing = await findVehicleById(id)
  if (!existing) throw notFound('Vehicle not found')
  const payload = normalizeVehicleInput(body)
  const byName = await findVehicleByName(payload.name)
  if (byName && byName.id !== id) {
    const error = new Error('A vehicle with this name already exists')
    error.status = 409
    throw error
  }
  const updated = await updateVehicleById(id, payload)
  if (!updated) throw notFound('Vehicle not found')
  return updated
}

export async function removeVehicle(idInput) {
  const id = Number(idInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid vehicle id')
  const existing = await findVehicleById(id)
  if (!existing) throw notFound('Vehicle not found')
  const paymentCount = await countPaymentsByVehicleId(id)
  if (paymentCount > 0) {
    const error = new Error('Cannot delete vehicle with payment history')
    error.status = 409
    throw error
  }
  const deleted = await deleteVehicleById(id)
  if (!deleted) throw notFound('Vehicle not found')
  return { deleted: true }
}

export async function getVehicleLedger(vehicleIdInput, query = {}) {
  const id = Number(vehicleIdInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid vehicle id')
  const vehicle = await findVehicleById(id)
  if (!vehicle) throw notFound('Vehicle not found')

  const month = normalizeMonth(query.month)
  const forMonthDate = monthToDate(month)
  const payments = await findPaymentsByVehicleAndMonth(id, forMonthDate)
  const paid = await sumPaymentsByVehicleAndMonth(id, forMonthDate)
  const due = vehicle.monthlyRent
  const remaining = Number(Math.max(due - paid, 0).toFixed(2))
  const advance = Number(Math.max(paid - due, 0).toFixed(2))

  return {
    vehicle,
    month,
    summary: {
      due,
      paid,
      remaining,
      advance,
      payStatus: payStatus(due, paid),
    },
    payments,
  }
}

export async function createRentPayment(vehicleIdInput, body = {}) {
  const id = Number(vehicleIdInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid vehicle id')
  const vehicle = await findVehicleById(id)
  if (!vehicle) throw notFound('Vehicle not found')
  const payload = normalizePaymentInput(body)
  const payment = await insertRentPayment({ vehicleId: id, ...payload })
  const ledger = await getVehicleLedger(id, { month: payload.forMonth })
  return { payment, ...ledger }
}

export async function updateRentPayment(vehicleIdInput, paymentIdInput, body = {}) {
  const vehicleId = Number(vehicleIdInput)
  const paymentId = Number(paymentIdInput)
  if (!Number.isInteger(vehicleId) || vehicleId <= 0) throw badRequest('Invalid vehicle id')
  if (!Number.isInteger(paymentId) || paymentId <= 0) throw badRequest('Invalid payment id')
  const existing = await findRentPaymentById(paymentId)
  if (!existing || existing.vehicleId !== vehicleId) throw notFound('Payment not found')
  const payload = normalizePaymentInput(body)
  const payment = await updateRentPaymentById(paymentId, payload)
  if (!payment) throw notFound('Payment not found')
  const ledger = await getVehicleLedger(vehicleId, { month: payload.forMonth })
  return { payment, ...ledger }
}

export async function removeRentPayment(vehicleIdInput, paymentIdInput, query = {}) {
  const vehicleId = Number(vehicleIdInput)
  const paymentId = Number(paymentIdInput)
  if (!Number.isInteger(vehicleId) || vehicleId <= 0) throw badRequest('Invalid vehicle id')
  if (!Number.isInteger(paymentId) || paymentId <= 0) throw badRequest('Invalid payment id')
  const existing = await findRentPaymentById(paymentId)
  if (!existing || existing.vehicleId !== vehicleId) throw notFound('Payment not found')
  const deleted = await deleteRentPaymentById(paymentId)
  if (!deleted) throw notFound('Payment not found')
  const month = normalizeMonth(query.month || existing.forMonth)
  const ledger = await getVehicleLedger(vehicleId, { month })
  return { deleted: true, ...ledger }
}
