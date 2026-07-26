import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { getPool } from '../config/db.js'
import {
  deleteManagerById,
  findAllManagers,
  findUserById,
  findUserByUsername,
  hashPassword,
  insertUser,
  mapUser,
  setUserActive,
  updateUserPassword,
  verifyPassword,
} from '../repositories/userRepository.js'

function badRequest(message) {
  const error = new Error(message)
  error.status = 400
  return error
}

function unauthorized(message = 'Invalid username or password') {
  const error = new Error(message)
  error.status = 401
  return error
}

function forbidden(message) {
  const error = new Error(message)
  error.status = 403
  return error
}

function notFound(message) {
  const error = new Error(message)
  error.status = 404
  return error
}

function normalizeRole(role) {
  return role === 'manager' ? 'manager' : 'admin'
}

function toPublicUser(row) {
  const mapped = mapUser(row)
  return { id: mapped.id, username: mapped.username, role: mapped.role }
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  )
}

/** Keep env admin as source of truth on every boot. */
export async function ensureAdminUser() {
  const username = String(env.authUsername || '').trim()
  const password = String(env.authPassword || '')
  if (!username || !password) {
    throw new Error('AUTH_USERNAME and AUTH_PASSWORD are required to seed admin')
  }
  const passwordHash = await hashPassword(password)
  const existing = await findUserByUsername(username)
  if (!existing) {
    await insertUser({ username, passwordHash, role: 'admin' })
    return
  }
  if (existing.role !== 'admin') {
    throw new Error(`Username "${username}" exists but is not admin — change AUTH_USERNAME`)
  }
  await updateUserPassword(existing.id, passwordHash)
  if (!existing.active) {
    await getPool().query(`UPDATE app_users SET active = 1 WHERE id = :id`, { id: existing.id })
  }
}

export async function login({ username, password }) {
  const userName = String(username || '').trim()
  const pass = String(password || '')
  if (!userName || !pass) throw badRequest('Username and password are required')

  const row = await findUserByUsername(userName)
  if (!row || !row.active) throw unauthorized()

  const okPass = await verifyPassword(pass, row.password_hash)
  if (!okPass) throw unauthorized()

  const user = toPublicUser(row)
  const token = signToken(user)
  return { token, user }
}

export function verifyToken(token) {
  try {
    const payload = jwt.verify(token, env.jwtSecret)
    return {
      id: payload.sub,
      username: payload.username,
      role: normalizeRole(payload.role),
    }
  } catch {
    throw unauthorized('Unauthorized')
  }
}

export async function listManagers() {
  return findAllManagers()
}

export async function createManager(body = {}) {
  const username = String(body.username || '').trim()
  const password = String(body.password || '')
  if (!username) throw badRequest('Username is required')
  if (username.length < 3 || username.length > 80) {
    throw badRequest('Username must be 3–80 characters')
  }
  if (password.length < 4) throw badRequest('Password must be at least 4 characters')
  if (username === env.authUsername) {
    throw badRequest('This username is reserved for admin')
  }
  const existing = await findUserByUsername(username)
  if (existing) {
    const error = new Error('A user with this username already exists')
    error.status = 409
    throw error
  }
  const passwordHash = await hashPassword(password)
  return insertUser({ username, passwordHash, role: 'manager' })
}

export async function resetManagerPassword(idInput, body = {}) {
  const id = Number(idInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid manager id')
  const password = String(body.password || '')
  if (password.length < 4) throw badRequest('Password must be at least 4 characters')
  const row = await findUserById(id)
  if (!row || row.role !== 'manager') throw notFound('Manager not found')
  await updateUserPassword(id, await hashPassword(password))
  return mapUser(await findUserById(id))
}

export async function setManagerActive(idInput, active) {
  const id = Number(idInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid manager id')
  const row = await findUserById(id)
  if (!row || row.role !== 'manager') throw notFound('Manager not found')
  const ok = await setUserActive(id, Boolean(active))
  if (!ok) throw notFound('Manager not found')
  return mapUser(await findUserById(id))
}

export async function removeManager(idInput) {
  const id = Number(idInput)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid manager id')
  const row = await findUserById(id)
  if (!row || row.role !== 'manager') throw notFound('Manager not found')
  const deleted = await deleteManagerById(id)
  if (!deleted) throw notFound('Manager not found')
  return { deleted: true }
}

export function assertAdmin(user) {
  if (normalizeRole(user?.role) !== 'admin') throw forbidden('Admin access required')
}
