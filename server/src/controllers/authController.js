import { login } from '../services/authService.js'
import { ok } from '../utils/apiResponse.js'

export async function loginController(req, res, next) {
  try {
    const username = String(req.body?.username || '').trim()
    const password = String(req.body?.password || '')

    if (!username || !password) {
      const error = new Error('Username and password are required')
      error.status = 400
      throw error
    }

    return ok(res, await login({ username, password }))
  } catch (err) {
    return next(err)
  }
}

export function meController(req, res) {
  return ok(res, req.user)
}
