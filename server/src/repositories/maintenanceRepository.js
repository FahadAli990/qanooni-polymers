import { getPool } from '../config/db.js'

function mapRow(row) {
  return {
    id: row.id,
    date: row.expense_date instanceof Date
      ? row.expense_date.toISOString().slice(0, 10)
      : String(row.expense_date).slice(0, 10),
    title: row.title,
    amount: Number(row.amount),
    note: row.note || '',
    createdAt: row.created_at,
  }
}

export async function findMaintenanceByDate(date) {
  const [rows] = await getPool().query(
    `SELECT id, expense_date, title, amount, note, created_at
     FROM maintenance_expenses
     WHERE expense_date = :date
     ORDER BY created_at ASC, id ASC`,
    { date },
  )
  return rows.map(mapRow)
}

export async function findMaintenanceById(id) {
  const [rows] = await getPool().query(
    `SELECT id, expense_date, title, amount, note, created_at
     FROM maintenance_expenses
     WHERE id = :id
     LIMIT 1`,
    { id },
  )
  return rows[0] ? mapRow(rows[0]) : null
}

export async function sumMaintenanceByDate(date) {
  const [rows] = await getPool().query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM maintenance_expenses
     WHERE expense_date = :date`,
    { date },
  )
  return Number(Number(rows[0]?.total || 0).toFixed(2))
}

export async function sumAllMaintenance() {
  const [rows] = await getPool().query(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM maintenance_expenses`,
  )
  return Number(Number(rows[0]?.total || 0).toFixed(2))
}

export async function insertMaintenance({ date, title, amount, note }) {
  const [result] = await getPool().query(
    `INSERT INTO maintenance_expenses (expense_date, title, amount, note)
     VALUES (:date, :title, :amount, :note)`,
    { date, title, amount, note: note || null },
  )
  return findMaintenanceById(result.insertId)
}

export async function updateMaintenanceById(id, { date, title, amount, note }) {
  const [result] = await getPool().query(
    `UPDATE maintenance_expenses
     SET expense_date = :date, title = :title, amount = :amount, note = :note
     WHERE id = :id`,
    { id, date, title, amount, note: note || null },
  )
  if (result.affectedRows === 0) return null
  return findMaintenanceById(id)
}

export async function deleteMaintenanceById(id) {
  const [result] = await getPool().query(`DELETE FROM maintenance_expenses WHERE id = :id`, { id })
  return result.affectedRows > 0
}
