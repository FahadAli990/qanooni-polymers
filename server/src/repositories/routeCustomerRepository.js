import { getPool } from '../config/db.js'

function mapRow(row) {
  return {
    id: row.id,
    millRouteId: row.mill_route_id,
    shopName: row.shop_name,
    address: row.address,
    ownerName: row.owner_name,
    contactNumber: row.contact_number,
    createdAt: row.created_at,
  }
}

export async function findCustomersByRouteId(millRouteId) {
  const [rows] = await getPool().query(
    `SELECT id, mill_route_id, shop_name, address, owner_name, contact_number, created_at
     FROM route_customers
     WHERE mill_route_id = :millRouteId
     ORDER BY id ASC`,
    { millRouteId },
  )
  return rows.map(mapRow)
}

export async function findCustomerById(id, millRouteId) {
  const [rows] = await getPool().query(
    `SELECT id, mill_route_id, shop_name, address, owner_name, contact_number, created_at
     FROM route_customers
     WHERE id = :id AND mill_route_id = :millRouteId
     LIMIT 1`,
    { id, millRouteId },
  )
  return rows[0] ? mapRow(rows[0]) : null
}

export async function insertCustomer({
  millRouteId,
  shopName,
  address,
  ownerName,
  contactNumber,
}) {
  const [result] = await getPool().query(
    `INSERT INTO route_customers
       (mill_route_id, shop_name, address, owner_name, contact_number)
     VALUES
       (:millRouteId, :shopName, :address, :ownerName, :contactNumber)`,
    { millRouteId, shopName, address, ownerName, contactNumber },
  )
  return findCustomerById(result.insertId, millRouteId)
}

export async function updateCustomerById(
  id,
  millRouteId,
  { shopName, address, ownerName, contactNumber },
) {
  const [result] = await getPool().query(
    `UPDATE route_customers
     SET shop_name = :shopName,
         address = :address,
         owner_name = :ownerName,
         contact_number = :contactNumber
     WHERE id = :id AND mill_route_id = :millRouteId`,
    { id, millRouteId, shopName, address, ownerName, contactNumber },
  )
  if (result.affectedRows === 0) return null
  return findCustomerById(id, millRouteId)
}

export async function deleteCustomerById(id, millRouteId) {
  const [result] = await getPool().query(
    `DELETE FROM route_customers
     WHERE id = :id AND mill_route_id = :millRouteId`,
    { id, millRouteId },
  )
  return result.affectedRows > 0
}
