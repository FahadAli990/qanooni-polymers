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
      price_per_kg DECIMAL(14, 2) NOT NULL DEFAULT 0,
      is_previous TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_raw_material_stocks_material (raw_material_id),
      KEY idx_raw_material_stocks_date (stock_date),
      KEY idx_raw_material_stocks_previous (is_previous),
      CONSTRAINT fk_raw_material_stocks_material
        FOREIGN KEY (raw_material_id) REFERENCES raw_materials (id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  const [stockPriceCols] = await getPool().query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'raw_material_stocks'
       AND COLUMN_NAME = 'price_per_kg'`,
  )
  if (!stockPriceCols.length) {
    await getPool().query(
      `ALTER TABLE raw_material_stocks
       ADD COLUMN price_per_kg DECIMAL(14, 2) NOT NULL DEFAULT 0 AFTER kg`,
    )
  }

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS roll_productions (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      kind VARCHAR(16) NOT NULL DEFAULT 'roll',
      raw_material_id INT UNSIGNED NOT NULL,
      production_date DATE NOT NULL,
      size VARCHAR(16) NOT NULL,
      kg DECIMAL(14, 2) NOT NULL,
      remaining_kg DECIMAL(14, 2) NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'available',
      is_previous TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_roll_productions_kind (kind),
      KEY idx_roll_productions_material (raw_material_id),
      KEY idx_roll_productions_date (production_date),
      KEY idx_roll_productions_status (status),
      KEY idx_roll_productions_previous (is_previous),
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

  const [remainingCols] = await getPool().query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'roll_productions'
       AND COLUMN_NAME = 'remaining_kg'`,
  )
  if (!remainingCols.length) {
    await getPool().query(
      `ALTER TABLE roll_productions
       ADD COLUMN remaining_kg DECIMAL(14, 2) NULL AFTER kg`,
    )
    await getPool().query(
      `UPDATE roll_productions
       SET remaining_kg = kg
       WHERE remaining_kg IS NULL`,
    )
    await getPool().query(
      `ALTER TABLE roll_productions
       MODIFY COLUMN remaining_kg DECIMAL(14, 2) NOT NULL`,
    )
  }

  const [prodStatusCols] = await getPool().query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'roll_productions'
       AND COLUMN_NAME = 'status'`,
  )
  if (!prodStatusCols.length) {
    await getPool().query(
      `ALTER TABLE roll_productions
       ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'available' AFTER remaining_kg`,
    )
    await getPool().query(
      `ALTER TABLE roll_productions
       ADD KEY idx_roll_productions_status (status)`,
    )
  }

  await getPool().query(
    `UPDATE roll_productions
     SET status = CASE
       WHEN remaining_kg <= 0 THEN 'used'
       ELSE 'available'
     END
     WHERE status NOT IN ('available', 'used')
        OR (remaining_kg <= 0 AND status <> 'used')
        OR (remaining_kg > 0 AND status <> 'available')`,
  )

  const [prevCols] = await getPool().query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'roll_productions'
       AND COLUMN_NAME = 'is_previous'`,
  )
  if (!prevCols.length) {
    await getPool().query(
      `ALTER TABLE roll_productions
       ADD COLUMN is_previous TINYINT(1) NOT NULL DEFAULT 0 AFTER status`,
    )
    await getPool().query(
      `ALTER TABLE roll_productions
       ADD KEY idx_roll_productions_previous (is_previous)`,
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
      kind VARCHAR(16) NOT NULL DEFAULT 'roll',
      size VARCHAR(16) NOT NULL DEFAULT '1"',
      raw_material_id INT UNSIGNED NOT NULL,
      kg DECIMAL(14, 2) NOT NULL,
      rate_per_kg DECIMAL(14, 2) NOT NULL,
      amount DECIMAL(14, 2) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_sales_order_items_order (sales_order_id),
      KEY idx_sales_order_items_material (raw_material_id),
      KEY idx_sales_order_items_kind (kind),
      CONSTRAINT fk_sales_order_items_order
        FOREIGN KEY (sales_order_id) REFERENCES sales_orders (id)
        ON DELETE CASCADE,
      CONSTRAINT fk_sales_order_items_material
        FOREIGN KEY (raw_material_id) REFERENCES raw_materials (id)
        ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  const [itemKindCols] = await getPool().query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'sales_order_items'
       AND COLUMN_NAME = 'kind'`,
  )
  if (!itemKindCols.length) {
    await getPool().query(
      `ALTER TABLE sales_order_items
       ADD COLUMN kind VARCHAR(16) NOT NULL DEFAULT 'roll' AFTER sales_order_id`,
    )
    await getPool().query(
      `ALTER TABLE sales_order_items
       ADD KEY idx_sales_order_items_kind (kind)`,
    )
  }

  const [itemSizeCols] = await getPool().query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'sales_order_items'
       AND COLUMN_NAME = 'size'`,
  )
  if (!itemSizeCols.length) {
    await getPool().query(
      `ALTER TABLE sales_order_items
       ADD COLUMN size VARCHAR(16) NOT NULL DEFAULT '1"' AFTER kind`,
    )
  }

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS sales_order_consumptions (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      sales_order_id INT UNSIGNED NOT NULL,
      roll_production_id INT UNSIGNED NOT NULL,
      kg DECIMAL(14, 2) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_sales_order_consumptions_order (sales_order_id),
      KEY idx_sales_order_consumptions_production (roll_production_id),
      CONSTRAINT fk_sales_order_consumptions_order
        FOREIGN KEY (sales_order_id) REFERENCES sales_orders (id)
        ON DELETE CASCADE,
      CONSTRAINT fk_sales_order_consumptions_production
        FOREIGN KEY (roll_production_id) REFERENCES roll_productions (id)
        ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS customer_payments (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      route_customer_id INT UNSIGNED NOT NULL,
      payment_date DATE NOT NULL,
      amount DECIMAL(14, 2) NOT NULL,
      note VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_customer_payments_customer (route_customer_id),
      KEY idx_customer_payments_date (payment_date),
      CONSTRAINT fk_customer_payments_customer
        FOREIGN KEY (route_customer_id) REFERENCES route_customers (id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS customer_previous_bills (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      route_customer_id INT UNSIGNED NOT NULL,
      bill_date DATE NOT NULL,
      amount DECIMAL(14, 2) NOT NULL,
      note VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_customer_previous_bills_customer (route_customer_id),
      KEY idx_customer_previous_bills_date (bill_date),
      CONSTRAINT fk_customer_previous_bills_customer
        FOREIGN KEY (route_customer_id) REFERENCES route_customers (id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(160) NOT NULL,
      contact VARCHAR(20) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_suppliers_name (name),
      KEY idx_suppliers_contact (contact)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS supplier_payments (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      supplier_id INT UNSIGNED NOT NULL,
      payment_date DATE NOT NULL,
      amount DECIMAL(14, 2) NOT NULL,
      note VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_supplier_payments_supplier (supplier_id),
      KEY idx_supplier_payments_date (payment_date),
      CONSTRAINT fk_supplier_payments_supplier
        FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS supplier_previous_balances (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      supplier_id INT UNSIGNED NOT NULL,
      balance_date DATE NOT NULL,
      amount DECIMAL(14, 2) NOT NULL,
      note VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_supplier_previous_balances_supplier (supplier_id),
      KEY idx_supplier_previous_balances_date (balance_date),
      CONSTRAINT fk_supplier_previous_balances_supplier
        FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  const [stockSupplierIdCols] = await getPool().query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'raw_material_stocks'
       AND COLUMN_NAME = 'supplier_id'`,
  )
  if (!stockSupplierIdCols.length) {
    await getPool().query(
      `ALTER TABLE raw_material_stocks
       ADD COLUMN supplier_id INT UNSIGNED NULL AFTER supplier`,
    )
    await getPool().query(
      `ALTER TABLE raw_material_stocks
       ADD KEY idx_raw_material_stocks_supplier (supplier_id)`,
    )
    await getPool().query(
      `ALTER TABLE raw_material_stocks
       ADD CONSTRAINT fk_raw_material_stocks_supplier
         FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
         ON DELETE SET NULL`,
    )
  }

  const [stockPrevCols] = await getPool().query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'raw_material_stocks'
       AND COLUMN_NAME = 'is_previous'`,
  )
  if (!stockPrevCols.length) {
    await getPool().query(
      `ALTER TABLE raw_material_stocks
       ADD COLUMN is_previous TINYINT(1) NOT NULL DEFAULT 0 AFTER price_per_kg`,
    )
    await getPool().query(
      `ALTER TABLE raw_material_stocks
       ADD KEY idx_raw_material_stocks_previous (is_previous)`,
    )
  }

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS daily_expenses (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      expense_date DATE NOT NULL,
      title VARCHAR(160) NOT NULL,
      amount DECIMAL(14, 2) NOT NULL,
      note VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_daily_expenses_date (expense_date),
      KEY idx_daily_expenses_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS maintenance_expenses (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      expense_date DATE NOT NULL,
      title VARCHAR(160) NOT NULL,
      amount DECIMAL(14, 2) NOT NULL,
      note VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_maintenance_expenses_date (expense_date),
      KEY idx_maintenance_expenses_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS rent_vehicles (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(160) NOT NULL,
      note VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_rent_vehicles_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Migrate legacy monthly_rent → daily_fare (then drop daily_fare — per-delivery model)
  const [monthlyRentCols] = await getPool().query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'rent_vehicles'
       AND COLUMN_NAME = 'monthly_rent'`,
  )
  const [dailyFareCols] = await getPool().query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'rent_vehicles'
       AND COLUMN_NAME = 'daily_fare'`,
  )
  if (monthlyRentCols.length && !dailyFareCols.length) {
    await getPool().query(
      `ALTER TABLE rent_vehicles
       CHANGE COLUMN monthly_rent daily_fare DECIMAL(14, 2) NOT NULL DEFAULT 0`,
    )
  }

  // Migrate legacy rent_buildings → rent_vehicles (one-time)
  const [legacyBuildings] = await getPool().query(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rent_buildings'`,
  )
  if (legacyBuildings.length) {
    const [dfAfter] = await getPool().query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rent_vehicles' AND COLUMN_NAME = 'daily_fare'`,
    )
    if (dfAfter.length) {
      await getPool().query(
        `INSERT IGNORE INTO rent_vehicles (id, name, daily_fare, note, created_at)
         SELECT id, name, monthly_rent, note, created_at FROM rent_buildings`,
      )
    } else {
      await getPool().query(
        `INSERT IGNORE INTO rent_vehicles (id, name, note, created_at)
         SELECT id, name, note, created_at FROM rent_buildings`,
      )
    }
  }

  // Drop unused daily_fare (vehicles are per-delivery now)
  const [dailyFareStill] = await getPool().query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'rent_vehicles'
       AND COLUMN_NAME = 'daily_fare'`,
  )
  if (dailyFareStill.length) {
    await getPool().query(`ALTER TABLE rent_vehicles DROP COLUMN daily_fare`)
  }

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS rent_trips (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      vehicle_id INT UNSIGNED NOT NULL,
      trip_date DATE NOT NULL,
      destination VARCHAR(255) NOT NULL,
      fare_amount DECIMAL(14, 2) NOT NULL,
      note VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_rent_trips_vehicle (vehicle_id),
      KEY idx_rent_trips_date (trip_date),
      CONSTRAINT fk_rent_trips_vehicle
        FOREIGN KEY (vehicle_id) REFERENCES rent_vehicles (id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS rent_payments (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      vehicle_id INT UNSIGNED NOT NULL,
      payment_date DATE NOT NULL,
      amount DECIMAL(14, 2) NOT NULL,
      note VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_rent_payments_vehicle (vehicle_id),
      KEY idx_rent_payments_date (payment_date),
      CONSTRAINT fk_rent_payments_vehicle
        FOREIGN KEY (vehicle_id) REFERENCES rent_vehicles (id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Drop legacy for_date from rent_payments if present
  const [forDateCols] = await getPool().query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'rent_payments'
       AND COLUMN_NAME = 'for_date'`,
  )
  if (forDateCols.length) {
    await getPool().query(`ALTER TABLE rent_payments DROP COLUMN for_date`)
  }
  const [forMonthCols] = await getPool().query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'rent_payments'
       AND COLUMN_NAME = 'for_month'`,
  )
  if (forMonthCols.length) {
    await getPool().query(`ALTER TABLE rent_payments DROP COLUMN for_month`)
  }

  // Migrate legacy rent_payments.building_id → vehicle_id
  const [buildingIdCols] = await getPool().query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'rent_payments'
       AND COLUMN_NAME = 'building_id'`,
  )
  const [vehicleIdCols] = await getPool().query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'rent_payments'
       AND COLUMN_NAME = 'vehicle_id'`,
  )
  if (buildingIdCols.length && !vehicleIdCols.length) {
    const [fkRows] = await getPool().query(
      `SELECT CONSTRAINT_NAME
       FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'rent_payments'
         AND CONSTRAINT_TYPE = 'FOREIGN KEY'
         AND CONSTRAINT_NAME = 'fk_rent_payments_building'`,
    )
    if (fkRows.length) {
      await getPool().query(
        `ALTER TABLE rent_payments DROP FOREIGN KEY fk_rent_payments_building`,
      )
    }
    await getPool().query(
      `ALTER TABLE rent_payments
       CHANGE COLUMN building_id vehicle_id INT UNSIGNED NOT NULL`,
    )
    await getPool().query(
      `ALTER TABLE rent_payments
       ADD CONSTRAINT fk_rent_payments_vehicle
         FOREIGN KEY (vehicle_id) REFERENCES rent_vehicles (id)
         ON DELETE CASCADE`,
    )
  }

  if (legacyBuildings.length) {
    await getPool().query(`DROP TABLE IF EXISTS rent_buildings`)
  }

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS workers (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(160) NOT NULL,
      contact VARCHAR(20) NOT NULL,
      fixed_salary DECIMAL(14, 2) NOT NULL,
      address VARCHAR(255) NULL,
      photo MEDIUMTEXT NULL,
      id_card_front MEDIUMTEXT NULL,
      id_card_back MEDIUMTEXT NULL,
      note VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_workers_name (name),
      KEY idx_workers_contact (contact)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  const workerExtraCols = [
    { name: 'address', ddl: 'VARCHAR(255) NULL AFTER fixed_salary' },
    { name: 'photo', ddl: 'MEDIUMTEXT NULL AFTER address' },
    { name: 'id_card_front', ddl: 'MEDIUMTEXT NULL AFTER photo' },
    { name: 'id_card_back', ddl: 'MEDIUMTEXT NULL AFTER id_card_front' },
  ]
  for (const col of workerExtraCols) {
    const [cols] = await getPool().query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'workers'
         AND COLUMN_NAME = :name`,
      { name: col.name },
    )
    if (!cols.length) {
      await getPool().query(`ALTER TABLE workers ADD COLUMN ${col.name} ${col.ddl}`)
    }
  }

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS worker_leaves (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      worker_id INT UNSIGNED NOT NULL,
      leave_date DATE NOT NULL,
      days DECIMAL(6, 2) NOT NULL,
      note VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_worker_leaves_worker (worker_id),
      KEY idx_worker_leaves_date (leave_date),
      CONSTRAINT fk_worker_leaves_worker
        FOREIGN KEY (worker_id) REFERENCES workers (id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS worker_salary_payments (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      worker_id INT UNSIGNED NOT NULL,
      payment_date DATE NOT NULL,
      for_month DATE NOT NULL,
      amount DECIMAL(14, 2) NOT NULL,
      note VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_worker_salary_worker (worker_id),
      KEY idx_worker_salary_month (for_month),
      CONSTRAINT fk_worker_salary_worker
        FOREIGN KEY (worker_id) REFERENCES workers (id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS gas_suppliers (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(160) NOT NULL,
      contact VARCHAR(20) NOT NULL,
      note VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_gas_suppliers_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS gas_purchases (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      supplier_id INT UNSIGNED NOT NULL,
      purchase_date DATE NOT NULL,
      due_date DATE NULL,
      cylinder_kg DECIMAL(10, 2) NOT NULL,
      cylinders_count INT UNSIGNED NOT NULL,
      price_per_kg DECIMAL(14, 2) NOT NULL,
      total_amount DECIMAL(14, 2) NOT NULL,
      note VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_gas_purchases_supplier (supplier_id),
      KEY idx_gas_purchases_date (purchase_date),
      KEY idx_gas_purchases_due (due_date),
      CONSTRAINT fk_gas_purchases_supplier
        FOREIGN KEY (supplier_id) REFERENCES gas_suppliers (id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  const [gasDueCols] = await getPool().query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'gas_purchases'
       AND COLUMN_NAME = 'due_date'`,
  )
  if (!gasDueCols.length) {
    await getPool().query(
      `ALTER TABLE gas_purchases
       ADD COLUMN due_date DATE NULL AFTER purchase_date,
       ADD KEY idx_gas_purchases_due (due_date)`,
    )
  }

  // Migrate gas price_per_cylinder → price_per_kg
  const [pricePerCylCols] = await getPool().query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'gas_purchases'
       AND COLUMN_NAME = 'price_per_cylinder'`,
  )
  const [pricePerKgCols] = await getPool().query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'gas_purchases'
       AND COLUMN_NAME = 'price_per_kg'`,
  )
  if (pricePerCylCols.length && !pricePerKgCols.length) {
    await getPool().query(
      `ALTER TABLE gas_purchases
       CHANGE COLUMN price_per_cylinder price_per_kg DECIMAL(14, 2) NOT NULL`,
    )
  }

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS gas_payments (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      supplier_id INT UNSIGNED NOT NULL,
      payment_date DATE NOT NULL,
      amount DECIMAL(14, 2) NOT NULL,
      note VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_gas_payments_supplier (supplier_id),
      KEY idx_gas_payments_date (payment_date),
      CONSTRAINT fk_gas_payments_supplier
        FOREIGN KEY (supplier_id) REFERENCES gas_suppliers (id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS utility_bills (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      bill_date DATE NOT NULL,
      due_date DATE NULL,
      category VARCHAR(80) NOT NULL,
      title VARCHAR(160) NOT NULL,
      amount DECIMAL(14, 2) NOT NULL,
      pay_status ENUM('paid', 'unpaid') NOT NULL DEFAULT 'unpaid',
      note VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_utility_bills_date (bill_date),
      KEY idx_utility_bills_due (due_date),
      KEY idx_utility_bills_category (category),
      KEY idx_utility_bills_pay_status (pay_status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  const utilityBillExtraCols = [
    { name: 'due_date', ddl: 'DATE NULL AFTER bill_date' },
    {
      name: 'pay_status',
      ddl: "ENUM('paid', 'unpaid') NOT NULL DEFAULT 'unpaid' AFTER amount",
    },
  ]
  for (const col of utilityBillExtraCols) {
    const [cols] = await getPool().query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'utility_bills'
         AND COLUMN_NAME = :name`,
      { name: col.name },
    )
    if (!cols.length) {
      await getPool().query(`ALTER TABLE utility_bills ADD COLUMN ${col.name} ${col.ddl}`)
    }
  }
  const [utilityDueIdx] = await getPool().query(
    `SELECT INDEX_NAME
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'utility_bills'
       AND INDEX_NAME = 'idx_utility_bills_due'`,
  )
  if (!utilityDueIdx.length) {
    await getPool().query(`ALTER TABLE utility_bills ADD KEY idx_utility_bills_due (due_date)`)
  }

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      username VARCHAR(80) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin', 'manager') NOT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_app_users_username (username),
      KEY idx_app_users_role (role)
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
