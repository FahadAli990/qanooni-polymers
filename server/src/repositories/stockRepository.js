import { getPool } from '../config/db.js'

function mapRow(row) {
  return {
    id: row.id,
    rawMaterialId: row.raw_material_id,
    date: row.stock_date instanceof Date
      ? row.stock_date.toISOString().slice(0, 10)
      : String(row.stock_date).slice(0, 10),
    supplier: row.supplier,
    bags: Number(row.bags),
    kg: Number(row.kg),
    createdAt: row.created_at,
  }
}

export async function findStocksByMaterialId(rawMaterialId) {
  const [rows] = await getPool().query(
    `SELECT id, raw_material_id, stock_date, supplier, bags, kg, created_at
     FROM raw_material_stocks
     WHERE raw_material_id = :rawMaterialId
     ORDER BY stock_date DESC, id DESC`,
    { rawMaterialId },
  )
  return rows.map(mapRow)
}

export async function sumStocksByMaterialId(rawMaterialId) {
  const [rows] = await getPool().query(
    `SELECT
       COALESCE(SUM(bags), 0) AS total_bags,
       COALESCE(SUM(kg), 0) AS total_kg
     FROM raw_material_stocks
     WHERE raw_material_id = :rawMaterialId`,
    { rawMaterialId },
  )
  return {
    totalBags: Number(rows[0]?.total_bags || 0),
    totalKg: Number(rows[0]?.total_kg || 0),
  }
}

export async function findStockById(id) {
  const [rows] = await getPool().query(
    `SELECT id, raw_material_id, stock_date, supplier, bags, kg, created_at
     FROM raw_material_stocks
     WHERE id = :id
     LIMIT 1`,
    { id },
  )
  return rows[0] ? mapRow(rows[0]) : null
}

export async function insertStock({ rawMaterialId, date, supplier, bags, kg }) {
  const [result] = await getPool().query(
    `INSERT INTO raw_material_stocks (raw_material_id, stock_date, supplier, bags, kg)
     VALUES (:rawMaterialId, :date, :supplier, :bags, :kg)`,
    { rawMaterialId, date, supplier, bags, kg },
  )
  return findStockById(result.insertId)
}

export async function updateStockById(id, rawMaterialId, { date, supplier, bags, kg }) {
  const [result] = await getPool().query(
    `UPDATE raw_material_stocks
     SET stock_date = :date, supplier = :supplier, bags = :bags, kg = :kg
     WHERE id = :id AND raw_material_id = :rawMaterialId`,
    { id, rawMaterialId, date, supplier, bags, kg },
  )
  if (result.affectedRows === 0) return null
  return findStockById(id)
}

export async function deleteStockById(id, rawMaterialId) {
  const [result] = await getPool().query(
    `DELETE FROM raw_material_stocks
     WHERE id = :id AND raw_material_id = :rawMaterialId`,
    { id, rawMaterialId },
  )
  return result.affectedRows > 0
}
