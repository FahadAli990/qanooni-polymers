import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

export function login({ username, password }) {
  if (username !== env.authUsername || password !== env.authPassword) {
    const error = new Error('Invalid username or password')
    error.status = 401
    throw error
  }

  const user = { id: 'env-user', username: env.authUsername, role: 'user' }
  const token = jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  )

  return { token, user }
}

export function verifyToken(token) {
  try {
    const payload = jwt.verify(token, env.jwtSecret)
    return { id: payload.sub, username: payload.username, role: payload.role }
  } catch {
    const error = new Error('Unauthorized')
    error.status = 401
    throw error
  }
}
