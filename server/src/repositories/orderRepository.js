import { getPool } from '../config/db.js'

function mapOrderRow(row) {
  return {
    id: row.id,
    date: row.order_date instanceof Date
      ? row.order_date.toISOString().slice(0, 10)
      : String(row.order_date).slice(0, 10),
    millRouteId: row.mill_route_id,
    routeCustomerId: row.route_customer_id,
    routeName: row.route_name,
    routeSlug: row.route_slug,
    shopName: row.shop_name,
    address: row.address,
    ownerName: row.owner_name,
    contactNumber: row.contact_number,
    kinds: {
      roll: Boolean(row.has_roll),
      chaat: Boolean(row.has_chaat),
      dewaar: Boolean(row.has_dewaar),
    },
    status: row.status === 'delivered' ? 'delivered' : 'pending',
    totalBill: Number(row.total_bill),
    createdAt: row.created_at,
  }
}

function mapItemRow(row) {
  return {
    id: row.id,
    salesOrderId: row.sales_order_id,
    kind: row.kind || 'roll',
    size: row.size || '1"',
    rawMaterialId: row.raw_material_id,
    materialSlug: row.material_slug,
    materialName: row.material_name,
    materialSwatch: row.material_swatch,
    kg: Number(row.kg),
    ratePerKg: Number(row.rate_per_kg),
    amount: Number(row.amount),
  }
}

const ORDER_SELECT = `
  o.id,
  o.order_date,
  o.mill_route_id,
  o.route_customer_id,
  o.has_roll,
  o.has_chaat,
  o.has_dewaar,
  o.status,
  o.total_bill,
  o.created_at,
  r.name AS route_name,
  r.slug AS route_slug,
  c.shop_name,
  c.address,
  c.owner_name,
  c.contact_number
`

export async function findAllOrders() {
  const [rows] = await getPool().query(
    `SELECT ${ORDER_SELECT}
     FROM sales_orders o
     INNER JOIN mill_routes r ON r.id = o.mill_route_id
     INNER JOIN route_customers c ON c.id = o.route_customer_id
     ORDER BY
       CASE WHEN o.status = 'pending' THEN 0 ELSE 1 END,
       o.created_at ASC,
       o.id ASC`,
  )
  return rows.map(mapOrderRow)
}

export async function findOrderItemsByOrderIds(orderIds) {
  if (!orderIds.length) return []
  const [rows] = await getPool().query(
    `SELECT
       i.id,
       i.sales_order_id,
       i.kind,
       i.size,
       i.raw_material_id,
       i.kg,
       i.rate_per_kg,
       i.amount,
       m.slug AS material_slug,
       m.name AS material_name,
       m.swatch AS material_swatch
     FROM sales_order_items i
     INNER JOIN raw_materials m ON m.id = i.raw_material_id
     WHERE i.sales_order_id IN (:orderIds)
     ORDER BY i.id ASC`,
    { orderIds },
  )
  return rows.map(mapItemRow)
}

export async function findOrderById(id) {
  const [rows] = await getPool().query(
    `SELECT ${ORDER_SELECT}
     FROM sales_orders o
     INNER JOIN mill_routes r ON r.id = o.mill_route_id
     INNER JOIN route_customers c ON c.id = o.route_customer_id
     WHERE o.id = :id
     LIMIT 1`,
    { id },
  )
  return rows[0] ? mapOrderRow(rows[0]) : null
}

