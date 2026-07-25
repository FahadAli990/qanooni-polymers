import express from 'express'
import cors from 'cors'
import { env } from './config/env.js'
import { ensureDatabase, ensureSchema, pingDatabase } from './config/db.js'
import { logger } from './utils/logger.js'
import apiRoutes from './routes/index.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { syncRawMaterialSwatches } from './services/rawMaterialService.js'

const app = express()

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.clientOrigins.includes(origin) || env.clientOrigins.includes('*')) {
        callback(null, true)
        return
      }
      callback(new Error(`CORS blocked for origin: ${origin}`))
    },
  }),
)
app.use(express.json({ limit: '16kb' }))
app.use('/api', apiRoutes)
app.use(notFoundHandler)
app.use(errorHandler)

async function start() {
  try {
    await ensureDatabase()
    await ensureSchema()
  } catch (err) {
    logger.error('MySQL is required but not reachable', {
      host: env.mysql.host,
      port: env.mysql.port,
      database: env.mysql.database,
      error: err.message,
      hint: 'Start Oracle MySQL on 127.0.0.1:3306, then restart server',
    })
    process.exit(1)
  }

  const db = await pingDatabase()
  if (!db.connected) {
    logger.error('MySQL ping failed after ensureDatabase', { error: db.error })
    process.exit(1)
  }

  try {
    await syncRawMaterialSwatches()
  } catch (err) {
    logger.warn('Raw material swatch sync skipped', { error: err.message })
  }

  app.listen(env.port, () => {
    logger.info('Server started', {
      port: env.port,
      env: env.nodeEnv,
      mysql: { host: env.mysql.host, port: env.mysql.port, database: env.mysql.database },
    })
  })
}

start().catch((err) => {
  logger.error('Failed to start server', { error: err.message })
  process.exit(1)
})
