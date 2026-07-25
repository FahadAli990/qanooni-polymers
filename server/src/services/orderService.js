import { findAllRawMaterials, findRawMaterialBySlug } from '../repositories/rawMaterialRepository.js'
import { findMillRouteBySlug } from '../repositories/millRouteRepository.js'
import { findCustomerById } from '../repositories/routeCustomerRepository.js'
import {
  ROLL_SIZES,
  consumeProductionFifo,
  restoreKgOntoMatchingLots,
  restoreProductionAllocations,
  sumAvailableProductionKg,
} from '../repositories/rollRepository.js'
import {
  deleteOrderById,
  deleteOrderConsumptions,
  findAllOrders,
  findOrderById,
  findOrderConsumptions,
  findOrderItemsByOrderIds,
  insertOrderConsumptions,
  insertOrderWithItems,
  markOrderDeliveredById,
  markOrderPendingById,
  replaceOrderWithItems,
} from '../repositories/orderRepository.js'
import { getPool } from '../config/db.js'

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

async function parseOrderBody(body = {}) {
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

    const ratePerKg = Number(row.ratePerKg ?? row.rate_per_kg)
    if (!Number.isFinite(ratePerKg) || ratePerKg <= 0) {
      throw badRequest(`Sell rate / kg must be a positive number for ${material.name}`)
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
  return {
    date,
    millRouteId: route.id,
    routeCustomerId: customer.id,
    hasRoll,
    hasChaat,
    hasDewaar,
    totalBill,
    items,
  }
}

async function reverseDeliveredStock(order, conn) {
  const allocations = await findOrderConsumptions(order.id, conn)
  if (allocations.length) {
    const failed = await restoreProductionAllocations(allocations, conn)
    await deleteOrderConsumptions(order.id, conn)
    for (const miss of failed) {
      const item =
        (order.items || []).find((row) => Number(row.rawMaterialId) === Number(miss.rawMaterialId)) ||
        (order.items || [])[0]
      if (!item) continue
      await restoreKgOntoMatchingLots(
        {
          kind: miss.kind || item.kind,
          size: miss.size || item.size,
          rawMaterialId: miss.rawMaterialId || item.rawMaterialId,
          kg: miss.kg,
          date: order.date,
        },
        conn,
      )
    }
    return
  }

  for (const item of order.items || []) {
    await restoreKgOntoMatchingLots(
      {
        kind: item.kind,
        size: item.size,
        rawMaterialId: item.rawMaterialId,
        kg: item.kg,
        date: order.date,
      },
      conn,
    )
  }
}

async function applyDeliverStock(order, conn) {
  const allAllocations = []
  for (const item of order.items) {
    const need = Number(item.kg)
    const available = await sumAvailableProductionKg(
      {
        kind: item.kind,
        size: item.size,
        rawMaterialId: item.rawMaterialId,
      },
      conn,
    )
    if (available + 1e-9 < need) {
      throw badRequest(
        `Not enough ${KIND_LABEL[item.kind] || item.kind} production for "${item.materialName}" ${item.size}. Need ${need} kg, available ${available} kg`,
      )
    }

    const result = await consumeProductionFifo(
      {
        kind: item.kind,
        size: item.size,
        rawMaterialId: item.rawMaterialId,
        kg: need,
      },
      conn,
    )
    if (!result.ok) {
      throw badRequest(
        `Not enough ${KIND_LABEL[item.kind] || item.kind} production for "${item.materialName}" ${item.size}. Need ${need} kg`,
      )
    }
    allAllocations.push(...(result.allocations || []))
  }
  await insertOrderConsumptions(order.id, allAllocations, conn)
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
    })),
  }
}

export async function createOrder(body = {}) {
  const payload = await parseOrderBody(body)
  const orderId = await insertOrderWithItems(payload)
  return getOrderWithItems(orderId)
}

export async function updateOrder(idInput, body = {}) {
  const id = Number(idInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid order id')

  const existing = await getOrderWithItems(id)
  if (!existing) throw notFound('Order not found')

  const payload = await parseOrderBody(body)
  const conn = await getPool().getConnection()
  try {
    await conn.beginTransaction()

    if (existing.status === 'delivered') {
      await reverseDeliveredStock(existing, conn)
    }

    const updated = await replaceOrderWithItems(
      id,
      { ...payload, status: 'pending' },
      conn,
    )
    if (!updated) throw notFound('Order not found')

    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }

  return getOrderWithItems(id)
}

export async function deliverOrder(idInput) {
  const id = Number(idInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid order id')

  const order = await getOrderWithItems(id)
  if (!order) throw notFound('Order not found')
  if (order.status === 'delivered') {
    throw badRequest('Order is already delivered')
  }
  if (order.status !== 'pending') throw badRequest('Only pending orders can be delivered')

  const conn = await getPool().getConnection()
  try {
    await conn.beginTransaction()
    await applyDeliverStock(order, conn)

    const updated = await markOrderDeliveredById(id, conn)
    if (!updated) {
      throw badRequest('Order is already delivered')
    }

    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }

  return getOrderWithItems(id)
}

export async function undeliverOrder(idInput) {
  const id = Number(idInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid order id')

  const order = await getOrderWithItems(id)
  if (!order) throw notFound('Order not found')
  if (order.status !== 'delivered') {
    throw badRequest('Only delivered orders can be moved back to pending')
  }

  const conn = await getPool().getConnection()
  try {
    await conn.beginTransaction()
    await reverseDeliveredStock(order, conn)
    const updated = await markOrderPendingById(id, conn)
    if (!updated) throw badRequest('Only delivered orders can be moved back to pending')
    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }

  return getOrderWithItems(id)
}

export async function removeOrder(idInput) {
  const id = Number(idInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid order id')

  const existing = await getOrderWithItems(id)
  if (!existing) throw notFound('Order not found')

  const conn = await getPool().getConnection()
  try {
    await conn.beginTransaction()

    if (existing.status === 'delivered') {
      await reverseDeliveredStock(existing, conn)
    }

    const deleted = await deleteOrderById(id, conn)
    if (!deleted) throw notFound('Order not found')

    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }

  return { deleted: true }
}

export { KIND_KEYS }
