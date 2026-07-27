import { getPool } from '../config/db.js'

function mapPreviousBalance(row) {
  return {
    id: row.id,
    supplierId: row.supplier_id,
    date: row.balance_date instanceof Date
      ? row.balance_date.toISOString().slice(0, 10)
      : String(row.balance_date).slice(0, 10),
    amount: Number(row.amount),
    note: row.note || '',
    createdAt: row.created_at,
  }
}

export async function findPreviousBalancesBySupplierId(supplierId) {
  const [rows] = await getPool().query(
    `SELECT id, supplier_id, balance_date, amount, note, created_at
     FROM supplier_previous_balances
     WHERE supplier_id = :supplierId
     ORDER BY balance_date ASC, id ASC`,
    { supplierId },
  )
  return rows.map(mapPreviousBalance)
}

export async function findPreviousBalanceById(id) {
  const [rows] = await getPool().query(
    `SELECT id, supplier_id, balance_date, amount, note, created_at
     FROM supplier_previous_balances WHERE id = :id LIMIT 1`,
    { id },
  )
  return rows[0] ? mapPreviousBalance(rows[0]) : null
}

export async function sumPreviousBalancesBySupplierId(supplierId) {
  const [rows] = await getPool().query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM supplier_previous_balances
     WHERE supplier_id = :supplierId`,
    { supplierId },
  )
  return Number(Number(rows[0]?.total || 0).toFixed(2))
}

export async function insertPreviousBalance({ supplierId, date, amount, note }) {
  const [result] = await getPool().query(
    `INSERT INTO supplier_previous_balances (supplier_id, balance_date, amount, note)
     VALUES (:supplierId, :date, :amount, :note)`,
    {
      supplierId,
      date,
      amount,
      note: note || null,
    },
  )
  return findPreviousBalanceById(result.insertId)
}

export async function updatePreviousBalanceById(id, { date, amount, note }) {
  const [result] = await getPool().query(
    `UPDATE supplier_previous_balances
     SET balance_date = :date, amount = :amount, note = :note
     WHERE id = :id`,
    { id, date, amount, note: note || null },
  )
  if (result.affectedRows === 0) return null
  return findPreviousBalanceById(id)
}

export async function deletePreviousBalanceById(id) {
  const [result] = await getPool().query(
    `DELETE FROM supplier_previous_balances WHERE id = :id`,
    { id },
  )
  return result.affectedRows > 0
}
