import { findMillRouteBySlug } from '../repositories/millRouteRepository.js'
import { findCustomerById } from '../repositories/routeCustomerRepository.js'
import {
  findDeliveredOrdersByCustomerId,
  findOrderItemsByOrderIds,
} from '../repositories/orderRepository.js'
import {
  deletePaymentById,
  findPaymentById,
  findPaymentsByCustomerId,
  insertPayment,
  sumPaymentsByCustomerId,
  updatePaymentById,
} from '../repositories/paymentRepository.js'
import {
  deletePreviousBillById,
  findPreviousBillById,
  findPreviousBillsByCustomerId,
  insertPreviousBill,
  updatePreviousBillById,
} from '../repositories/previousBillRepository.js'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const KIND_LABEL = { roll: 'Roll', chaat: 'Chaat', dewaar: 'Dewaar' }

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

function formatOrderLine(item) {
  const type = KIND_LABEL[item.kind] || item.kind || '—'
  return `${type} ${item.size || '—'} · ${item.materialName || '—'} ${Number(item.kg)} kg`
}

function allocateBillStatuses(bills, totalPaid) {
  let remainingPaid = Number(totalPaid) || 0
  return bills.map((bill) => {
    const amount = Number(bill.amount) || 0
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
      ...bill,
      payStatus,
      paidAmount,
      dueAmount: Number((amount - paidAmount).toFixed(2)),
    }
  })
}

async function resolveShop(routeSlug, customerIdInput) {
  const slug = String(routeSlug || '').trim()
  if (!slug) throw badRequest('Route is required')

  const route = await findMillRouteBySlug(slug)
  if (!route) throw notFound('Route not found')

  const customerId = Number(customerIdInput)
  if (!Number.isInteger(customerId) || customerId <= 0) {
    throw badRequest('Shop / customer is required')
  }

  const customer = await findCustomerById(customerId, route.id)
  if (!customer) throw badRequest('Selected shop does not belong to this route')

  return { route, customer }
}

function normalizePaymentInput(body = {}) {
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
    note,
  }
}

