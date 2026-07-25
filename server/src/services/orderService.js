import { findAllRawMaterials, findRawMaterialBySlug } from '../repositories/rawMaterialRepository.js'
import { findMillRouteBySlug } from '../repositories/millRouteRepository.js'
import { findCustomerById } from '../repositories/routeCustomerRepository.js'
import {
  deleteOrderById,
  findAllOrders,
  findOrderById,
  findOrderItemsByOrderIds,
  insertOrderWithItems,
} from '../repositories/orderRepository.js'
import { dummyRatePerKg } from '../utils/dummyRates.js'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const KIND_KEYS = ['roll', 'chaat', 'dewaar']

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

function attachItems(orders, items) {
  const byOrder = new Map()
  for (const item of items) {
    const list = byOrder.get(item.salesOrderId) || []
    list.push(item)
    byOrder.set(item.salesOrderId, list)
  }
  return orders.map((order) => ({
    ...order,
    items: byOrder.get(order.id) || [],
  }))
}

export async function listOrders() {
  const orders = await findAllOrders()
  const items = await findOrderItemsByOrderIds(orders.map((o) => o.id))
  return attachItems(orders, items)
}

export async function getOrderRates() {
  const materials = await findAllRawMaterials()
  return materials.map((m) => ({
    id: m.id,
    slug: m.slug,
    name: m.name,
    swatch: m.swatch,
    ratePerKg: dummyRatePerKg(m.id),
  }))
}

export async function createOrder(body = {}) {
  const date = String(body.date || '').trim()
  if (!DATE_RE.test(date)) throw badRequest('Date is required (YYYY-MM-DD)')

  const routeSlug = String(body.routeSlug || '').trim()
  if (!routeSlug) throw badRequest('Route is required')

  const route = await findMillRouteBySlug(routeSlug)
  if (!route) throw notFound('Route not found')

  const customerId = Number(body.customerId)
  if (!Number.isInteger(customerId) || customerId <= 0) {
    throw badRequest('Shop / customer is required')
  }
  const customer = await findCustomerById(customerId, route.id)
  if (!customer) throw badRequest('Selected shop does not belong to this route')

  const kindsInput = body.kinds && typeof body.kinds === 'object' ? body.kinds : {}
  const hasRoll = Boolean(kindsInput.roll)
  const hasChaat = Boolean(kindsInput.chaat)
  const hasDewaar = Boolean(kindsInput.dewaar)
  if (!hasRoll && !hasChaat && !hasDewaar) {
    throw badRequest('Select at least one product type: Roll, Chaat, or Dewaar')
  }

  const rawItems = Array.isArray(body.items) ? body.items : []
  if (!rawItems.length) throw badRequest('Add at least one raw material with kg')

  const seen = new Set()
  const items = []
  for (const row of rawItems) {
    const materialSlug = String(row.materialSlug || row.slug || '').trim()
    if (!materialSlug) throw badRequest('Raw material is required on each line')
    if (seen.has(materialSlug)) {
      throw badRequest(`Duplicate raw material: ${materialSlug}`)
    }
    seen.add(materialSlug)

    const material = await findRawMaterialBySlug(materialSlug)
    if (!material) throw badRequest(`Unknown raw material: ${materialSlug}`)

    const kg = Number(row.kg)
    if (!Number.isFinite(kg) || kg <= 0) {
      throw badRequest(`KG must be a positive number for ${material.name}`)
    }

    const ratePerKg = dummyRatePerKg(material.id)
    const amount = Number((kg * ratePerKg).toFixed(2))
    items.push({
      rawMaterialId: material.id,
      kg: Number(kg.toFixed(2)),
      ratePerKg,
      amount,
    })
  }

  const totalBill = Number(items.reduce((sum, i) => sum + i.amount, 0).toFixed(2))
  const orderId = await insertOrderWithItems({
    date,
    millRouteId: route.id,
    routeCustomerId: customer.id,
    hasRoll,
    hasChaat,
    hasDewaar,
    totalBill,
    items,
  })

  const order = await findOrderById(orderId)
  const orderItems = await findOrderItemsByOrderIds([orderId])
  return { ...order, items: orderItems }
}

export async function removeOrder(idInput) {
  const id = Number(idInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid order id')
  const deleted = await deleteOrderById(id)
  if (!deleted) throw notFound('Order not found')
  return { deleted: true }
}

export { KIND_KEYS }
