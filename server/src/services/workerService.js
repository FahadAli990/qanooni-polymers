import {
  countLeavesByWorkerId,
  countSalaryPaymentsByWorkerId,
  deleteLeaveById,
  deleteSalaryPaymentById,
  deleteWorkerById,
  findAllWorkers,
  findLeaveById,
  findLeavesByWorkerAndMonth,
  findSalaryPaymentById,
  findSalaryPaymentsByWorkerAndMonth,
  findWorkerById,
  findWorkerByName,
  insertLeave,
  insertSalaryPayment,
  insertWorker,
  sumLeaveDaysByWorkerAndMonth,
  sumSalaryPaymentsByWorkerAndMonth,
  updateLeaveById,
  updateSalaryPaymentById,
  updateWorkerById,
} from '../repositories/workerRepository.js'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_RE = /^\d{4}-\d{2}$/
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

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function normalizeMonth(monthInput) {
  const raw = String(monthInput || '').trim()
  if (MONTH_RE.test(raw)) return raw
  if (DATE_RE.test(raw)) return raw.slice(0, 7)
  return currentMonth()
}

function monthBounds(month) {
  const [y, m] = month.split('-').map(Number)
  const start = `${month}-01`
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
  return { monthStart: start, monthEnd: next, forMonthDate: start }
}

function payStatus(payable, paid) {
  if (paid <= 0) return 'unpaid'
  if (paid + 1e-9 >= payable) return 'paid'
  return 'partial'
}

function normalizeWorkerInput(body = {}) {
  const name = String(body.name || '').trim()
  const contact = String(body.contact || '').trim()
  const note = String(body.note || '').trim().slice(0, 255)
  const fixedSalary = Number(body.fixedSalary ?? body.fixed_salary)
  if (!name) throw badRequest('Worker name is required')
  if (name.length > 160) throw badRequest('Worker name must be 160 characters or less')
  if (!CONTACT_RE.test(contact)) throw badRequest('Contact must be exactly 11 digits')
  if (!Number.isFinite(fixedSalary) || fixedSalary <= 0) {
    throw badRequest('Fixed salary must be a positive number')
  }
  return { name, contact, fixedSalary: Number(fixedSalary.toFixed(2)), note }
}

function normalizeLeaveInput(body = {}) {
  const date = String(body.date || '').trim()
  const note = String(body.note || '').trim().slice(0, 255)
  const days = Number(body.days)
  if (!DATE_RE.test(date)) throw badRequest('Leave date is required (YYYY-MM-DD)')
  if (!Number.isFinite(days) || days <= 0 || days > 31) {
    throw badRequest('Leave days must be greater than 0')
  }
  return { date, days: Number(days.toFixed(2)), note }
}

function normalizeSalaryPaymentInput(body = {}) {
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
    forMonthDate: `${forMonth}-01`,
    amount: Number(amount.toFixed(2)),
    note,
  }
}

export async function listWorkers() {
  return findAllWorkers()
}

export async function createWorker(body = {}) {
  const payload = normalizeWorkerInput(body)
  const existing = await findWorkerByName(payload.name)
  if (existing) {
    const error = new Error('A worker with this name already exists')
    error.status = 409
    throw error
  }
  return insertWorker(payload)
}

