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

export function requireAdmin(req, res, next) {
  if (!req.user) {
    return fail(res, 'Unauthorized', 401)
  }
  if (req.user.role !== 'admin') {
    return fail(res, 'Admin access required', 403)
  }
  return next()
}

/**
 * Managers may only create (POST) new records.
 * PUT / PATCH / DELETE and state-change POSTs (deliver/pending) are blocked.
 */
export function enforceRolePermissions(req, res, next) {
  if (!req.user) {
    return fail(res, 'Unauthorized', 401)
  }
  if (req.user.role !== 'manager') {
    return next()
  }

  const method = req.method.toUpperCase()
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return next()
  }

  const fullPath = `${req.baseUrl || ''}${req.path || ''}`

  if (method === 'POST') {
    if (/\/(deliver|pending)$/.test(fullPath)) {
      return fail(res, 'Managers cannot change existing records', 403)
    }
    if (/\/managers(\/|$)/.test(fullPath)) {
      return fail(res, 'Only admin can manage managers', 403)
    }
    return next()
  }

  // Managers may mark unpaid utility bills as paid (service blocks paid → unpaid).
  if (method === 'PATCH' && /\/bills\/[^/]+\/status$/.test(fullPath)) {
    return next()
  }

  return fail(
    res,
    'Managers can only add records. Edit and delete are not allowed.',
    403,
  )
}
