import { findRawMaterialBySlug } from '../repositories/rawMaterialRepository.js'
import {
  deleteStockById,
  findStocksByMaterialId,
  insertStock,
  sumStocksByMaterialId,
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

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw badRequest('Date is required (YYYY-MM-DD)')
  }

  if (!supplier) throw badRequest('Supplier is required')
  if (supplier.length > 160) throw badRequest('Supplier must be 160 characters or less')

  const bags = Number(bagsRaw)
  if (!Number.isFinite(bags) || bags <= 0) {
    throw badRequest('Quantity (bags) must be a positive number')
  }

  const kg = Number((bags * KG_PER_BAG).toFixed(2))
  return { date, supplier, bags: Number(bags.toFixed(2)), kg }
}

export async function listStocksByMaterialSlug(slug) {
  const material = await requireMaterial(slug)
  const [items, totals] = await Promise.all([
    findStocksByMaterialId(material.id),
    sumStocksByMaterialId(material.id),
  ])
  return {
    material,
    items,
    totals: {
      totalBags: totals.totalBags,
      totalKg: totals.totalKg,
      kgPerBag: KG_PER_BAG,
    },
  }
}

export async function createStockForMaterialSlug(slug, body) {
  const material = await requireMaterial(slug)
  const payload = normalizeStockInput(body)
  const created = await insertStock({
    rawMaterialId: material.id,
    ...payload,
  })
  const totals = await sumStocksByMaterialId(material.id)
  return {
    item: created,
    totals: {
      totalBags: totals.totalBags,
      totalKg: totals.totalKg,
      kgPerBag: KG_PER_BAG,
    },
  }
}

export async function removeStockForMaterialSlug(slug, stockId) {
  const material = await requireMaterial(slug)
  const id = Number(stockId)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid stock id')

  const deleted = await deleteStockById(id, material.id)
  if (!deleted) throw notFound('Stock entry not found')

  const totals = await sumStocksByMaterialId(material.id)
  return {
    deleted: true,
    totals: {
      totalBags: totals.totalBags,
      totalKg: totals.totalKg,
      kgPerBag: KG_PER_BAG,
    },
  }
}
