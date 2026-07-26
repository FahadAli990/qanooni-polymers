import { getPool } from '../config/db.js'

function mapSupplier(row) {
  return {
    id: row.id,
    name: row.name,
    contact: row.contact || '',
    note: row.note || '',
    createdAt: row.created_at,
  }
}

function mapPurchase(row) {
  return {
    id: row.id,
    supplierId: row.supplier_id,
    date: row.purchase_date instanceof Date
      ? row.purchase_date.toISOString().slice(0, 10)
      : String(row.purchase_date).slice(0, 10),
    cylinderKg: Number(row.cylinder_kg),
    cylindersCount: Number(row.cylinders_count),
    pricePerCylinder: Number(row.price_per_cylinder),
    totalAmount: Number(row.total_amount),
    note: row.note || '',
    createdAt: row.created_at,
  }
}

function mapPayment(row) {
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

function mapUtilityBill(row) {
  return {
    id: row.id,
    date: row.bill_date instanceof Date
      ? row.bill_date.toISOString().slice(0, 10)
      : String(row.bill_date).slice(0, 10),
    category: row.category,
    title: row.title,
    amount: Number(row.amount),
    note: row.note || '',
    createdAt: row.created_at,
  }
}

export async function findAllGasSuppliers() {
  const [rows] = await getPool().query(
    `SELECT id, name, contact, note, created_at
     FROM gas_suppliers
     ORDER BY created_at ASC, id ASC`,
  )
  return rows.map(mapSupplier)
}

export async function findGasSupplierById(id) {
  const [rows] = await getPool().query(
    `SELECT id, name, contact, note, created_at
     FROM gas_suppliers WHERE id = :id LIMIT 1`,
    { id },
  )
  return rows[0] ? mapSupplier(rows[0]) : null
}

export async function findGasSupplierByName(name) {
  const [rows] = await getPool().query(
    `SELECT id, name, contact, note, created_at
     FROM gas_suppliers WHERE name = :name LIMIT 1`,
    { name },
  )
  return rows[0] ? mapSupplier(rows[0]) : null
}

export async function insertGasSupplier({ name, contact, note }) {
  const [result] = await getPool().query(
    `INSERT INTO gas_suppliers (name, contact, note)
     VALUES (:name, :contact, :note)`,
    { name, contact, note: note || null },
  )
  return findGasSupplierById(result.insertId)
}

export async function updateGasSupplierById(id, { name, contact, note }) {
  const [result] = await getPool().query(
    `UPDATE gas_suppliers
     SET name = :name, contact = :contact, note = :note
     WHERE id = :id`,
    { id, name, contact, note: note || null },
  )
  if (result.affectedRows === 0) return null
  return findGasSupplierById(id)
}

export async function deleteGasSupplierById(id) {
  const [result] = await getPool().query(`DELETE FROM gas_suppliers WHERE id = :id`, { id })
  return result.affectedRows > 0
}

export async function findPurchasesByGasSupplierId(supplierId) {
  const [rows] = await getPool().query(
    `SELECT id, supplier_id, purchase_date, cylinder_kg, cylinders_count,
            price_per_cylinder, total_amount, note, created_at
     FROM gas_purchases
     WHERE supplier_id = :supplierId
     ORDER BY purchase_date ASC, id ASC`,
    { supplierId },
  )
  return rows.map(mapPurchase)
}

export async function sumPurchasesByGasSupplierId(supplierId) {
  const [rows] = await getPool().query(
    `SELECT COALESCE(SUM(total_amount), 0) AS total
     FROM gas_purchases WHERE supplier_id = :supplierId`,
    { supplierId },
  )
  return Number(Number(rows[0]?.total || 0).toFixed(2))
}

export async function findGasPurchaseById(id) {
  const [rows] = await getPool().query(
    `SELECT id, supplier_id, purchase_date, cylinder_kg, cylinders_count,
            price_per_cylinder, total_amount, note, created_at
     FROM gas_purchases WHERE id = :id LIMIT 1`,
    { id },
  )
  return rows[0] ? mapPurchase(rows[0]) : null
}

export async function insertGasPurchase(payload) {
  const [result] = await getPool().query(
    `INSERT INTO gas_purchases
       (supplier_id, purchase_date, cylinder_kg, cylinders_count, price_per_cylinder, total_amount, note)
     VALUES
       (:supplierId, :date, :cylinderKg, :cylindersCount, :pricePerCylinder, :totalAmount, :note)`,
    {
      supplierId: payload.supplierId,
      date: payload.date,
      cylinderKg: payload.cylinderKg,
      cylindersCount: payload.cylindersCount,
      pricePerCylinder: payload.pricePerCylinder,
      totalAmount: payload.totalAmount,
      note: payload.note || null,
    },
  )
  return findGasPurchaseById(result.insertId)
}

export async function updateGasPurchaseById(id, payload) {
  const [result] = await getPool().query(
    `UPDATE gas_purchases
     SET purchase_date = :date,
         cylinder_kg = :cylinderKg,
         cylinders_count = :cylindersCount,
         price_per_cylinder = :pricePerCylinder,
         total_amount = :totalAmount,
         note = :note
     WHERE id = :id`,
    {
      id,
      date: payload.date,
      cylinderKg: payload.cylinderKg,
      cylindersCount: payload.cylindersCount,
      pricePerCylinder: payload.pricePerCylinder,
      totalAmount: payload.totalAmount,
      note: payload.note || null,
    },
  )
  if (result.affectedRows === 0) return null
  return findGasPurchaseById(id)
}

export async function deleteGasPurchaseById(id) {
  const [result] = await getPool().query(`DELETE FROM gas_purchases WHERE id = :id`, { id })
  return result.affectedRows > 0
}

export async function findPaymentsByGasSupplierId(supplierId) {
  const [rows] = await getPool().query(
    `SELECT id, supplier_id, payment_date, amount, note, created_at
     FROM gas_payments
     WHERE supplier_id = :supplierId
     ORDER BY payment_date ASC, id ASC`,
    { supplierId },
  )
  return rows.map(mapPayment)
}

export async function sumPaymentsByGasSupplierId(supplierId) {
  const [rows] = await getPool().query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM gas_payments WHERE supplier_id = :supplierId`,
    { supplierId },
  )
  return Number(Number(rows[0]?.total || 0).toFixed(2))
}

export async function findGasPaymentById(id) {
  const [rows] = await getPool().query(
    `SELECT id, supplier_id, payment_date, amount, note, created_at
     FROM gas_payments WHERE id = :id LIMIT 1`,
    { id },
  )
  return rows[0] ? mapPayment(rows[0]) : null
}

export async function insertGasPayment({ supplierId, date, amount, note }) {
  const [result] = await getPool().query(
    `INSERT INTO gas_payments (supplier_id, payment_date, amount, note)
     VALUES (:supplierId, :date, :amount, :note)`,
    { supplierId, date, amount, note: note || null },
  )
  return findGasPaymentById(result.insertId)
}

export async function updateGasPaymentById(id, { date, amount, note }) {
  const [result] = await getPool().query(
    `UPDATE gas_payments
     SET payment_date = :date, amount = :amount, note = :note
     WHERE id = :id`,
    { id, date, amount, note: note || null },
  )
  if (result.affectedRows === 0) return null
  return findGasPaymentById(id)
}

export async function deleteGasPaymentById(id) {
  const [result] = await getPool().query(`DELETE FROM gas_payments WHERE id = :id`, { id })
  return result.affectedRows > 0
}

export async function findUtilityBillsByDate(date) {
  const [rows] = await getPool().query(
    `SELECT id, bill_date, category, title, amount, note, created_at
     FROM utility_bills
     WHERE bill_date = :date
     ORDER BY created_at ASC, id ASC`,
    { date },
  )
  return rows.map(mapUtilityBill)
}

export async function sumUtilityBillsByDate(date) {
  const [rows] = await getPool().query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM utility_bills WHERE bill_date = :date`,
    { date },
  )
  return Number(Number(rows[0]?.total || 0).toFixed(2))
}

