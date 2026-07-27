import { findRawMaterialBySlug } from '../repositories/rawMaterialRepository.js'
import { findSupplierById } from '../repositories/supplierRepository.js'
import {
  deleteStockById,
  findStockById,
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

async function normalizeStockInput(body, { existing = null } = {}) {
  const date = String(body?.date || '').trim()
  const bagsRaw = body?.bags
  const priceRaw = body?.pricePerKg ?? body?.price_per_kg
  const supplierIdRaw = body?.supplierId ?? body?.supplier_id
  const previousFlag = body?.previous ?? body?.isPrevious ?? body?.is_previous
  const isPrevious = existing
    ? Boolean(existing.isPrevious)
    : Boolean(previousFlag)

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw badRequest('Date is required (YYYY-MM-DD)')
  }

  const bags = Number(bagsRaw)
  if (!Number.isFinite(bags) || bags <= 0 || !Number.isInteger(bags)) {
    throw badRequest('Quantity (bags) must be a whole number (1, 2, 3...)')
  }

  const kg = Number((bags * KG_PER_BAG).toFixed(2))

  if (isPrevious) {
    return {
      date,
      supplierId: null,
      supplier: 'Previous stock',
      bags,
      kg,
      pricePerKg: 0,
      isPrevious: true,
    }
  }

  const supplierId = Number(supplierIdRaw)
  if (!Number.isInteger(supplierId) || supplierId <= 0) {
    throw badRequest('Supplier is required')
  }
  const supplierRow = await findSupplierById(supplierId)
  if (!supplierRow) throw badRequest('Selected supplier not found')

  const pricePerKg = Number(priceRaw)
  if (!Number.isFinite(pricePerKg) || pricePerKg <= 0) {
    throw badRequest('Purchase price per kg is required and must be greater than zero')
  }

  return {
    date,
    supplierId: supplierRow.id,
    supplier: supplierRow.name,
    bags,
    kg,
    pricePerKg: Number(pricePerKg.toFixed(2)),
    isPrevious: false,
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
  const payload = await normalizeStockInput(body)
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

  const existing = await findStockById(id)
  if (!existing || existing.rawMaterialId !== material.id) {
    throw notFound('Stock entry not found')
  }

  const payload = await normalizeStockInput(body, { existing })
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
