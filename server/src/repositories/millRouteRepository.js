import { getPool } from '../config/db.js'

function mapRow(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    createdAt: row.created_at,
  }
}

export async function findAllMillRoutes() {
  const [rows] = await getPool().query(
    `SELECT id, slug, name, created_at
     FROM mill_routes
     ORDER BY id ASC`,
  )
  return rows.map(mapRow)
}

export async function findMillRouteById(id) {
  const [rows] = await getPool().query(
    `SELECT id, slug, name, created_at
     FROM mill_routes
     WHERE id = :id
     LIMIT 1`,
    { id },
  )
  return rows[0] ? mapRow(rows[0]) : null
}

export async function findMillRouteBySlug(slug) {
  const [rows] = await getPool().query(
    `SELECT id, slug, name, created_at
     FROM mill_routes
     WHERE slug = :slug
     LIMIT 1`,
    { slug },
  )
  return rows[0] ? mapRow(rows[0]) : null
}

export async function findMillRouteByName(name) {
  const [rows] = await getPool().query(
    `SELECT id, slug, name, created_at
     FROM mill_routes
     WHERE name = :name
     LIMIT 1`,
    { name },
  )
  return rows[0] ? mapRow(rows[0]) : null
}

export async function insertMillRoute({ slug, name }) {
  const [result] = await getPool().query(
    `INSERT INTO mill_routes (slug, name)
     VALUES (:slug, :name)`,
    { slug, name },
  )
  return findMillRouteById(result.insertId)
}

export async function updateMillRoute(id, { slug, name }) {
  await getPool().query(
    `UPDATE mill_routes
     SET slug = :slug, name = :name
     WHERE id = :id`,
    { id, slug, name },
  )
  return findMillRouteById(id)
}

export async function deleteMillRouteBySlug(slug) {
  const [result] = await getPool().query(
    `DELETE FROM mill_routes WHERE slug = :slug`,
    { slug },
  )
  return result.affectedRows > 0
}
