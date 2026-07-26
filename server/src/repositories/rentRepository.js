import { getPool } from '../config/db.js'

function mapVehicle(row) {
  return {
    id: row.id,
    name: row.name,
    dailyFare: Number(row.daily_fare),
    note: row.note || '',
    createdAt: row.created_at,
  }
}

function mapPayment(row) {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    date: row.payment_date instanceof Date
      ? row.payment_date.toISOString().slice(0, 10)
      : String(row.payment_date).slice(0, 10),
    forDate: row.for_date instanceof Date
      ? row.for_date.toISOString().slice(0, 10)
      : String(row.for_date).slice(0, 10),
    amount: Number(row.amount),
    note: row.note || '',
    createdAt: row.created_at,
  }
}

export async function findAllVehicles() {
  const [rows] = await getPool().query(
    `SELECT id, name, daily_fare, note, created_at
     FROM rent_vehicles
     ORDER BY created_at ASC, id ASC`,
  )
  return rows.map(mapVehicle)
}

export async function findVehicleById(id) {
  const [rows] = await getPool().query(
    `SELECT id, name, daily_fare, note, created_at
     FROM rent_vehicles WHERE id = :id LIMIT 1`,
    { id },
  )
  return rows[0] ? mapVehicle(rows[0]) : null
}

export async function findVehicleByName(name) {
  const [rows] = await getPool().query(
    `SELECT id, name, daily_fare, note, created_at
     FROM rent_vehicles WHERE name = :name LIMIT 1`,
    { name },
  )
  return rows[0] ? mapVehicle(rows[0]) : null
}

export async function insertVehicle({ name, dailyFare, note }) {
  const [result] = await getPool().query(
    `INSERT INTO rent_vehicles (name, daily_fare, note)
     VALUES (:name, :dailyFare, :note)`,
    { name, dailyFare, note: note || null },
  )
  return findVehicleById(result.insertId)
}

export async function updateVehicleById(id, { name, dailyFare, note }) {
  const [result] = await getPool().query(
    `UPDATE rent_vehicles
     SET name = :name, daily_fare = :dailyFare, note = :note
     WHERE id = :id`,
    { id, name, dailyFare, note: note || null },
  )
  if (result.affectedRows === 0) return null
  return findVehicleById(id)
}

export async function deleteVehicleById(id) {
  const [result] = await getPool().query(`DELETE FROM rent_vehicles WHERE id = :id`, { id })
  return result.affectedRows > 0
}

export async function countPaymentsByVehicleId(vehicleId) {
  const [rows] = await getPool().query(
    `SELECT COUNT(*) AS cnt FROM rent_payments WHERE vehicle_id = :vehicleId`,
    { vehicleId },
  )
  return Number(rows[0]?.cnt || 0)
}

export async function findPaymentsByVehicleAndDate(vehicleId, forDate) {
  const [rows] = await getPool().query(
    `SELECT id, vehicle_id, payment_date, for_date, amount, note, created_at
     FROM rent_payments
     WHERE vehicle_id = :vehicleId AND for_date = :forDate
     ORDER BY payment_date ASC, id ASC`,
    { vehicleId, forDate },
  )
  return rows.map(mapPayment)
}

export async function sumPaymentsByVehicleAndDate(vehicleId, forDate) {
  const [rows] = await getPool().query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM rent_payments
     WHERE vehicle_id = :vehicleId AND for_date = :forDate`,
    { vehicleId, forDate },
  )
  return Number(Number(rows[0]?.total || 0).toFixed(2))
}

export async function findRentPaymentById(id) {
  const [rows] = await getPool().query(
    `SELECT id, vehicle_id, payment_date, for_date, amount, note, created_at
     FROM rent_payments WHERE id = :id LIMIT 1`,
    { id },
  )
  return rows[0] ? mapPayment(rows[0]) : null
}

export async function insertRentPayment({ vehicleId, date, forDate, amount, note }) {
  const [result] = await getPool().query(
    `INSERT INTO rent_payments (vehicle_id, payment_date, for_date, amount, note)
     VALUES (:vehicleId, :date, :forDate, :amount, :note)`,
    { vehicleId, date, forDate, amount, note: note || null },
  )
  return findRentPaymentById(result.insertId)
}

export async function updateRentPaymentById(id, { date, forDate, amount, note }) {
  const [result] = await getPool().query(
    `UPDATE rent_payments
     SET payment_date = :date, for_date = :forDate, amount = :amount, note = :note
     WHERE id = :id`,
    { id, date, forDate, amount, note: note || null },
  )
  if (result.affectedRows === 0) return null
  return findRentPaymentById(id)
}

export async function deleteRentPaymentById(id) {
  const [result] = await getPool().query(`DELETE FROM rent_payments WHERE id = :id`, { id })
  return result.affectedRows > 0
}
