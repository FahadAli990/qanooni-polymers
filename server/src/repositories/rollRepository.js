import { getPool } from '../config/db.js'

export const ROLL_SIZES = ['1/2"', '3/4"', '1"']
export const PRODUCTION_KINDS = ['roll', 'chaat', 'dewaar']

function mapRow(row) {
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
    kg: Number(row.kg),
    createdAt: row.created_at,
  }
}

export async function findAllRolls(kind = 'roll') {
  const [rows] = await getPool().query(
    `SELECT
       r.id,
       r.kind,
       r.raw_material_id,
       r.production_date,
       r.size,
       r.kg,
       r.created_at,
       m.slug AS material_slug,
       m.name AS material_name,
       m.swatch AS material_swatch
     FROM roll_productions r
     INNER JOIN raw_materials m ON m.id = r.raw_material_id
     WHERE r.kind = :kind
     ORDER BY r.production_date DESC, r.id DESC`,
    { kind },
  )
  return rows.map(mapRow)
}

export async function findRollById(id) {
  const [rows] = await getPool().query(
    `SELECT
       r.id,
       r.kind,
       r.raw_material_id,
       r.production_date,
       r.size,
       r.kg,
       r.created_at,
       m.slug AS material_slug,
       m.name AS material_name,
       m.swatch AS material_swatch
     FROM roll_productions r
     INNER JOIN raw_materials m ON m.id = r.raw_material_id
     WHERE r.id = :id
     LIMIT 1`,
    { id },
  )
  return rows[0] ? mapRow(rows[0]) : null
}

/** All production kinds count against raw material stock. */
export async function sumRollKgByMaterialId(rawMaterialId) {
  const [rows] = await getPool().query(
    `SELECT COALESCE(SUM(kg), 0) AS used_kg
     FROM roll_productions
     WHERE raw_material_id = :rawMaterialId`,
    { rawMaterialId },
  )
  return Number(rows[0]?.used_kg || 0)
}

export async function sumAllRollKg(kind = 'roll') {
  const [rows] = await getPool().query(
    `SELECT COALESCE(SUM(kg), 0) AS total_kg
     FROM roll_productions
     WHERE kind = :kind`,
    { kind },
  )
  return Number(rows[0]?.total_kg || 0)
}

export async function insertRoll({ kind, rawMaterialId, date, size, kg }) {
  const [result] = await getPool().query(
    `INSERT INTO roll_productions (kind, raw_material_id, production_date, size, kg)
     VALUES (:kind, :rawMaterialId, :date, :size, :kg)`,
    { kind, rawMaterialId, date, size, kg },
  )
  return findRollById(result.insertId)
}

export async function updateRollById(id, { kind, rawMaterialId, date, size, kg }) {
  const [result] = await getPool().query(
    `UPDATE roll_productions
     SET kind = :kind,
         raw_material_id = :rawMaterialId,
         production_date = :date,
         size = :size,
         kg = :kg
     WHERE id = :id AND kind = :kind`,
    { id, kind, rawMaterialId, date, size, kg },
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
