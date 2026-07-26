import {
  countPaymentsByVehicleId,
  deleteVehicleById,
  deleteRentPaymentById,
  findAllVehicles,
  findVehicleById,
  findVehicleByName,
  findPaymentsByVehicleAndDate,
  findRentPaymentById,
  insertVehicle,
  insertRentPayment,
  sumPaymentsByVehicleAndDate,
  updateVehicleById,
  updateRentPaymentById,
} from '../repositories/rentRepository.js'

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

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function normalizeDate(dateInput) {
  const raw = String(dateInput || '').trim()
  if (DATE_RE.test(raw)) return raw
  return todayIso()
}

function payStatus(due, paid) {
  if (paid <= 0) return 'unpaid'
  if (paid + 1e-9 >= due) return 'paid'
  return 'partial'
}

function normalizeVehicleInput(body = {}) {
  const name = String(body.name || '').trim()
  const note = String(body.note || '').trim().slice(0, 255)
  const dailyFare = Number(body.dailyFare ?? body.daily_fare ?? body.monthlyRent ?? body.monthly_rent)
  if (!name) throw badRequest('Vehicle name is required')
  if (name.length > 160) throw badRequest('Vehicle name must be 160 characters or less')
  if (!Number.isFinite(dailyFare) || dailyFare <= 0) {
    throw badRequest('Daily fare must be a positive number')
  }
  return { name, dailyFare: Number(dailyFare.toFixed(2)), note }
}

function normalizePaymentInput(body = {}, fallbackDate) {
  const date = String(body.date || fallbackDate || '').trim()
  const forDate = normalizeDate(body.forDate ?? body.for_date ?? body.date ?? fallbackDate)
  const note = String(body.note || '').trim().slice(0, 255)
  const amount = Number(body.amount)
  if (!DATE_RE.test(date)) throw badRequest('Date is required (YYYY-MM-DD)')
  if (!DATE_RE.test(forDate)) throw badRequest('For date is required (YYYY-MM-DD)')
  if (!Number.isFinite(amount) || amount <= 0) {
    throw badRequest('Amount must be a positive number')
  }
  return {
    date,
    forDate,
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

  const date = normalizeDate(query.date)
  const payments = await findPaymentsByVehicleAndDate(id, date)
  const paid = await sumPaymentsByVehicleAndDate(id, date)
  const due = vehicle.dailyFare
  const remaining = Number(Math.max(due - paid, 0).toFixed(2))
  const advance = Number(Math.max(paid - due, 0).toFixed(2))

  return {
    vehicle,
    date,
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
  const ledger = await getVehicleLedger(id, { date: payload.forDate })
  return { payment, ...ledger }
}

export async function updateRentPayment(vehicleIdInput, paymentIdInput, body = {}) {
  const vehicleId = Number(vehicleIdInput)
  const paymentId = Number(paymentIdInput)
  if (!Number.isInteger(vehicleId) || vehicleId <= 0) throw badRequest('Invalid vehicle id')
  if (!Number.isInteger(paymentId) || paymentId <= 0) throw badRequest('Invalid payment id')
  const existing = await findRentPaymentById(paymentId)
  if (!existing || existing.vehicleId !== vehicleId) throw notFound('Payment not found')
  const payload = normalizePaymentInput(body, existing.forDate)
  const payment = await updateRentPaymentById(paymentId, payload)
  if (!payment) throw notFound('Payment not found')
  const ledger = await getVehicleLedger(vehicleId, { date: payload.forDate })
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
  const date = normalizeDate(query.date || existing.forDate)
  const ledger = await getVehicleLedger(vehicleId, { date })
  return { deleted: true, ...ledger }
}
