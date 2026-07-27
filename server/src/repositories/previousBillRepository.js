import { getPool } from '../config/db.js'

function mapPreviousBill(row) {
  return {
    id: row.id,
    routeCustomerId: row.route_customer_id,
    date: row.bill_date instanceof Date
      ? row.bill_date.toISOString().slice(0, 10)
      : String(row.bill_date).slice(0, 10),
    amount: Number(row.amount),
    note: row.note || '',
    createdAt: row.created_at,
  }
}

export async function findPreviousBillsByCustomerId(routeCustomerId) {
  const [rows] = await getPool().query(
    `SELECT id, route_customer_id, bill_date, amount, note, created_at
     FROM customer_previous_bills
     WHERE route_customer_id = :routeCustomerId
     ORDER BY bill_date ASC, id ASC`,
    { routeCustomerId },
  )
  return rows.map(mapPreviousBill)
}

export async function findPreviousBillById(id) {
  const [rows] = await getPool().query(
    `SELECT id, route_customer_id, bill_date, amount, note, created_at
     FROM customer_previous_bills WHERE id = :id LIMIT 1`,
    { id },
  )
  return rows[0] ? mapPreviousBill(rows[0]) : null
}

export async function insertPreviousBill({ routeCustomerId, date, amount, note }) {
  const [result] = await getPool().query(
    `INSERT INTO customer_previous_bills (route_customer_id, bill_date, amount, note)
     VALUES (:routeCustomerId, :date, :amount, :note)`,
    {
      routeCustomerId,
      date,
      amount,
      note: note || null,
    },
  )
  return findPreviousBillById(result.insertId)
}

export async function updatePreviousBillById(id, { date, amount, note }) {
  const [result] = await getPool().query(
    `UPDATE customer_previous_bills
     SET bill_date = :date, amount = :amount, note = :note
     WHERE id = :id`,
    { id, date, amount, note: note || null },
  )
  if (result.affectedRows === 0) return null
  return findPreviousBillById(id)
}

export async function deletePreviousBillById(id) {
  const [result] = await getPool().query(
    `DELETE FROM customer_previous_bills WHERE id = :id`,
    { id },
  )
  return result.affectedRows > 0
}
