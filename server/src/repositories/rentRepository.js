import { getPool } from '../config/db.js'

function mapBuilding(row) {
  return {
    id: row.id,
    name: row.name,
    monthlyRent: Number(row.monthly_rent),
    note: row.note || '',
    createdAt: row.created_at,
  }
}

function mapPayment(row) {
  const forMonthRaw = row.for_month instanceof Date
    ? row.for_month.toISOString().slice(0, 10)
    : String(row.for_month).slice(0, 10)
  return {
    id: row.id,
    buildingId: row.building_id,
    date: row.payment_date instanceof Date
      ? row.payment_date.toISOString().slice(0, 10)
      : String(row.payment_date).slice(0, 10),
    forMonth: forMonthRaw.slice(0, 7),
    amount: Number(row.amount),
    note: row.note || '',
    createdAt: row.created_at,
  }
}

export async function findAllBuildings() {
  const [rows] = await getPool().query(
    `SELECT id, name, monthly_rent, note, created_at
     FROM rent_buildings
     ORDER BY created_at ASC, id ASC`,
  )
  return rows.map(mapBuilding)
}

export async function findBuildingById(id) {
  const [rows] = await getPool().query(
    `SELECT id, name, monthly_rent, note, created_at
     FROM rent_buildings WHERE id = :id LIMIT 1`,
    { id },
  )
  return rows[0] ? mapBuilding(rows[0]) : null
}

export async function findBuildingByName(name) {
  const [rows] = await getPool().query(
    `SELECT id, name, monthly_rent, note, created_at
     FROM rent_buildings WHERE name = :name LIMIT 1`,
    { name },
  )
  return rows[0] ? mapBuilding(rows[0]) : null
}

export async function insertBuilding({ name, monthlyRent, note }) {
  const [result] = await getPool().query(
    `INSERT INTO rent_buildings (name, monthly_rent, note)
     VALUES (:name, :monthlyRent, :note)`,
    { name, monthlyRent, note: note || null },
  )
  return findBuildingById(result.insertId)
}

export async function updateBuildingById(id, { name, monthlyRent, note }) {
  const [result] = await getPool().query(
    `UPDATE rent_buildings
     SET name = :name, monthly_rent = :monthlyRent, note = :note
     WHERE id = :id`,
    { id, name, monthlyRent, note: note || null },
  )
  if (result.affectedRows === 0) return null
  return findBuildingById(id)
}

export async function deleteBuildingById(id) {
  const [result] = await getPool().query(`DELETE FROM rent_buildings WHERE id = :id`, { id })
  return result.affectedRows > 0
}

export async function countPaymentsByBuildingId(buildingId) {
  const [rows] = await getPool().query(
    `SELECT COUNT(*) AS cnt FROM rent_payments WHERE building_id = :buildingId`,
    { buildingId },
  )
  return Number(rows[0]?.cnt || 0)
}

export async function findPaymentsByBuildingAndMonth(buildingId, forMonthDate) {
  const [rows] = await getPool().query(
    `SELECT id, building_id, payment_date, for_month, amount, note, created_at
     FROM rent_payments
     WHERE building_id = :buildingId AND for_month = :forMonthDate
     ORDER BY payment_date ASC, id ASC`,
    { buildingId, forMonthDate },
  )
  return rows.map(mapPayment)
}

export async function sumPaymentsByBuildingAndMonth(buildingId, forMonthDate) {
  const [rows] = await getPool().query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM rent_payments
     WHERE building_id = :buildingId AND for_month = :forMonthDate`,
    { buildingId, forMonthDate },
  )
  return Number(Number(rows[0]?.total || 0).toFixed(2))
}

export async function findRentPaymentById(id) {
  const [rows] = await getPool().query(
    `SELECT id, building_id, payment_date, for_month, amount, note, created_at
     FROM rent_payments WHERE id = :id LIMIT 1`,
    { id },
  )
  return rows[0] ? mapPayment(rows[0]) : null
}

export async function insertRentPayment({ buildingId, date, forMonthDate, amount, note }) {
  const [result] = await getPool().query(
    `INSERT INTO rent_payments (building_id, payment_date, for_month, amount, note)
     VALUES (:buildingId, :date, :forMonthDate, :amount, :note)`,
    { buildingId, date, forMonthDate, amount, note: note || null },
  )
  return findRentPaymentById(result.insertId)
}

export async function updateRentPaymentById(id, { date, forMonthDate, amount, note }) {
  const [result] = await getPool().query(
    `UPDATE rent_payments
     SET payment_date = :date, for_month = :forMonthDate, amount = :amount, note = :note
     WHERE id = :id`,
    { id, date, forMonthDate, amount, note: note || null },
  )
  if (result.affectedRows === 0) return null
  return findRentPaymentById(id)
}

export async function deleteRentPaymentById(id) {
  const [result] = await getPool().query(`DELETE FROM rent_payments WHERE id = :id`, { id })
  return result.affectedRows > 0
}
