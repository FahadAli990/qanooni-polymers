import { getPool } from '../config/db.js'

function mapRow(row) {
  return {
    id: row.id,
    supplierId: row.supplier_id,
    date: row.payment_date instanceof Date
      ? row.payment_date.toISOString().slice(0, 10)
      : String(row.payment_date).slice(0, 10),
    amount: Number(row.amount),
    note: row.note || '',
    createdAt: row.created_at,
  }
}

export async function findPaymentsBySupplierId(supplierId) {
  const [rows] = await getPool().query(
    `SELECT id, supplier_id, payment_date, amount, note, created_at
     FROM supplier_payments
     WHERE supplier_id = :supplierId
     ORDER BY payment_date ASC, id ASC`,
    { supplierId },
  )
  return rows.map(mapRow)
}

export async function sumPaymentsBySupplierId(supplierId) {
  const [rows] = await getPool().query(
    `SELECT COALESCE(SUM(amount), 0) AS total_paid
     FROM supplier_payments
     WHERE supplier_id = :supplierId`,
    { supplierId },
  )
  return Number(rows[0]?.total_paid || 0)
}

export async function findSupplierPaymentById(id) {
  const [rows] = await getPool().query(
    `SELECT id, supplier_id, payment_date, amount, note, created_at
     FROM supplier_payments
     WHERE id = :id
     LIMIT 1`,
    { id },
  )
  return rows[0] ? mapRow(rows[0]) : null
}

export async function insertSupplierPayment({ supplierId, date, amount, note }) {
  const [result] = await getPool().query(
    `INSERT INTO supplier_payments (supplier_id, payment_date, amount, note)
     VALUES (:supplierId, :date, :amount, :note)`,
    { supplierId, date, amount, note: note || null },
  )
  return findSupplierPaymentById(result.insertId)
}

export async function updateSupplierPaymentById(id, { date, amount, note }) {
  const [result] = await getPool().query(
    `UPDATE supplier_payments
     SET payment_date = :date, amount = :amount, note = :note
     WHERE id = :id`,
    { id, date, amount, note: note || null },
  )
  if (result.affectedRows === 0) return null
  return findSupplierPaymentById(id)
}

export async function deleteSupplierPaymentById(id) {
  const [result] = await getPool().query(`DELETE FROM supplier_payments WHERE id = :id`, { id })
  return result.affectedRows > 0
}
