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

  const rawBills = orders.map((order) => {
    const orderItems = itemsByOrder.get(order.id) || []
    return {
      id: order.id,
      orderId: order.id,
      date: order.date,
      amount: Number(order.totalBill) || 0,
      lines: orderItems.map(formatOrderLine),
      items: orderItems,
    }
  })

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
