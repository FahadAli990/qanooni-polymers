import { getPool } from '../config/db.js'

function mapRow(row) {
  const kg = Number(row.kg)
  const pricePerKg = Number(row.price_per_kg ?? 0)
  return {
    id: row.id,
    rawMaterialId: row.raw_material_id,
    date: row.stock_date instanceof Date
      ? row.stock_date.toISOString().slice(0, 10)
      : String(row.stock_date).slice(0, 10),
    supplierId: row.supplier_id != null ? Number(row.supplier_id) : null,
    supplier: row.supplier,
    bags: Number(row.bags),
    kg,
    pricePerKg,
    totalAmount: Number((kg * pricePerKg).toFixed(2)),
    createdAt: row.created_at,
  }
}

export async function findStocksByMaterialId(rawMaterialId) {
  const [rows] = await getPool().query(
    `SELECT id, raw_material_id, stock_date, supplier, supplier_id, bags, kg, price_per_kg, created_at
     FROM raw_material_stocks
     WHERE raw_material_id = :rawMaterialId
     ORDER BY created_at ASC, id ASC`,
    { rawMaterialId },
  )
  return rows.map(mapRow)
}

export async function sumStocksByMaterialId(rawMaterialId) {
  const [rows] = await getPool().query(
    `SELECT
       COALESCE(SUM(bags), 0) AS total_bags,
       COALESCE(SUM(kg), 0) AS total_kg,
       COALESCE(SUM(kg * price_per_kg), 0) AS total_amount
     FROM raw_material_stocks
     WHERE raw_material_id = :rawMaterialId`,
    { rawMaterialId },
  )
  return {
    totalBags: Number(rows[0]?.total_bags || 0),
    totalKg: Number(rows[0]?.total_kg || 0),
    totalAmount: Number(Number(rows[0]?.total_amount || 0).toFixed(2)),
  }
}

export async function findStockById(id) {
  const [rows] = await getPool().query(
    `SELECT id, raw_material_id, stock_date, supplier, supplier_id, bags, kg, price_per_kg, created_at
     FROM raw_material_stocks
     WHERE id = :id
     LIMIT 1`,
    { id },
  )
  return rows[0] ? mapRow(rows[0]) : null
}

export async function insertStock({
  rawMaterialId,
  date,
  supplier,
  supplierId,
  bags,
  kg,
  pricePerKg,
}) {
  const [result] = await getPool().query(
    `INSERT INTO raw_material_stocks
       (raw_material_id, stock_date, supplier, supplier_id, bags, kg, price_per_kg)
     VALUES
       (:rawMaterialId, :date, :supplier, :supplierId, :bags, :kg, :pricePerKg)`,
    { rawMaterialId, date, supplier, supplierId, bags, kg, pricePerKg },
  )
  return findStockById(result.insertId)
}

export async function updateStockById(
  id,
  rawMaterialId,
  { date, supplier, supplierId, bags, kg, pricePerKg },
) {
  const [result] = await getPool().query(
    `UPDATE raw_material_stocks
     SET stock_date = :date,
         supplier = :supplier,
         supplier_id = :supplierId,
         bags = :bags,
         kg = :kg,
         price_per_kg = :pricePerKg
     WHERE id = :id AND raw_material_id = :rawMaterialId`,
    { id, rawMaterialId, date, supplier, supplierId, bags, kg, pricePerKg },
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
