import { getPool } from '../config/db.js'

function mapRow(row) {
  return {
    id: row.id,
    name: row.name,
    contact: row.contact,
    createdAt: row.created_at,
  }
}

export async function findAllSuppliers() {
  const [rows] = await getPool().query(
    `SELECT id, name, contact, created_at
     FROM suppliers
     ORDER BY created_at ASC, id ASC`,
  )
  return rows.map(mapRow)
}

export async function findSupplierById(id) {
  const [rows] = await getPool().query(
    `SELECT id, name, contact, created_at
     FROM suppliers
     WHERE id = :id
     LIMIT 1`,
    { id },
  )
  return rows[0] ? mapRow(rows[0]) : null
}

export async function findSupplierByName(name) {
  const [rows] = await getPool().query(
    `SELECT id, name, contact, created_at
     FROM suppliers
     WHERE name = :name
     LIMIT 1`,
    { name },
  )
  return rows[0] ? mapRow(rows[0]) : null
}

export async function insertSupplier({ name, contact }) {
  const [result] = await getPool().query(
    `INSERT INTO suppliers (name, contact) VALUES (:name, :contact)`,
    { name, contact },
  )
  return findSupplierById(result.insertId)
}

export async function updateSupplierById(id, { name, contact }) {
  const [result] = await getPool().query(
    `UPDATE suppliers SET name = :name, contact = :contact WHERE id = :id`,
    { id, name, contact },
  )
  if (result.affectedRows === 0) return null
  return findSupplierById(id)
}

export async function deleteSupplierById(id) {
  const [result] = await getPool().query(`DELETE FROM suppliers WHERE id = :id`, { id })
  return result.affectedRows > 0
}

export async function findPurchasesBySupplierId(supplierId) {
  const [rows] = await getPool().query(
    `SELECT
       s.id,
       s.stock_date,
       s.bags,
       s.kg,
       s.price_per_kg,
       s.supplier,
       m.name AS material_name,
       m.slug AS material_slug,
       m.swatch AS material_swatch
     FROM raw_material_stocks s
     INNER JOIN raw_materials m ON m.id = s.raw_material_id
     WHERE s.supplier_id = :supplierId
     ORDER BY s.stock_date ASC, s.id ASC`,
    { supplierId },
  )
  return rows.map((row) => {
    const kg = Number(row.kg)
    const pricePerKg = Number(row.price_per_kg || 0)
    return {
      id: row.id,
      date: row.stock_date instanceof Date
        ? row.stock_date.toISOString().slice(0, 10)
        : String(row.stock_date).slice(0, 10),
      bags: Number(row.bags),
      kg,
      pricePerKg,
      totalAmount: Number((kg * pricePerKg).toFixed(2)),
      materialName: row.material_name,
      materialSlug: row.material_slug,
      materialSwatch: row.material_swatch,
      supplierName: row.supplier,
    }
  })
}

export async function sumPurchasesBySupplierId(supplierId) {
  const [rows] = await getPool().query(
    `SELECT COALESCE(SUM(kg * price_per_kg), 0) AS total_purchased
     FROM raw_material_stocks
     WHERE supplier_id = :supplierId`,
    { supplierId },
  )
  return Number(Number(rows[0]?.total_purchased || 0).toFixed(2))
}