export async function sumAllUtilityBills() {
  const [rows] = await getPool().query(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM utility_bills`,
  )
  return Number(Number(rows[0]?.total || 0).toFixed(2))
}

export async function findUtilityBillById(id) {
  const [rows] = await getPool().query(
    `SELECT id, bill_date, category, title, amount, note, created_at
     FROM utility_bills WHERE id = :id LIMIT 1`,
    { id },
  )
  return rows[0] ? mapUtilityBill(rows[0]) : null
}

export async function insertUtilityBill({ date, category, title, amount, note }) {
  const [result] = await getPool().query(
    `INSERT INTO utility_bills (bill_date, category, title, amount, note)
     VALUES (:date, :category, :title, :amount, :note)`,
    { date, category, title, amount, note: note || null },
  )
  return findUtilityBillById(result.insertId)
}

export async function updateUtilityBillById(id, { date, category, title, amount, note }) {
  const [result] = await getPool().query(
    `UPDATE utility_bills
     SET bill_date = :date, category = :category, title = :title, amount = :amount, note = :note
     WHERE id = :id`,
    { id, date, category, title, amount, note: note || null },
  )
  if (result.affectedRows === 0) return null
  return findUtilityBillById(id)
}

export async function deleteUtilityBillById(id) {
  const [result] = await getPool().query(`DELETE FROM utility_bills WHERE id = :id`, { id })
  return result.affectedRows > 0
}
