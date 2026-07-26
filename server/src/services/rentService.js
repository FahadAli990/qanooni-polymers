import {
  countPaymentsByVehicleId,
  countTripsByVehicleId,
  deleteVehicleById,
  deleteRentPaymentById,
  deleteTripById,
  findAllVehicles,
  findVehicleById,
  findVehicleByName,
  findPaymentsByVehicleId,
  findRentPaymentById,
  findTripById,
  findTripsByVehicleId,
  insertVehicle,
  insertRentPayment,
  insertTrip,
  sumFaresByVehicleId,
  sumPaymentsByVehicleId,
  updateVehicleById,
  updateRentPaymentById,
  updateTripById,
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

function allocateTripStatuses(trips, totalPaid) {
  let remainingPaid = Number(totalPaid) || 0
  return trips.map((row) => {
    const amount = Number(row.fareAmount) || 0
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

function normalizeVehicleInput(body = {}) {
  const name = String(body.name || '').trim()
  const note = String(body.note || '').trim().slice(0, 255)
  if (!name) throw badRequest('Vehicle name is required')
  if (name.length > 160) throw badRequest('Vehicle name must be 160 characters or less')
  return { name, note }
}

function normalizeTripInput(body = {}) {
  const date = String(body.date || '').trim()
  const destination = String(body.destination || '').trim().slice(0, 255)
  const note = String(body.note || '').trim().slice(0, 255)
  const fareAmount = Number(body.fareAmount ?? body.fare_amount ?? body.amount)
  if (!DATE_RE.test(date)) throw badRequest('Date is required (YYYY-MM-DD)')
  if (!destination) throw badRequest('Destination / place is required')
  if (!Number.isFinite(fareAmount) || fareAmount <= 0) {
    throw badRequest('Fare amount must be a positive number')
  }
  return {
    date,
    destination,
    fareAmount: Number(fareAmount.toFixed(2)),
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
  const trips = await countTripsByVehicleId(id)
  const payments = await countPaymentsByVehicleId(id)
  if (trips > 0 || payments > 0) {
    const error = new Error('Cannot delete vehicle with trip or payment history')
    error.status = 409
    throw error
  }
  const deleted = await deleteVehicleById(id)
  if (!deleted) throw notFound('Vehicle not found')
  return { deleted: true }
}

export async function getVehicleLedger(vehicleIdInput) {
  const id = Number(vehicleIdInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid vehicle id')
  const vehicle = await findVehicleById(id)
  if (!vehicle) throw notFound('Vehicle not found')

  const tripsRaw = await findTripsByVehicleId(id)
  const totalPaid = await sumPaymentsByVehicleId(id)
  const trips = allocateTripStatuses(tripsRaw, totalPaid)
  const payments = await findPaymentsByVehicleId(id)

  const totalFare = Number(
    tripsRaw.reduce((sum, row) => sum + Number(row.fareAmount || 0), 0).toFixed(2),
  )
  const paid = Number(Number(totalPaid).toFixed(2))
  const remaining = Number((totalFare - paid).toFixed(2))
  const advance = remaining < 0 ? Number(Math.abs(remaining).toFixed(2)) : 0

  return {
    vehicle,
    summary: {
      totalFare,
      totalPaid: paid,
      remaining: remaining > 0 ? remaining : 0,
      advance,
      tripCount: tripsRaw.length,
    },
    trips,
    payments,
  }
}

export async function createTrip(vehicleIdInput, body = {}) {
  const id = Number(vehicleIdInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid vehicle id')
  const vehicle = await findVehicleById(id)
  if (!vehicle) throw notFound('Vehicle not found')
  const payload = normalizeTripInput(body)
  const trip = await insertTrip({ vehicleId: id, ...payload })
  const ledger = await getVehicleLedger(id)
  return { trip, ...ledger }
}

export async function updateTrip(vehicleIdInput, tripIdInput, body = {}) {
  const vehicleId = Number(vehicleIdInput)
  const tripId = Number(tripIdInput)
  if (!Number.isInteger(vehicleId) || vehicleId <= 0) throw badRequest('Invalid vehicle id')
  if (!Number.isInteger(tripId) || tripId <= 0) throw badRequest('Invalid trip id')
  const existing = await findTripById(tripId)
  if (!existing || existing.vehicleId !== vehicleId) throw notFound('Trip not found')
  const payload = normalizeTripInput(body)
  const trip = await updateTripById(tripId, payload)
  if (!trip) throw notFound('Trip not found')
  const ledger = await getVehicleLedger(vehicleId)
  return { trip, ...ledger }
}

export async function removeTrip(vehicleIdInput, tripIdInput) {
  const vehicleId = Number(vehicleIdInput)
  const tripId = Number(tripIdInput)
  if (!Number.isInteger(vehicleId) || vehicleId <= 0) throw badRequest('Invalid vehicle id')
  if (!Number.isInteger(tripId) || tripId <= 0) throw badRequest('Invalid trip id')
  const existing = await findTripById(tripId)
  if (!existing || existing.vehicleId !== vehicleId) throw notFound('Trip not found')
  const deleted = await deleteTripById(tripId)
  if (!deleted) throw notFound('Trip not found')
  const ledger = await getVehicleLedger(vehicleId)
  return { deleted: true, ...ledger }
}

export async function createRentPayment(vehicleIdInput, body = {}) {
  const id = Number(vehicleIdInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid vehicle id')
  const vehicle = await findVehicleById(id)
  if (!vehicle) throw notFound('Vehicle not found')
  const payload = normalizePaymentInput(body)
  const payment = await insertRentPayment({ vehicleId: id, ...payload })
  const ledger = await getVehicleLedger(id)
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
  const ledger = await getVehicleLedger(vehicleId)
  return { payment, ...ledger }
}

export async function removeRentPayment(vehicleIdInput, paymentIdInput) {
  const vehicleId = Number(vehicleIdInput)
  const paymentId = Number(paymentIdInput)
  if (!Number.isInteger(vehicleId) || vehicleId <= 0) throw badRequest('Invalid vehicle id')
  if (!Number.isInteger(paymentId) || paymentId <= 0) throw badRequest('Invalid payment id')
  const existing = await findRentPaymentById(paymentId)
  if (!existing || existing.vehicleId !== vehicleId) throw notFound('Payment not found')
  const deleted = await deleteRentPaymentById(paymentId)
  if (!deleted) throw notFound('Payment not found')
  const ledger = await getVehicleLedger(vehicleId)
  return { deleted: true, ...ledger }
}
