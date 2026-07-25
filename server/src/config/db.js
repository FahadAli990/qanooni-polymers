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
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_raw_materials_slug (slug),
      UNIQUE KEY uq_raw_materials_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

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
      raw_material_id INT UNSIGNED NOT NULL,
      production_date DATE NOT NULL,
      size VARCHAR(16) NOT NULL,
      kg DECIMAL(14, 2) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_roll_productions_material (raw_material_id),
      KEY idx_roll_productions_date (production_date),
      CONSTRAINT fk_roll_productions_material
        FOREIGN KEY (raw_material_id) REFERENCES raw_materials (id)
        ON DELETE CASCADE
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
