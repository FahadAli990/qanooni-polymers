import {
  deleteExpenseById,
  findExpenseById,
  findExpensesByDate,
  insertExpense,
  sumAllExpenses,
  sumExpensesByDate,
  updateExpenseById,
} from '../repositories/expenseRepository.js'

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

function normalizeExpenseInput(body = {}) {
  const date = String(body.date || '').trim()
  const title = String(body.title || '').trim()
  const note = String(body.note || '').trim().slice(0, 255)
  const amount = Number(body.amount)

  if (!DATE_RE.test(date)) throw badRequest('Date is required (YYYY-MM-DD)')
  if (!title) throw badRequest('Expense title is required')
  if (title.length > 160) throw badRequest('Expense title must be 160 characters or less')
  if (!Number.isFinite(amount) || amount <= 0) {
    throw badRequest('Amount must be a positive number')
  }

  return {
    date,
    title,
    amount: Number(amount.toFixed(2)),
    note,
  }
}

async function buildListPayload(date) {
  const items = await findExpensesByDate(date)
  const dayTotal = await sumExpensesByDate(date)
  const total = await sumAllExpenses()
  return {
    date,
    items,
    totals: {
      dayTotal,
      total,
    },
  }
}

export async function listExpenses(query = {}) {
  const dateRaw = String(query.date || '').trim()
  const date = DATE_RE.test(dateRaw) ? dateRaw : todayIso()
  return buildListPayload(date)
}

export async function createExpense(body = {}) {
  const payload = normalizeExpenseInput(body)
  const item = await insertExpense(payload)
  const list = await buildListPayload(payload.date)
  return { item, ...list }
}

export async function updateExpense(idInput, body = {}) {
  const id = Number(idInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid expense id')

  const existing = await findExpenseById(id)
  if (!existing) throw notFound('Expense not found')

  const payload = normalizeExpenseInput(body)
  const item = await updateExpenseById(id, payload)
  if (!item) throw notFound('Expense not found')

  const list = await buildListPayload(payload.date)
  return { item, ...list }
}

export async function removeExpense(idInput, query = {}) {
  const id = Number(idInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid expense id')

  const existing = await findExpenseById(id)
  if (!existing) throw notFound('Expense not found')

  const deleted = await deleteExpenseById(id)
  if (!deleted) throw notFound('Expense not found')

  const dateRaw = String(query.date || '').trim()
  const date = DATE_RE.test(dateRaw) ? dateRaw : existing.date
  const list = await buildListPayload(date)
  return { deleted: true, ...list }
}
