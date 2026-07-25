import { verifyToken } from '../services/authService.js'
import { fail } from '../utils/apiResponse.js'

export function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      const error = new Error('Unauthorized')
      error.status = 401
      throw error
    }
    req.user = verifyToken(authHeader.slice(7))
    next()
  } catch (err) {
    return fail(res, err.message || 'Unauthorized', err.status || 401)
  }
}
