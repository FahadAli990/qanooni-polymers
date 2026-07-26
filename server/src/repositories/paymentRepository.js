import { getPool } from '../config/db.js'

function mapRow(row) {
  return {
    id: row.id,
    routeCustomerId: row.route_customer_id,
    date: row.payment_date instanceof Date
      ? row.payment_date.toISOString().slice(0, 10)
      : String(row.payment_date).slice(0, 10),
    amount: Number(row.amount),
    note: row.note || '',
    createdAt: row.created_at,
  }
}

export async function findPaymentsByCustomerId(routeCustomerId) {
  const [rows] = await getPool().query(
    `SELECT id, route_customer_id, payment_date, amount, note, created_at
     FROM customer_payments
     WHERE route_customer_id = :routeCustomerId
     ORDER BY payment_date ASC, id ASC`,
    { routeCustomerId },
  )
  return rows.map(mapRow)
}

export async function sumPaymentsByCustomerId(routeCustomerId) {
  const [rows] = await getPool().query(
    `SELECT COALESCE(SUM(amount), 0) AS total_paid
     FROM customer_payments
     WHERE route_customer_id = :routeCustomerId`,
    { routeCustomerId },
  )
  return Number(rows[0]?.total_paid || 0)
}

export async function findPaymentById(id) {
  const [rows] = await getPool().query(
    `SELECT id, route_customer_id, payment_date, amount, note, created_at
     FROM customer_payments
     WHERE id = :id
     LIMIT 1`,
    { id },
  )
  return rows[0] ? mapRow(rows[0]) : null
}

export async function insertPayment({ routeCustomerId, date, amount, note }) {
  const [result] = await getPool().query(
    `INSERT INTO customer_payments (route_customer_id, payment_date, amount, note)
     VALUES (:routeCustomerId, :date, :amount, :note)`,
    {
      routeCustomerId,
      date,
      amount,
      note: note || null,
    },
  )
  return findPaymentById(result.insertId)
}

export async function updatePaymentById(id, { date, amount, note }) {
  const [result] = await getPool().query(
    `UPDATE customer_payments
     SET payment_date = :date,
         amount = :amount,
         note = :note
     WHERE id = :id`,
    {
      id,
      date,
      amount,
      note: note || null,
    },
  )
  if (result.affectedRows === 0) return null
  return findPaymentById(id)
}

export async function deletePaymentById(id) {
  const [result] = await getPool().query(
    `DELETE FROM customer_payments WHERE id = :id`,
    { id },
  )
  return result.affectedRows > 0
}