function normalizePreviousBillInput(body = {}) {
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

function sortBillsByDate(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  if (a.source !== b.source) return a.source === 'previous' ? -1 : 1
  return Number(a.refId || 0) - Number(b.refId || 0)
}

export async function getShopLedger({ routeSlug, customerId }) {
  const { route, customer } = await resolveShop(routeSlug, customerId)

  const orders = await findDeliveredOrdersByCustomerId(customer.id)
  const items = await findOrderItemsByOrderIds(orders.map((o) => o.id))
  const itemsByOrder = new Map()
  for (const item of items) {
    const list = itemsByOrder.get(item.salesOrderId) || []
    list.push(item)
    itemsByOrder.set(item.salesOrderId, list)
  }

  const orderBills = orders.map((order) => {
    const orderItems = itemsByOrder.get(order.id) || []
    return {
      id: `order-${order.id}`,
      source: 'order',
      refId: order.id,
      orderId: order.id,
      date: order.date,
      amount: Number(order.totalBill) || 0,
      note: '',
      lines: orderItems.map(formatOrderLine),
      items: orderItems,
    }
  })

  const previousRows = await findPreviousBillsByCustomerId(customer.id)
  const previousBills = previousRows.map((row) => ({
    id: `previous-${row.id}`,
    source: 'previous',
    refId: row.id,
    previousBillId: row.id,
    orderId: null,
    date: row.date,
    amount: Number(row.amount) || 0,
    note: row.note || 'Previous balance',
    lines: [row.note || 'Previous balance'],
    items: [],
  }))

  const rawBills = [...previousBills, ...orderBills].sort(sortBillsByDate)

  const totalPaid = await sumPaymentsByCustomerId(customer.id)
  const bills = allocateBillStatuses(rawBills, totalPaid)
  const payments = await findPaymentsByCustomerId(customer.id)

  const totalBilled = Number(
    rawBills.reduce((sum, bill) => sum + Number(bill.amount || 0), 0).toFixed(2),
  )
  const remaining = Number((totalBilled - totalPaid).toFixed(2))

  return {
    route: {
      id: route.id,
      slug: route.slug,
      name: route.name,
    },
    shop: customer,
    summary: {
      totalBilled,
      totalPaid: Number(totalPaid.toFixed(2)),
      remaining,
    },
    bills,
    payments,
  }
}

export async function createShopPayment(body = {}) {
  const { route, customer } = await resolveShop(body.routeSlug, body.customerId)
  const payload = normalizePaymentInput(body)
  const payment = await insertPayment({
    routeCustomerId: customer.id,
    date: payload.date,
    amount: payload.amount,
    note: payload.note,
  })
  const ledger = await getShopLedger({
    routeSlug: route.slug,
    customerId: customer.id,
  })
  return { payment, ...ledger }
}

export async function updateShopPayment(paymentIdInput, body = {}) {
  const id = Number(paymentIdInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid payment id')

  const existing = await findPaymentById(id)
  if (!existing) throw notFound('Payment not found')

  const { route, customer } = await resolveShop(body.routeSlug, body.customerId)
  if (existing.routeCustomerId !== customer.id) {
    throw badRequest('Payment does not belong to this shop')
  }

  const payload = normalizePaymentInput(body)
  const payment = await updatePaymentById(id, payload)
  if (!payment) throw notFound('Payment not found')

  const ledger = await getShopLedger({
    routeSlug: route.slug,
    customerId: customer.id,
  })
  return { payment, ...ledger }
}

export async function removeShopPayment(paymentIdInput, { routeSlug, customerId } = {}) {
  const id = Number(paymentIdInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid payment id')

  const existing = await findPaymentById(id)
  if (!existing) throw notFound('Payment not found')

  const { route, customer } = await resolveShop(routeSlug, customerId)
  if (existing.routeCustomerId !== customer.id) {
    throw badRequest('Payment does not belong to this shop')
  }

  const deleted = await deletePaymentById(id)
  if (!deleted) throw notFound('Payment not found')

  const ledger = await getShopLedger({
    routeSlug: route.slug,
    customerId: customer.id,
  })
  return { deleted: true, ...ledger }
}

export async function createPreviousBill(body = {}) {
  const { route, customer } = await resolveShop(body.routeSlug, body.customerId)
  const payload = normalizePreviousBillInput(body)
  const bill = await insertPreviousBill({
    routeCustomerId: customer.id,
    date: payload.date,
    amount: payload.amount,
    note: payload.note,
  })
  const ledger = await getShopLedger({
    routeSlug: route.slug,
    customerId: customer.id,
  })
  return { bill, ...ledger }
}

export async function updatePreviousBill(billIdInput, body = {}) {
  const id = Number(billIdInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid previous bill id')

  const existing = await findPreviousBillById(id)
  if (!existing) throw notFound('Previous bill not found')

  const { route, customer } = await resolveShop(body.routeSlug, body.customerId)
  if (existing.routeCustomerId !== customer.id) {
    throw badRequest('Previous bill does not belong to this shop')
  }

  const payload = normalizePreviousBillInput(body)
  const bill = await updatePreviousBillById(id, payload)
  if (!bill) throw notFound('Previous bill not found')

  const ledger = await getShopLedger({
    routeSlug: route.slug,
    customerId: customer.id,
  })
  return { bill, ...ledger }
}

export async function removePreviousBill(billIdInput, { routeSlug, customerId } = {}) {
  const id = Number(billIdInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid previous bill id')

  const existing = await findPreviousBillById(id)
  if (!existing) throw notFound('Previous bill not found')

  const { route, customer } = await resolveShop(routeSlug, customerId)
  if (existing.routeCustomerId !== customer.id) {
    throw badRequest('Previous bill does not belong to this shop')
  }

  const deleted = await deletePreviousBillById(id)
  if (!deleted) throw notFound('Previous bill not found')

  const ledger = await getShopLedger({
    routeSlug: route.slug,
    customerId: customer.id,
  })
  return { deleted: true, ...ledger }
}