export async function insertOrderWithItems({
  date,
  millRouteId,
  routeCustomerId,
  hasRoll,
  hasChaat,
  hasDewaar,
  totalBill,
  items,
}) {
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [result] = await conn.query(
      `INSERT INTO sales_orders
         (order_date, mill_route_id, route_customer_id, has_roll, has_chaat, has_dewaar, status, total_bill)
       VALUES
         (:date, :millRouteId, :routeCustomerId, :hasRoll, :hasChaat, :hasDewaar, 'pending', :totalBill)`,
      {
        date,
        millRouteId,
        routeCustomerId,
        hasRoll: hasRoll ? 1 : 0,
        hasChaat: hasChaat ? 1 : 0,
        hasDewaar: hasDewaar ? 1 : 0,
        totalBill,
      },
    )
    const orderId = result.insertId
    for (const item of items) {
      await conn.query(
        `INSERT INTO sales_order_items
           (sales_order_id, kind, size, raw_material_id, kg, rate_per_kg, amount)
         VALUES
           (:orderId, :kind, :size, :rawMaterialId, :kg, :ratePerKg, :amount)`,
        {
          orderId,
          kind: item.kind,
          size: item.size,
          rawMaterialId: item.rawMaterialId,
          kg: item.kg,
          ratePerKg: item.ratePerKg,
          amount: item.amount,
        },
      )
    }
    await conn.commit()
    return orderId
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

export async function replaceOrderWithItems(
  id,
  {
    date,
    millRouteId,
    routeCustomerId,
    hasRoll,
    hasChaat,
    hasDewaar,
    totalBill,
    items,
    status = 'pending',
  },
  executor = null,
) {
  const db = executor || getPool()
  const run = async (conn) => {
    const [result] = await conn.query(
      `UPDATE sales_orders
       SET order_date = :date,
           mill_route_id = :millRouteId,
           route_customer_id = :routeCustomerId,
           has_roll = :hasRoll,
           has_chaat = :hasChaat,
           has_dewaar = :hasDewaar,
           status = :status,
           total_bill = :totalBill
       WHERE id = :id`,
      {
        id,
        date,
        millRouteId,
        routeCustomerId,
        hasRoll: hasRoll ? 1 : 0,
        hasChaat: hasChaat ? 1 : 0,
        hasDewaar: hasDewaar ? 1 : 0,
        status,
        totalBill,
      },
    )
    if (result.affectedRows === 0) return false

    await conn.query(`DELETE FROM sales_order_items WHERE sales_order_id = :id`, { id })
    for (const item of items) {
      await conn.query(
        `INSERT INTO sales_order_items
           (sales_order_id, kind, size, raw_material_id, kg, rate_per_kg, amount)
         VALUES
           (:orderId, :kind, :size, :rawMaterialId, :kg, :ratePerKg, :amount)`,
        {
          orderId: id,
          kind: item.kind,
          size: item.size,
          rawMaterialId: item.rawMaterialId,
          kg: item.kg,
          ratePerKg: item.ratePerKg,
          amount: item.amount,
        },
      )
    }
    return true
  }

  if (executor) return run(executor)

  const conn = await getPool().getConnection()
  try {
    await conn.beginTransaction()
    const ok = await run(conn)
    if (!ok) {
      await conn.rollback()
      return false
    }
    await conn.commit()
    return true
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

export async function markOrderDeliveredById(id, executor = null) {
  const db = executor || getPool()
  const [result] = await db.query(
    `UPDATE sales_orders
     SET status = 'delivered'
     WHERE id = :id AND status = 'pending'`,
    { id },
  )
  return result.affectedRows > 0
}

export async function markOrderPendingById(id, executor = null) {
  const db = executor || getPool()
  const [result] = await db.query(
    `UPDATE sales_orders
     SET status = 'pending'
     WHERE id = :id AND status = 'delivered'`,
    { id },
  )
  return result.affectedRows > 0
}

export async function insertOrderConsumptions(orderId, allocations, executor) {
  for (const row of allocations) {
    await executor.query(
      `INSERT INTO sales_order_consumptions (sales_order_id, roll_production_id, kg)
       VALUES (:orderId, :productionId, :kg)`,
      {
        orderId,
        productionId: row.productionId,
        kg: row.kg,
      },
    )
  }
}

export async function findOrderConsumptions(orderId, executor = null) {
  const db = executor || getPool()
  const [rows] = await db.query(
    `SELECT id, sales_order_id, roll_production_id, kg
     FROM sales_order_consumptions
     WHERE sales_order_id = :orderId
     ORDER BY id ASC`,
    { orderId },
  )
  return rows.map((row) => ({
    id: row.id,
    salesOrderId: row.sales_order_id,
    productionId: row.roll_production_id,
    kg: Number(row.kg),
  }))
}

export async function deleteOrderConsumptions(orderId, executor = null) {
  const db = executor || getPool()
  await db.query(`DELETE FROM sales_order_consumptions WHERE sales_order_id = :orderId`, {
    orderId,
  })
}

export async function deleteOrderById(id, executor = null) {
  const db = executor || getPool()
  const [result] = await db.query(`DELETE FROM sales_orders WHERE id = :id`, { id })
  return result.affectedRows > 0
}
