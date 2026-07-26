import bcrypt from 'bcryptjs'
import { getPool } from '../config/db.js'

const SALT_ROUNDS = 10

function mapUser(row) {
  return {
    id: row.id,
    username: row.username,
    role: row.role === 'manager' ? 'manager' : 'admin',
    active: Boolean(row.active),
    createdAt: row.created_at,
  }
}

export async function findUserByUsername(username) {
  const [rows] = await getPool().query(
    `SELECT id, username, password_hash, role, active, created_at
     FROM app_users
     WHERE username = :username
     LIMIT 1`,
    { username },
  )
  return rows[0] || null
}

export async function findUserById(id) {
  const [rows] = await getPool().query(
    `SELECT id, username, password_hash, role, active, created_at
     FROM app_users
     WHERE id = :id
     LIMIT 1`,
    { id },
  )
  return rows[0] || null
}

export async function findAllManagers() {
  const [rows] = await getPool().query(
    `SELECT id, username, role, active, created_at
     FROM app_users
     WHERE role = 'manager'
     ORDER BY created_at ASC, id ASC`,
  )
  return rows.map(mapUser)
}

export async function insertUser({ username, passwordHash, role }) {
  const [result] = await getPool().query(
    `INSERT INTO app_users (username, password_hash, role, active)
     VALUES (:username, :passwordHash, :role, 1)`,
    { username, passwordHash, role },
  )
  const row = await findUserById(result.insertId)
  return mapUser(row)
}

export async function updateUserPassword(id, passwordHash) {
  const [result] = await getPool().query(
    `UPDATE app_users SET password_hash = :passwordHash WHERE id = :id`,
    { id, passwordHash },
  )
  return result.affectedRows > 0
}

export async function setUserActive(id, active) {
  const [result] = await getPool().query(
    `UPDATE app_users SET active = :active WHERE id = :id AND role = 'manager'`,
    { id, active: active ? 1 : 0 },
  )
  return result.affectedRows > 0
}

export async function deleteManagerById(id) {
  const [result] = await getPool().query(
    `DELETE FROM app_users WHERE id = :id AND role = 'manager'`,
    { id },
  )
  return result.affectedRows > 0
}

export async function hashPassword(password) {
  return bcrypt.hash(String(password), SALT_ROUNDS)
}

export async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(String(password), String(passwordHash || ''))
}

export { mapUser }
