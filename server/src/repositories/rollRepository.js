import { getPool } from '../config/db.js'

export const ROLL_SIZES = ['1/2"', '3/4"', '1"']
export const PRODUCTION_KINDS = ['roll', 'chaat', 'dewaar']

function mapRow(row) {
  const kg = Number(row.kg)
  const remainingKg = Number(row.remaining_kg ?? row.kg)
  const status = remainingKg <= 0 || row.status === 'used' ? 'used' : 'available'
  return {
    id: row.id,
    kind: row.kind || 'roll',
    rawMaterialId: row.raw_material_id,
    materialSlug: row.material_slug,
    materialName: row.material_name,
    materialSwatch: row.material_swatch,
    date: row.production_date instanceof Date
      ? row.production_date.toISOString().slice(0, 10)
      : String(row.production_date).slice(0, 10),
    size: row.size,
    kg,
    remainingKg,
    status,
    createdAt: row.created_at,
  }
}

const ROLL_SELECT = `
  r.id,
  r.kind,
  r.raw_material_id,
  r.production_date,
  r.size,
  r.kg,
  r.remaining_kg,
  r.status,
  r.created_at,
  m.slug AS material_slug,
  m.name AS material_name,
  m.swatch AS material_swatch
`

export async function findAllRolls(kind = 'roll') {
  const [rows] = await getPool().query(
    `SELECT ${ROLL_SELECT}
     FROM roll_productions r
     INNER JOIN raw_materials m ON m.id = r.raw_material_id
     WHERE r.kind = :kind
       AND r.remaining_kg > 0
       AND r.status = 'available'
     ORDER BY r.created_at ASC, r.id ASC`,
    { kind },
  )
  return rows.map(mapRow)
}

export async function findRollById(id, executor = null) {
  const db = executor || getPool()
  const [rows] = await db.query(
    `SELECT ${ROLL_SELECT}
     FROM roll_productions r
     INNER JOIN raw_materials m ON m.id = r.raw_material_id
     WHERE r.id = :id
     LIMIT 1`,
    { id },
  )
  return rows[0] ? mapRow(rows[0]) : null
}

/** Original produced kg counts against raw material stock. */
export async function sumRollKgByMaterialId(rawMaterialId) {
  const [rows] = await getPool().query(
    `SELECT COALESCE(SUM(kg), 0) AS used_kg
     FROM roll_productions
     WHERE raw_material_id = :rawMaterialId`,
    { rawMaterialId },
  )
  return Number(rows[0]?.used_kg || 0)
}

/** Remaining finished-goods kg still available to sell. */
export async function sumAllRollKg(kind = 'roll') {
  const [rows] = await getPool().query(
    `SELECT COALESCE(SUM(remaining_kg), 0) AS total_kg
     FROM roll_productions
     WHERE kind = :kind`,
    { kind },
  )
  return Number(rows[0]?.total_kg || 0)
}

export async function sumAvailableProductionKg({ kind, size, rawMaterialId }, executor = null) {
  const db = executor || getPool()
  const [rows] = await db.query(
    `SELECT COALESCE(SUM(remaining_kg), 0) AS total_kg
     FROM roll_productions
     WHERE kind = :kind
       AND size = :size
       AND raw_material_id = :rawMaterialId
       AND remaining_kg > 0
       AND status = 'available'`,
    { kind, size, rawMaterialId },
  )
  return Number(rows[0]?.total_kg || 0)
}

/**
 * FIFO: consume oldest production dates first for matching kind+size+material.
 * Marks status=used when remaining hits 0; partial takes spill to next date.
 */
export async function consumeProductionFifo(
  { kind, size, rawMaterialId, kg },
  executor,
) {
  const need = Number(Number(kg).toFixed(2))
  if (!(need > 0)) {
    const error = new Error('KG to consume must be positive')
    error.status = 400
    throw error
  }

  const [lots] = await executor.query(
    `SELECT id, remaining_kg, production_date
     FROM roll_productions
     WHERE kind = :kind
       AND size = :size
       AND raw_material_id = :rawMaterialId
       AND remaining_kg > 0
       AND status = 'available'
     ORDER BY production_date ASC, id ASC
     FOR UPDATE`,
    { kind, size, rawMaterialId },
  )

  let left = need
  for (const lot of lots) {
    if (left <= 0) break
    const remaining = Number(lot.remaining_kg)
    const take = Number(Math.min(remaining, left).toFixed(2))
    const nextRemaining = Number((remaining - take).toFixed(2))
    const status = nextRemaining <= 0 ? 'used' : 'available'
    await executor.query(
      `UPDATE roll_productions
       SET remaining_kg = :remainingKg,
           status = :status
       WHERE id = :id`,
      {
        id: lot.id,
        remainingKg: Math.max(0, nextRemaining),
        status,
      },
    )
    left = Number((left - take).toFixed(2))
  }

  if (left > 1e-9) {
    return { ok: false, shortfall: left, consumed: Number((need - left).toFixed(2)) }
  }
  return { ok: true, shortfall: 0, consumed: need }
}

export async function insertRoll({ kind, rawMaterialId, date, size, kg }) {
  const [result] = await getPool().query(
    `INSERT INTO roll_productions
       (kind, raw_material_id, production_date, size, kg, remaining_kg, status)
     VALUES
       (:kind, :rawMaterialId, :date, :size, :kg, :kg, 'available')`,
    { kind, rawMaterialId, date, size, kg },
  )
  return findRollById(result.insertId)
}

export async function updateRollById(id, { kind, rawMaterialId, date, size, kg, remainingKg, status }) {
  const [result] = await getPool().query(
    `UPDATE roll_productions
     SET kind = :kind,
         raw_material_id = :rawMaterialId,
         production_date = :date,
         size = :size,
         kg = :kg,
         remaining_kg = :remainingKg,
         status = :status
     WHERE id = :id AND kind = :kind`,
    { id, kind, rawMaterialId, date, size, kg, remainingKg, status },
  )
  if (result.affectedRows === 0) return null
  return findRollById(id)
}

export async function deleteRollById(id, kind = null) {
  if (kind) {
    const [result] = await getPool().query(
      `DELETE FROM roll_productions WHERE id = :id AND kind = :kind`,
      { id, kind },
    )
    return result.affectedRows > 0
  }
  const [result] = await getPool().query(
    `DELETE FROM roll_productions WHERE id = :id`,
    { id },
  )
  return result.affectedRows > 0
}
