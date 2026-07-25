import { findRawMaterialBySlug } from '../repositories/rawMaterialRepository.js'
import { sumStocksByMaterialId } from '../repositories/stockRepository.js'
import {
  ROLL_SIZES,
  deleteRollById,
  findAllRolls,
  findRollById,
  insertRoll,
  sumAllRollKg,
  sumRollKgByMaterialId,
  updateRollById,
} from '../repositories/rollRepository.js'

function notFound(message = 'Roll production not found') {
  const error = new Error(message)
  error.status = 404
  return error
}

function badRequest(message) {
  const error = new Error(message)
  error.status = 400
  return error
}

async function availableKgForMaterial(rawMaterialId, excludeRollId = null) {
  const stocked = await sumStocksByMaterialId(rawMaterialId)
  let used = await sumRollKgByMaterialId(rawMaterialId)
  if (excludeRollId) {
    const existing = await findRollById(excludeRollId)
    if (existing && existing.rawMaterialId === rawMaterialId) {
      used -= Number(existing.kg || 0)
    }
  }
  return Number((stocked.totalKg - used).toFixed(2))
}

function normalizeRollInput(body) {
  const date = String(body?.date || '').trim()
  const materialSlug = String(body?.materialSlug || body?.slug || '').trim()
  const size = String(body?.size || '').trim()
  const kg = Number(body?.kg)

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw badRequest('Date is required (YYYY-MM-DD)')
  }
  if (!materialSlug) throw badRequest('Color / raw material is required')
  if (!ROLL_SIZES.includes(size)) {
    throw badRequest(`Size must be one of: ${ROLL_SIZES.join(', ')}`)
  }
  if (!Number.isFinite(kg) || kg <= 0) {
    throw badRequest('KG must be a positive number')
  }

  return {
    date,
    materialSlug,
    size,
    kg: Number(kg.toFixed(2)),
  }
}

export async function listRollProductions() {
  const items = await findAllRolls()
  const totalKg = await sumAllRollKg()
  return {
    items,
    sizes: ROLL_SIZES,
    totals: { totalKg },
  }
}

export async function createRollProduction(body) {
  const payload = normalizeRollInput(body)
  const material = await findRawMaterialBySlug(payload.materialSlug)
  if (!material) throw notFound('Raw material not found')

  const available = await availableKgForMaterial(material.id)
  if (payload.kg > available) {
    throw badRequest(
      `Not enough ${material.name} stock. Available ${available} kg, requested ${payload.kg} kg`,
    )
  }

  const item = await insertRoll({
    rawMaterialId: material.id,
    date: payload.date,
    size: payload.size,
    kg: payload.kg,
  })
  const totalKg = await sumAllRollKg()
  return {
    item,
    totals: { totalKg },
    availableKg: await availableKgForMaterial(material.id),
  }
}

export async function updateRollProduction(rollId, body) {
  const id = Number(rollId)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid roll id')

  const existing = await findRollById(id)
  if (!existing) throw notFound()

  const payload = normalizeRollInput(body)
  const material = await findRawMaterialBySlug(payload.materialSlug)
  if (!material) throw notFound('Raw material not found')

  const available = await availableKgForMaterial(material.id, id)
  if (payload.kg > available) {
    throw badRequest(
      `Not enough ${material.name} stock. Available ${available} kg, requested ${payload.kg} kg`,
    )
  }

  const item = await updateRollById(id, {
    rawMaterialId: material.id,
    date: payload.date,
    size: payload.size,
    kg: payload.kg,
  })
  const totalKg = await sumAllRollKg()
  return {
    item,
    totals: { totalKg },
    availableKg: await availableKgForMaterial(material.id),
  }
}

export async function removeRollProduction(rollId) {
  const id = Number(rollId)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid roll id')

  const existing = await findRollById(id)
  if (!existing) throw notFound()

  const deleted = await deleteRollById(id)
  if (!deleted) throw notFound()

  const totalKg = await sumAllRollKg()
  return {
    deleted: true,
    totals: { totalKg },
    availableKg: await availableKgForMaterial(existing.rawMaterialId),
  }
}

export async function getMaterialAvailability(slug) {
  const material = await findRawMaterialBySlug(slug)
  if (!material) throw notFound('Raw material not found')
  const stocked = await sumStocksByMaterialId(material.id)
  const usedKg = await sumRollKgByMaterialId(material.id)
  const availableKg = Number((stocked.totalKg - usedKg).toFixed(2))
  return {
    material,
    stockedKg: stocked.totalKg,
    usedKg,
    availableKg,
  }
}
