import { getPool } from '../config/db.js'

function mapWorker(row, { includeImages = true } = {}) {
  const base = {
    id: row.id,
    name: row.name,
    contact: row.contact,
    fixedSalary: Number(row.fixed_salary),
    address: row.address || '',
    note: row.note || '',
    hasPhoto: Boolean(row.has_photo ?? row.photo),
    hasIdCardFront: Boolean(row.has_id_front ?? row.id_card_front),
    hasIdCardBack: Boolean(row.has_id_back ?? row.id_card_back),
    createdAt: row.created_at,
  }
  if (includeImages) {
    base.photo = row.photo || ''
    base.idCardFront = row.id_card_front || ''
    base.idCardBack = row.id_card_back || ''
  }
  return base
}

function mapLeave(row) {
  return {
    id: row.id,
    workerId: row.worker_id,
    date: row.leave_date instanceof Date
      ? row.leave_date.toISOString().slice(0, 10)
      : String(row.leave_date).slice(0, 10),
    days: Number(row.days),
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
    workerId: row.worker_id,
    date: row.payment_date instanceof Date
      ? row.payment_date.toISOString().slice(0, 10)
      : String(row.payment_date).slice(0, 10),
    forMonth: forMonthRaw.slice(0, 7),
    amount: Number(row.amount),
    note: row.note || '',
    createdAt: row.created_at,
  }
}

export async function findAllWorkers() {
  const [rows] = await getPool().query(
    `SELECT
       id, name, contact, fixed_salary, address, note, created_at,
       (photo IS NOT NULL AND CHAR_LENGTH(photo) > 0) AS has_photo,
       (id_card_front IS NOT NULL AND CHAR_LENGTH(id_card_front) > 0) AS has_id_front,
       (id_card_back IS NOT NULL AND CHAR_LENGTH(id_card_back) > 0) AS has_id_back
     FROM workers
     ORDER BY created_at ASC, id ASC`,
  )
  return rows.map((row) => mapWorker(row, { includeImages: false }))
}

export async function findWorkerById(id) {
  const [rows] = await getPool().query(
    `SELECT id, name, contact, fixed_salary, address, photo, id_card_front, id_card_back, note, created_at
     FROM workers WHERE id = :id LIMIT 1`,
    { id },
  )
  return rows[0] ? mapWorker(rows[0], { includeImages: true }) : null
}

export async function findWorkerByName(name) {
  const [rows] = await getPool().query(
    `SELECT id, name, contact, fixed_salary, address, photo, id_card_front, id_card_back, note, created_at
     FROM workers WHERE name = :name LIMIT 1`,
    { name },
  )
  return rows[0] ? mapWorker(rows[0], { includeImages: true }) : null
}

export async function insertWorker({
  name,
  contact,
  fixedSalary,
  address,
  photo,
  idCardFront,
  idCardBack,
  note,
}) {
  const [result] = await getPool().query(
    `INSERT INTO workers
       (name, contact, fixed_salary, address, photo, id_card_front, id_card_back, note)
     VALUES
       (:name, :contact, :fixedSalary, :address, :photo, :idCardFront, :idCardBack, :note)`,
    {
      name,
      contact,
      fixedSalary,
      address: address || null,
      photo: photo || null,
      idCardFront: idCardFront || null,
      idCardBack: idCardBack || null,
      note: note || null,
    },
  )
  return findWorkerById(result.insertId)
}

export async function updateWorkerById(id, {
  name,
  contact,
  fixedSalary,
  address,
  photo,
  idCardFront,
  idCardBack,
  note,
}) {
  const [result] = await getPool().query(
    `UPDATE workers
     SET name = :name,
         contact = :contact,
         fixed_salary = :fixedSalary,
         address = :address,
         photo = :photo,
         id_card_front = :idCardFront,
         id_card_back = :idCardBack,
         note = :note
     WHERE id = :id`,
    {
      id,
      name,
      contact,
      fixedSalary,
      address: address || null,
      photo: photo || null,
      idCardFront: idCardFront || null,
      idCardBack: idCardBack || null,
      note: note || null,
    },
  )
  if (result.affectedRows === 0) return null
  return findWorkerById(id)
}

export async function deleteWorkerById(id) {
  const [result] = await getPool().query(`DELETE FROM workers WHERE id = :id`, { id })
  return result.affectedRows > 0
}

export async function countLeavesByWorkerId(workerId) {
  const [rows] = await getPool().query(
    `SELECT COUNT(*) AS cnt FROM worker_leaves WHERE worker_id = :workerId`,
    { workerId },
  )
  return Number(rows[0]?.cnt || 0)
}

