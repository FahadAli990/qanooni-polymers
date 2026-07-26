import {
  deleteMaintenanceById,
  findMaintenanceByDate,
  findMaintenanceById,
  insertMaintenance,
  sumAllMaintenance,
  sumMaintenanceByDate,
  updateMaintenanceById,
} from '../repositories/maintenanceRepository.js'

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

function normalizeInput(body = {}) {
  const date = String(body.date || '').trim()
  const title = String(body.title || '').trim()
  const note = String(body.note || '').trim().slice(0, 255)
  const amount = Number(body.amount)

  if (!DATE_RE.test(date)) throw badRequest('Date is required (YYYY-MM-DD)')
  if (!title) throw badRequest('Machine / work title is required')
  if (title.length > 160) throw badRequest('Title must be 160 characters or less')
  if (!Number.isFinite(amount) || amount <= 0) {
    throw badRequest('Amount must be a positive number')
  }

  return { date, title, amount: Number(amount.toFixed(2)), note }
}

async function buildListPayload(date) {
  const items = await findMaintenanceByDate(date)
  const dayTotal = await sumMaintenanceByDate(date)
  const total = await sumAllMaintenance()
  return { date, items, totals: { dayTotal, total } }
}

export async function listMaintenance(query = {}) {
  const dateRaw = String(query.date || '').trim()
  const date = DATE_RE.test(dateRaw) ? dateRaw : todayIso()
  return buildListPayload(date)
}

export async function createMaintenance(body = {}) {
  const payload = normalizeInput(body)
  const item = await insertMaintenance(payload)
  return { item, ...(await buildListPayload(payload.date)) }
}

export async function updateMaintenance(idInput, body = {}) {
  const id = Number(idInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid maintenance id')
  const existing = await findMaintenanceById(id)
  if (!existing) throw notFound('Maintenance entry not found')
  const payload = normalizeInput(body)
  const item = await updateMaintenanceById(id, payload)
  if (!item) throw notFound('Maintenance entry not found')
  return { item, ...(await buildListPayload(payload.date)) }
}

export async function removeMaintenance(idInput, query = {}) {
  const id = Number(idInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid maintenance id')
  const existing = await findMaintenanceById(id)
  if (!existing) throw notFound('Maintenance entry not found')
  const deleted = await deleteMaintenanceById(id)
  if (!deleted) throw notFound('Maintenance entry not found')
  const dateRaw = String(query.date || '').trim()
  const date = DATE_RE.test(dateRaw) ? dateRaw : existing.date
  return { deleted: true, ...(await buildListPayload(date)) }
}
