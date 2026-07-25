import mysql from 'mysql2/promise'
import { env } from './env.js'
import { logger } from '../utils/logger.js'

let pool = null
let databaseReady = false

function mysqlBaseOptions() {
  return {
    host: env.mysql.host,
    port: env.mysql.port,
    user: env.mysql.user,
    password: env.mysql.password,
    connectTimeout: 15000,
    ...(env.mysql.ssl ? { ssl: { rejectUnauthorized: false } } : {}),
  }
}

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      ...mysqlBaseOptions(),
      database: env.mysql.database,
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: true,
    })
  }
  return pool
}

export async function ensureDatabase() {
  if (databaseReady) return

  try {
    const probe = await mysql.createConnection({
      ...mysqlBaseOptions(),
      database: env.mysql.database,
    })
    await probe.query('SELECT 1')
    await probe.end()
    databaseReady = true
    return
  } catch (probeErr) {
    logger.info('MySQL database probe needs create/fallback', { error: probeErr.message })
  }

  const admin = await mysql.createConnection(mysqlBaseOptions())

  try {
    await admin.query(
      `CREATE DATABASE IF NOT EXISTS \`${env.mysql.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    )
    databaseReady = true
  } catch (err) {
    // Managed MySQL often forbids CREATE DATABASE; continue if named DB is usable.
    logger.warn('CREATE DATABASE skipped/failed; will use configured database', {
      database: env.mysql.database,
      error: err.message,
    })
    databaseReady = true
  } finally {
    await admin.end()
  }
}

export async function ensureSchema() {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS raw_materials (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      slug VARCHAR(120) NOT NULL,
      name VARCHAR(120) NOT NULL,
      swatch VARCHAR(7) NOT NULL DEFAULT '#64748b',
      price_per_kg DECIMAL(14, 2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_raw_materials_slug (slug),
      UNIQUE KEY uq_raw_materials_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Existing DBs created before price_per_kg
  const [priceCols] = await getPool().query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'raw_materials'
       AND COLUMN_NAME = 'price_per_kg'`,
  )
  if (!priceCols.length) {
    await getPool().query(
      `ALTER TABLE raw_materials
       ADD COLUMN price_per_kg DECIMAL(14, 2) NOT NULL DEFAULT 0 AFTER swatch`,
    )
  }

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS raw_material_stocks (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      raw_material_id INT UNSIGNED NOT NULL,
      stock_date DATE NOT NULL,
      supplier VARCHAR(160) NOT NULL,
      bags DECIMAL(12, 2) NOT NULL,
      kg DECIMAL(14, 2) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_raw_material_stocks_material (raw_material_id),
      KEY idx_raw_material_stocks_date (stock_date),
      CONSTRAINT fk_raw_material_stocks_material
        FOREIGN KEY (raw_material_id) REFERENCES raw_materials (id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS roll_productions (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      kind VARCHAR(16) NOT NULL DEFAULT 'roll',
      raw_material_id INT UNSIGNED NOT NULL,
      production_date DATE NOT NULL,
      size VARCHAR(16) NOT NULL,
      kg DECIMAL(14, 2) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_roll_productions_kind (kind),
      KEY idx_roll_productions_material (raw_material_id),
      KEY idx_roll_productions_date (production_date),
      CONSTRAINT fk_roll_productions_material
        FOREIGN KEY (raw_material_id) REFERENCES raw_materials (id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Existing DBs created before kind column
  const [kindCols] = await getPool().query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'roll_productions'
       AND COLUMN_NAME = 'kind'`,
  )
  if (!kindCols.length) {
    await getPool().query(
      `ALTER TABLE roll_productions
       ADD COLUMN kind VARCHAR(16) NOT NULL DEFAULT 'roll' AFTER id`,
    )
    await getPool().query(
      `ALTER TABLE roll_productions
       ADD KEY idx_roll_productions_kind (kind)`,
    )
  }

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS mill_routes (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      slug VARCHAR(120) NOT NULL,
      name VARCHAR(120) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_mill_routes_slug (slug),
      UNIQUE KEY uq_mill_routes_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS route_customers (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      mill_route_id INT UNSIGNED NOT NULL,
      shop_name VARCHAR(160) NOT NULL,
      address VARCHAR(255) NOT NULL,
      owner_name VARCHAR(120) NOT NULL,
      contact_number CHAR(11) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_route_customers_route (mill_route_id),
      KEY idx_route_customers_contact (contact_number),
      CONSTRAINT fk_route_customers_route
        FOREIGN KEY (mill_route_id) REFERENCES mill_routes (id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS sales_orders (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      order_date DATE NOT NULL,
      mill_route_id INT UNSIGNED NOT NULL,
      route_customer_id INT UNSIGNED NOT NULL,
      has_roll TINYINT(1) NOT NULL DEFAULT 0,
      has_chaat TINYINT(1) NOT NULL DEFAULT 0,
      has_dewaar TINYINT(1) NOT NULL DEFAULT 0,
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      total_bill DECIMAL(14, 2) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_sales_orders_date (order_date),
      KEY idx_sales_orders_status (status),
      KEY idx_sales_orders_route (mill_route_id),
      KEY idx_sales_orders_customer (route_customer_id),
      CONSTRAINT fk_sales_orders_route
        FOREIGN KEY (mill_route_id) REFERENCES mill_routes (id)
        ON DELETE RESTRICT,
      CONSTRAINT fk_sales_orders_customer
        FOREIGN KEY (route_customer_id) REFERENCES route_customers (id)
        ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Existing DBs created before status column
  const [orderStatusCols] = await getPool().query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'sales_orders'
       AND COLUMN_NAME = 'status'`,
  )
  if (!orderStatusCols.length) {
    await getPool().query(
      `ALTER TABLE sales_orders
       ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'pending' AFTER has_dewaar`,
    )
    await getPool().query(
      `ALTER TABLE sales_orders
       ADD KEY idx_sales_orders_status (status)`,
    )
  }

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS sales_order_items (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      sales_order_id INT UNSIGNED NOT NULL,
      raw_material_id INT UNSIGNED NOT NULL,
      kg DECIMAL(14, 2) NOT NULL,
      rate_per_kg DECIMAL(14, 2) NOT NULL,
      amount DECIMAL(14, 2) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_sales_order_items_order (sales_order_id),
      KEY idx_sales_order_items_material (raw_material_id),
      CONSTRAINT fk_sales_order_items_order
        FOREIGN KEY (sales_order_id) REFERENCES sales_orders (id)
        ON DELETE CASCADE,
      CONSTRAINT fk_sales_order_items_material
        FOREIGN KEY (raw_material_id) REFERENCES raw_materials (id)
        ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}

export async function pingDatabase() {
  try {
    const [rows] = await getPool().query('SELECT 1 AS ok')
    return { connected: true, ok: rows?.[0]?.ok === 1, database: env.mysql.database }
  } catch (err) {
    logger.warn('MySQL ping failed', { error: err.message })
    return { connected: false, error: err.message }
  }
}
