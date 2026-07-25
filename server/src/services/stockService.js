import { findRawMaterialBySlug } from '../repositories/rawMaterialRepository.js'
import {
  deleteStockById,
  findStocksByMaterialId,
  insertStock,
  sumStocksByMaterialId,
  updateStockById,
} from '../repositories/stockRepository.js'

/** 1 bag = 40 kg (standard) */
export const KG_PER_BAG = 40

function notFound(message = 'Raw material not found') {
  const error = new Error(message)
  error.status = 404
  return error
}

function badRequest(message) {
  const error = new Error(message)
  error.status = 400
  return error
}

async function requireMaterial(slug) {
  const material = await findRawMaterialBySlug(slug)
  if (!material) throw notFound()
  return material
}

function normalizeStockInput(body) {
  const date = String(body?.date || '').trim()
  const supplier = String(body?.supplier || '').trim()
  const bagsRaw = body?.bags
  const priceRaw = body?.pricePerKg ?? body?.price_per_kg

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw badRequest('Date is required (YYYY-MM-DD)')
  }

  if (!supplier) throw badRequest('Supplier is required')
  if (supplier.length > 160) throw badRequest('Supplier must be 160 characters or less')

  const bags = Number(bagsRaw)
  if (!Number.isFinite(bags) || bags <= 0 || !Number.isInteger(bags)) {
    throw badRequest('Quantity (bags) must be a whole number (1, 2, 3...)')
  }

  const pricePerKg = Number(priceRaw)
  if (!Number.isFinite(pricePerKg) || pricePerKg <= 0) {
    throw badRequest('Purchase price per kg is required and must be greater than zero')
  }

  const kg = Number((bags * KG_PER_BAG).toFixed(2))
  return {
    date,
    supplier,
    bags,
    kg,
    pricePerKg: Number(pricePerKg.toFixed(2)),
  }
}

function withTotals(stockTotals, material) {
  const stockedKg = stockTotals.totalKg
  const usedKg = Number(material.usedKg || 0)
  const availableKg = Number(material.totalKg || 0)
  const stockedBags = stockTotals.totalBags
  const usedBags = Number((usedKg / KG_PER_BAG).toFixed(4))
  const availableBags = Number((availableKg / KG_PER_BAG).toFixed(4))
  return {
    stockedBags,
    usedBags,
    totalBags: availableBags,
    stockedKg,
    usedKg,
    totalKg: availableKg,
    totalPurchaseAmount: Number(stockTotals.totalAmount || 0),
    kgPerBag: KG_PER_BAG,
  }
}

export async function listStocksByMaterialSlug(slug) {
  const material = await requireMaterial(slug)
  const [items, stockTotals] = await Promise.all([
    findStocksByMaterialId(material.id),
    sumStocksByMaterialId(material.id),
  ])
  return {
    material,
    items,
    totals: withTotals(stockTotals, material),
  }
}

export async function createStockForMaterialSlug(slug, body) {
  const material = await requireMaterial(slug)
  const payload = normalizeStockInput(body)
  const created = await insertStock({
    rawMaterialId: material.id,
    ...payload,
  })
  const refreshed = await requireMaterial(slug)
  const stockTotals = await sumStocksByMaterialId(material.id)
  return {
    item: created,
    totals: withTotals(stockTotals, refreshed),
  }
}

export async function updateStockForMaterialSlug(slug, stockId, body) {
  const material = await requireMaterial(slug)
  const id = Number(stockId)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid stock id')

  const payload = normalizeStockInput(body)
  const updated = await updateStockById(id, material.id, payload)
  if (!updated) throw notFound('Stock entry not found')

  const refreshed = await requireMaterial(slug)
  const stockTotals = await sumStocksByMaterialId(material.id)
  return {
    item: updated,
    totals: withTotals(stockTotals, refreshed),
  }
}

export async function removeStockForMaterialSlug(slug, stockId) {
  const material = await requireMaterial(slug)
  const id = Number(stockId)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid stock id')

  const deleted = await deleteStockById(id, material.id)
  if (!deleted) throw notFound('Stock entry not found')

  const refreshed = await requireMaterial(slug)
  const stockTotals = await sumStocksByMaterialId(material.id)
  return {
    deleted: true,
    totals: withTotals(stockTotals, refreshed),
  }
}