export async function updateWorker(idInput, body = {}) {
  const id = Number(idInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid worker id')
  const existing = await findWorkerById(id)
  if (!existing) throw notFound('Worker not found')
  const payload = normalizeWorkerInput(body)
  const byName = await findWorkerByName(payload.name)
  if (byName && byName.id !== id) {
    const error = new Error('A worker with this name already exists')
    error.status = 409
    throw error
  }
  const updated = await updateWorkerById(id, payload)
  if (!updated) throw notFound('Worker not found')
  return updated
}

export async function removeWorker(idInput) {
  const id = Number(idInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid worker id')
  const existing = await findWorkerById(id)
  if (!existing) throw notFound('Worker not found')
  const leaveCount = await countLeavesByWorkerId(id)
  const payCount = await countSalaryPaymentsByWorkerId(id)
  if (leaveCount > 0 || payCount > 0) {
    const error = new Error('Cannot delete worker with leave or salary history')
    error.status = 409
    throw error
  }
  const deleted = await deleteWorkerById(id)
  if (!deleted) throw notFound('Worker not found')
  return { deleted: true }
}

export async function getWorkerLedger(workerIdInput, query = {}) {
  const id = Number(workerIdInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid worker id')
  const worker = await findWorkerById(id)
  if (!worker) throw notFound('Worker not found')

  const month = normalizeMonth(query.month)
  const { monthStart, monthEnd, forMonthDate } = monthBounds(month)
  const leaves = await findLeavesByWorkerAndMonth(id, monthStart, monthEnd)
  const leaveDays = await sumLeaveDaysByWorkerAndMonth(id, monthStart, monthEnd)
  const leaveCut = Number(((worker.fixedSalary / 30) * leaveDays).toFixed(2))
  const payable = Number(Math.max(worker.fixedSalary - leaveCut, 0).toFixed(2))
  const payments = await findSalaryPaymentsByWorkerAndMonth(id, forMonthDate)
  const paid = await sumSalaryPaymentsByWorkerAndMonth(id, forMonthDate)
  const remaining = Number(Math.max(payable - paid, 0).toFixed(2))
  const advance = Number(Math.max(paid - payable, 0).toFixed(2))

  return {
    worker,
    month,
    leaves,
    payments,
    summary: {
      fixedSalary: worker.fixedSalary,
      leaveDays,
      leaveCut,
      payable,
      paid,
      remaining,
      advance,
      payStatus: payStatus(payable, paid),
    },
  }
}

export async function createWorkerLeave(workerIdInput, body = {}) {
  const id = Number(workerIdInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid worker id')
  const worker = await findWorkerById(id)
  if (!worker) throw notFound('Worker not found')
  const payload = normalizeLeaveInput(body)
  const leave = await insertLeave({ workerId: id, ...payload })
  const month = payload.date.slice(0, 7)
  const ledger = await getWorkerLedger(id, { month })
  return { leave, ...ledger }
}

export async function updateWorkerLeave(workerIdInput, leaveIdInput, body = {}) {
  const workerId = Number(workerIdInput)
  const leaveId = Number(leaveIdInput)
  if (!Number.isInteger(workerId) || workerId <= 0) throw badRequest('Invalid worker id')
  if (!Number.isInteger(leaveId) || leaveId <= 0) throw badRequest('Invalid leave id')
  const existing = await findLeaveById(leaveId)
  if (!existing || existing.workerId !== workerId) throw notFound('Leave not found')
  const payload = normalizeLeaveInput(body)
  const leave = await updateLeaveById(leaveId, payload)
  if (!leave) throw notFound('Leave not found')
  const ledger = await getWorkerLedger(workerId, { month: payload.date.slice(0, 7) })
  return { leave, ...ledger }
}

export async function removeWorkerLeave(workerIdInput, leaveIdInput, query = {}) {
  const workerId = Number(workerIdInput)
  const leaveId = Number(leaveIdInput)
  if (!Number.isInteger(workerId) || workerId <= 0) throw badRequest('Invalid worker id')
  if (!Number.isInteger(leaveId) || leaveId <= 0) throw badRequest('Invalid leave id')
  const existing = await findLeaveById(leaveId)
  if (!existing || existing.workerId !== workerId) throw notFound('Leave not found')
  const deleted = await deleteLeaveById(leaveId)
  if (!deleted) throw notFound('Leave not found')
  const month = normalizeMonth(query.month || existing.date.slice(0, 7))
  const ledger = await getWorkerLedger(workerId, { month })
  return { deleted: true, ...ledger }
}

export async function createSalaryPayment(workerIdInput, body = {}) {
  const id = Number(workerIdInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid worker id')
  const worker = await findWorkerById(id)
  if (!worker) throw notFound('Worker not found')
  const payload = normalizeSalaryPaymentInput(body)
  const payment = await insertSalaryPayment({ workerId: id, ...payload })
  const ledger = await getWorkerLedger(id, { month: payload.forMonth })
  return { payment, ...ledger }
}

export async function updateSalaryPayment(workerIdInput, paymentIdInput, body = {}) {
  const workerId = Number(workerIdInput)
  const paymentId = Number(paymentIdInput)
  if (!Number.isInteger(workerId) || workerId <= 0) throw badRequest('Invalid worker id')
  if (!Number.isInteger(paymentId) || paymentId <= 0) throw badRequest('Invalid payment id')
  const existing = await findSalaryPaymentById(paymentId)
  if (!existing || existing.workerId !== workerId) throw notFound('Payment not found')
  const payload = normalizeSalaryPaymentInput(body)
  const payment = await updateSalaryPaymentById(paymentId, payload)
  if (!payment) throw notFound('Payment not found')
  const ledger = await getWorkerLedger(workerId, { month: payload.forMonth })
  return { payment, ...ledger }
}

export async function removeSalaryPayment(workerIdInput, paymentIdInput, query = {}) {
  const workerId = Number(workerIdInput)
  const paymentId = Number(paymentIdInput)
  if (!Number.isInteger(workerId) || workerId <= 0) throw badRequest('Invalid worker id')
  if (!Number.isInteger(paymentId) || paymentId <= 0) throw badRequest('Invalid payment id')
  const existing = await findSalaryPaymentById(paymentId)
  if (!existing || existing.workerId !== workerId) throw notFound('Payment not found')
  const deleted = await deleteSalaryPaymentById(paymentId)
  if (!deleted) throw notFound('Payment not found')
  const month = normalizeMonth(query.month || existing.forMonth)
  const ledger = await getWorkerLedger(workerId, { month })
  return { deleted: true, ...ledger }
}
