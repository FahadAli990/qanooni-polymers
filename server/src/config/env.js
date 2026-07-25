import dotenv from 'dotenv'

dotenv.config()

const isProd = process.env.NODE_ENV === 'production'

function requireEnv(name) {
  const value = process.env[name]
  if (value === undefined || value === '') {
    throw new Error(`Missing required env: ${name}`)
  }
  return value
}

function envOr(name, fallback) {
  const value = process.env[name]
  if (value === undefined || value === '') return fallback
  return value
}

function parseMysqlUrl(urlString) {
  if (!urlString) return null
  try {
    const u = new URL(urlString)
    return {
      host: u.hostname,
      port: Number(u.port || '3306'),
      user: decodeURIComponent(u.username || ''),
      password: decodeURIComponent(u.password || ''),
      database: (u.pathname || '').replace(/^\//, '') || undefined,
    }
  } catch {
    return null
  }
}

const fromUrl = parseMysqlUrl(process.env.MYSQL_URL || process.env.DATABASE_URL)

export const env = {
  port: Number(envOr('PORT', '5000')),
  nodeEnv: envOr('NODE_ENV', 'development'),
  authUsername: isProd ? requireEnv('AUTH_USERNAME') : envOr('AUTH_USERNAME', 'asdf123'),
  authPassword: isProd ? requireEnv('AUTH_PASSWORD') : envOr('AUTH_PASSWORD', 'asdf123'),
  jwtSecret: isProd ? requireEnv('JWT_SECRET') : envOr('JWT_SECRET', 'qanooni-polymers-dev-jwt-secret-change-in-production'),
  jwtExpiresIn: envOr('JWT_EXPIRES_IN', '7d'),
  clientOrigins: envOr('CLIENT_ORIGIN', 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  mysql: {
    host: envOr('MYSQL_HOST', envOr('MYSQLHOST', fromUrl?.host || '127.0.0.1')),
    port: Number(envOr('MYSQL_PORT', envOr('MYSQLPORT', String(fromUrl?.port || 3306)))),
    user: envOr('MYSQL_USER', envOr('MYSQLUSER', fromUrl?.user || 'root')),
    password: envOr('MYSQL_PASSWORD', envOr('MYSQLPASSWORD', fromUrl?.password || '')),
    database: envOr('MYSQL_DATABASE', envOr('MYSQLDATABASE', fromUrl?.database || 'Qanooni_db')),
    ssl: ['1', 'true', 'yes'].includes(String(envOr('MYSQL_SSL', 'false')).toLowerCase()),
  },
}
