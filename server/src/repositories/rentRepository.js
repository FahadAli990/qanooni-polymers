import { getPool } from '../config/db.js'

function mapVehicle(row) {
  return {
    id: row.id,
    name: row.name,
    note: row.note || '',
    createdAt: row.created_at,
  }
}

function mapTrip(row) {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    date: row.trip_date instanceof Date
      ? row.trip_date.toISOString().slice(0, 10)
      : String(row.trip_date).slice(0, 10),
    destination: row.destination || '',
    fareAmount: Number(row.fare_amount),
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
    amount: Number(row.amount),
    note: row.note || '',
    createdAt: row.created_at,
  }
}

export async function findAllVehicles() {
  const [rows] = await getPool().query(
    `SELECT id, name, note, created_at
     FROM rent_vehicles
     ORDER BY created_at ASC, id ASC`,
  )
  return rows.map(mapVehicle)
}

export async function findVehicleById(id) {
  const [rows] = await getPool().query(
    `SELECT id, name, note, created_at FROM rent_vehicles WHERE id = :id LIMIT 1`,
    { id },
  )
  return rows[0] ? mapVehicle(rows[0]) : null
}

export async function findVehicleByName(name) {
  const [rows] = await getPool().query(
    `SELECT id, name, note, created_at FROM rent_vehicles WHERE name = :name LIMIT 1`,
    { name },
  )
  return rows[0] ? mapVehicle(rows[0]) : null
}

export async function insertVehicle({ name, note }) {
  const [result] = await getPool().query(
    `INSERT INTO rent_vehicles (name, note) VALUES (:name, :note)`,
    { name, note: note || null },
  )
  return findVehicleById(result.insertId)
}

export async function updateVehicleById(id, { name, note }) {
  const [result] = await getPool().query(
    `UPDATE rent_vehicles SET name = :name, note = :note WHERE id = :id`,
    { id, name, note: note || null },
  )
  if (result.affectedRows === 0) return null
  return findVehicleById(id)
}

export async function deleteVehicleById(id) {
  const [result] = await getPool().query(`DELETE FROM rent_vehicles WHERE id = :id`, { id })
  return result.affectedRows > 0
}

export async function countTripsByVehicleId(vehicleId) {
  const [rows] = await getPool().query(
    `SELECT COUNT(*) AS cnt FROM rent_trips WHERE vehicle_id = :vehicleId`,
    { vehicleId },
  )
  return Number(rows[0]?.cnt || 0)
}

export async function countPaymentsByVehicleId(vehicleId) {
  const [rows] = await getPool().query(
    `SELECT COUNT(*) AS cnt FROM rent_payments WHERE vehicle_id = :vehicleId`,
    { vehicleId },
  )
  return Number(rows[0]?.cnt || 0)
}

export async function findTripsByVehicleId(vehicleId) {
  const [rows] = await getPool().query(
    `SELECT id, vehicle_id, trip_date, destination, fare_amount, note, created_at
     FROM rent_trips
     WHERE vehicle_id = :vehicleId
     ORDER BY trip_date ASC, id ASC`,
    { vehicleId },
  )
  return rows.map(mapTrip)
}

export async function sumFaresByVehicleId(vehicleId) {
  const [rows] = await getPool().query(
    `SELECT COALESCE(SUM(fare_amount), 0) AS total
     FROM rent_trips WHERE vehicle_id = :vehicleId`,
    { vehicleId },
  )
  return Number(Number(rows[0]?.total || 0).toFixed(2))
}

export async function findTripById(id) {
  const [rows] = await getPool().query(
    `SELECT id, vehicle_id, trip_date, destination, fare_amount, note, created_at
     FROM rent_trips WHERE id = :id LIMIT 1`,
    { id },
  )
  return rows[0] ? mapTrip(rows[0]) : null
}

export async function insertTrip({ vehicleId, date, destination, fareAmount, note }) {
  const [result] = await getPool().query(
    `INSERT INTO rent_trips (vehicle_id, trip_date, destination, fare_amount, note)
     VALUES (:vehicleId, :date, :destination, :fareAmount, :note)`,
    { vehicleId, date, destination, fareAmount, note: note || null },
  )
  return findTripById(result.insertId)
}

export async function updateTripById(id, { date, destination, fareAmount, note }) {
  const [result] = await getPool().query(
    `UPDATE rent_trips
     SET trip_date = :date, destination = :destination, fare_amount = :fareAmount, note = :note
     WHERE id = :id`,
    { id, date, destination, fareAmount, note: note || null },
  )
  if (result.affectedRows === 0) return null
  return findTripById(id)
}

export async function deleteTripById(id) {
  const [result] = await getPool().query(`DELETE FROM rent_trips WHERE id = :id`, { id })
  return result.affectedRows > 0
}

export async function findPaymentsByVehicleId(vehicleId) {
  const [rows] = await getPool().query(
    `SELECT id, vehicle_id, payment_date, amount, note, created_at
     FROM rent_payments
     WHERE vehicle_id = :vehicleId
     ORDER BY payment_date ASC, id ASC`,
    { vehicleId },
  )
  return rows.map(mapPayment)
}

export async function sumPaymentsByVehicleId(vehicleId) {
  const [rows] = await getPool().query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM rent_payments WHERE vehicle_id = :vehicleId`,
    { vehicleId },
  )
  return Number(Number(rows[0]?.total || 0).toFixed(2))
}

export async function findRentPaymentById(id) {
  const [rows] = await getPool().query(
    `SELECT id, vehicle_id, payment_date, amount, note, created_at
     FROM rent_payments WHERE id = :id LIMIT 1`,
    { id },
  )
  return rows[0] ? mapPayment(rows[0]) : null
}

export async function insertRentPayment({ vehicleId, date, amount, note }) {
  const [result] = await getPool().query(
    `INSERT INTO rent_payments (vehicle_id, payment_date, amount, note)
     VALUES (:vehicleId, :date, :amount, :note)`,
    { vehicleId, date, amount, note: note || null },
  )
  return findRentPaymentById(result.insertId)
}

export async function updateRentPaymentById(id, { date, amount, note }) {
  const [result] = await getPool().query(
    `UPDATE rent_payments
     SET payment_date = :date, amount = :amount, note = :note
     WHERE id = :id`,
    { id, date, amount, note: note || null },
  )
  if (result.affectedRows === 0) return null
  return findRentPaymentById(id)
}

export async function deleteRentPaymentById(id) {
  const [result] = await getPool().query(`DELETE FROM rent_payments WHERE id = :id`, { id })
  return result.affectedRows > 0
}
