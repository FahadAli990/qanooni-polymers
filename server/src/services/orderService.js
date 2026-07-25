import { findAllRawMaterials, findRawMaterialById, findRawMaterialBySlug } from '../repositories/rawMaterialRepository.js'
import { findMillRouteBySlug } from '../repositories/millRouteRepository.js'
import { findCustomerById } from '../repositories/routeCustomerRepository.js'
import { ROLL_SIZES } from '../repositories/rollRepository.js'
import {
  deleteOrderById,
  findAllOrders,
  findOrderById,
  findOrderItemsByOrderIds,
  insertOrderWithItems,
  markOrderDeliveredById,
} from '../repositories/orderRepository.js'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const KIND_KEYS = ['roll', 'chaat', 'dewaar']
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

async function getOrderWithItems(orderId) {
  const order = await findOrderById(orderId)
  if (!order) return null
  const items = await findOrderItemsByOrderIds([orderId])
  return { ...order, items }
}

export async function listOrders() {
  const orders = await findAllOrders()
  const items = await findOrderItemsByOrderIds(orders.map((o) => o.id))
  return attachItems(orders, items)
}

export async function getOrderRates() {
  const materials = await findAllRawMaterials()
  return {
    sizes: ROLL_SIZES,
    kinds: KIND_KEYS.map((key) => ({ key, label: KIND_LABEL[key] })),
    materials: materials.map((m) => ({
      id: m.id,
      slug: m.slug,
      name: m.name,
      swatch: m.swatch,
      ratePerKg: Number(m.pricePerKg || 0),
    })),
  }
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

  const rawItems = Array.isArray(body.items) ? body.items : []
  if (!rawItems.length) throw badRequest('Add at least one order line')

  const seen = new Set()
  const items = []
  let hasRoll = false
  let hasChaat = false
  let hasDewaar = false

  for (const row of rawItems) {
    const kind = String(row.kind || '').trim().toLowerCase()
    if (!KIND_KEYS.includes(kind)) {
      throw badRequest(`Product type must be one of: ${KIND_KEYS.join(', ')}`)
    }

    const size = String(row.size || '').trim()
    if (!ROLL_SIZES.includes(size)) {
      throw badRequest(`Size must be one of: ${ROLL_SIZES.join(', ')}`)
    }

    const materialSlug = String(row.materialSlug || row.slug || '').trim()
    if (!materialSlug) throw badRequest('Raw material is required on each line')

    const lineKey = `${kind}|${size}|${materialSlug}`
    if (seen.has(lineKey)) {
      throw badRequest(`Duplicate line: ${KIND_LABEL[kind]} ${size} / ${materialSlug}`)
    }
    seen.add(lineKey)

    const material = await findRawMaterialBySlug(materialSlug)
    if (!material) throw badRequest(`Unknown raw material: ${materialSlug}`)

    const kg = Number(row.kg)
    if (!Number.isFinite(kg) || kg <= 0) {
      throw badRequest(`KG must be a positive number for ${material.name}`)
    }

    const ratePerKg = Number(material.pricePerKg || 0)
    if (!(ratePerKg > 0)) {
      throw badRequest(
        `Set price per kg for "${material.name}" in Raw Material before creating an order`,
      )
    }

    if (kind === 'roll') hasRoll = true
    if (kind === 'chaat') hasChaat = true
    if (kind === 'dewaar') hasDewaar = true

    const amount = Number((kg * ratePerKg).toFixed(2))
    items.push({
      kind,
      size,
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

  return getOrderWithItems(orderId)
}

export async function deliverOrder(idInput) {
  const id = Number(idInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid order id')

  const order = await getOrderWithItems(id)
  if (!order) throw notFound('Order not found')
  if (order.status === 'delivered') {
    throw badRequest('Order is already delivered and cannot go back to pending')
  }
  if (order.status !== 'pending') throw badRequest('Only pending orders can be delivered')

  // Stock is by raw material kg (size/kind are product specs; material pool is shared)
  const needByMaterial = new Map()
  for (const item of order.items) {
    const prev = needByMaterial.get(item.rawMaterialId) || {
      name: item.materialName,
      kg: 0,
    }
    prev.kg += Number(item.kg)
    needByMaterial.set(item.rawMaterialId, prev)
  }

  for (const [materialId, need] of needByMaterial.entries()) {
    const material = await findRawMaterialById(materialId)
    if (!material) {
      throw badRequest(`Raw material missing for order line (${need.name || materialId})`)
    }
    const available = Number(material.totalKg || 0)
    if (available + 1e-9 < need.kg) {
      throw badRequest(
        `Not enough stock for "${material.name}". Need ${need.kg} kg, available ${available} kg`,
      )
    }
  }

  const updated = await markOrderDeliveredById(id)
  if (!updated) {
    throw badRequest('Order is already delivered and cannot go back to pending')
  }

  return getOrderWithItems(id)
}

export async function removeOrder(idInput) {
  const id = Number(idInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid order id')

  const existing = await findOrderById(id)
  if (!existing) throw notFound('Order not found')
  if (existing.status === 'delivered') {
    throw badRequest('Delivered orders cannot be deleted')
  }

  const deleted = await deleteOrderById(id)
  if (!deleted) throw notFound('Order not found')
  return { deleted: true }
}

export { KIND_KEYS }