export async function countSalaryPaymentsByWorkerId(workerId) {
  const [rows] = await getPool().query(
    `SELECT COUNT(*) AS cnt FROM worker_salary_payments WHERE worker_id = :workerId`,
    { workerId },
  )
  return Number(rows[0]?.cnt || 0)
}

export async function findLeavesByWorkerAndMonth(workerId, monthStart, monthEnd) {
  const [rows] = await getPool().query(
    `SELECT id, worker_id, leave_date, days, note, created_at
     FROM worker_leaves
     WHERE worker_id = :workerId
       AND leave_date >= :monthStart
       AND leave_date <= :monthEnd
     ORDER BY leave_date ASC, id ASC`,
    { workerId, monthStart, monthEnd },
  )
  return rows.map(mapLeave)
}

export async function sumLeaveDaysByWorkerAndMonth(workerId, monthStart, monthEnd) {
  const [rows] = await getPool().query(
    `SELECT COALESCE(SUM(days), 0) AS total
     FROM worker_leaves
     WHERE worker_id = :workerId
       AND leave_date >= :monthStart
       AND leave_date <= :monthEnd`,
    { workerId, monthStart, monthEnd },
  )
  return Number(Number(rows[0]?.total || 0).toFixed(2))
}

export async function findLeaveById(id) {
  const [rows] = await getPool().query(
    `SELECT id, worker_id, leave_date, days, note, created_at
     FROM worker_leaves WHERE id = :id LIMIT 1`,
    { id },
  )
  return rows[0] ? mapLeave(rows[0]) : null
}

export async function insertLeave({ workerId, date, days, note }) {
  const [result] = await getPool().query(
    `INSERT INTO worker_leaves (worker_id, leave_date, days, note)
     VALUES (:workerId, :date, :days, :note)`,
    { workerId, date, days, note: note || null },
  )
  return findLeaveById(result.insertId)
}

export async function updateLeaveById(id, { date, days, note }) {
  const [result] = await getPool().query(
    `UPDATE worker_leaves
     SET leave_date = :date, days = :days, note = :note
     WHERE id = :id`,
    { id, date, days, note: note || null },
  )
  if (result.affectedRows === 0) return null
  return findLeaveById(id)
}

export async function deleteLeaveById(id) {
  const [result] = await getPool().query(`DELETE FROM worker_leaves WHERE id = :id`, { id })
  return result.affectedRows > 0
}

export async function findSalaryPaymentsByWorkerAndMonth(workerId, forMonthDate) {
  const [rows] = await getPool().query(
    `SELECT id, worker_id, payment_date, for_month, amount, note, created_at
     FROM worker_salary_payments
     WHERE worker_id = :workerId AND for_month = :forMonthDate
     ORDER BY payment_date ASC, id ASC`,
    { workerId, forMonthDate },
  )
  return rows.map(mapPayment)
}

export async function sumSalaryPaymentsByWorkerAndMonth(workerId, forMonthDate) {
  const [rows] = await getPool().query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM worker_salary_payments
     WHERE worker_id = :workerId AND for_month = :forMonthDate`,
    { workerId, forMonthDate },
  )
  return Number(Number(rows[0]?.total || 0).toFixed(2))
}

export async function findSalaryPaymentById(id) {
  const [rows] = await getPool().query(
    `SELECT id, worker_id, payment_date, for_month, amount, note, created_at
     FROM worker_salary_payments WHERE id = :id LIMIT 1`,
    { id },
  )
  return rows[0] ? mapPayment(rows[0]) : null
}

export async function insertSalaryPayment({ workerId, date, forMonthDate, amount, note }) {
  const [result] = await getPool().query(
    `INSERT INTO worker_salary_payments (worker_id, payment_date, for_month, amount, note)
     VALUES (:workerId, :date, :forMonthDate, :amount, :note)`,
    { workerId, date, forMonthDate, amount, note: note || null },
  )
  return findSalaryPaymentById(result.insertId)
}

export async function updateSalaryPaymentById(id, { date, forMonthDate, amount, note }) {
  const [result] = await getPool().query(
    `UPDATE worker_salary_payments
     SET payment_date = :date, for_month = :forMonthDate, amount = :amount, note = :note
     WHERE id = :id`,
    { id, date, forMonthDate, amount, note: note || null },
  )
  if (result.affectedRows === 0) return null
  return findSalaryPaymentById(id)
}

export async function deleteSalaryPaymentById(id) {
  const [result] = await getPool().query(
    `DELETE FROM worker_salary_payments WHERE id = :id`,
    { id },
  )
  return result.affectedRows > 0
}
