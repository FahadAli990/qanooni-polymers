import { pingDatabase } from '../config/db.js'
import { ok } from '../utils/apiResponse.js'

export async function healthController(_req, res) {
  const database = await pingDatabase()
  if (!database.connected) {
    return res.status(503).json({
      success: false,
      error: 'Database unavailable',
      data: { database },
    })
  }
  return ok(res, { status: 'ok', database })
}
