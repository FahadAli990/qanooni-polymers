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

export const env = {
  port: Number(envOr('PORT', '5000')),
  nodeEnv: envOr('NODE_ENV', 'development'),
  authUsername: isProd ? requireEnv('AUTH_USERNAME') : envOr('AUTH_USERNAME', 'asdf123'),
  authPassword: isProd ? requireEnv('AUTH_PASSWORD') : envOr('AUTH_PASSWORD', 'asdf123'),
  jwtSecret: isProd ? requireEnv('JWT_SECRET') : envOr('JWT_SECRET', 'qanooni-polymers-dev-jwt-secret-change-in-production'),
  jwtExpiresIn: envOr('JWT_EXPIRES_IN', '7d'),
  clientOrigin: envOr('CLIENT_ORIGIN', 'http://localhost:5173'),
  mysql: {
    host: envOr('MYSQL_HOST', '127.0.0.1'),
    port: Number(envOr('MYSQL_PORT', '3306')),
    user: envOr('MYSQL_USER', 'root'),
    password: envOr('MYSQL_PASSWORD', ''),
    database: envOr('MYSQL_DATABASE', 'Qanooni_db'),
  },
}
