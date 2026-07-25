import { getPool } from '../config/db.js'

function mapRow(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    swatch: row.swatch,
    createdAt: row.created_at,
  }
}

export async function findAllRawMaterials() {
  const [rows] = await getPool().query(
    `SELECT id, slug, name, swatch, created_at
     FROM raw_materials
     ORDER BY name ASC`,
  )
  return rows.map(mapRow)
}

export async function findRawMaterialById(id) {
  const [rows] = await getPool().query(
    `SELECT id, slug, name, swatch, created_at
     FROM raw_materials
     WHERE id = :id
     LIMIT 1`,
    { id },
  )
  return rows[0] ? mapRow(rows[0]) : null
}

export async function findRawMaterialBySlug(slug) {
  const [rows] = await getPool().query(
    `SELECT id, slug, name, swatch, created_at
     FROM raw_materials
     WHERE slug = :slug
     LIMIT 1`,
    { slug },
  )
  return rows[0] ? mapRow(rows[0]) : null
}

export async function findRawMaterialByName(name) {
  const [rows] = await getPool().query(
    `SELECT id, slug, name, swatch, created_at
     FROM raw_materials
     WHERE name = :name
     LIMIT 1`,
    { name },
  )
  return rows[0] ? mapRow(rows[0]) : null
}

export async function insertRawMaterial({ slug, name, swatch }) {
  const [result] = await getPool().query(
    `INSERT INTO raw_materials (slug, name, swatch)
     VALUES (:slug, :name, :swatch)`,
    { slug, name, swatch },
  )
  return findRawMaterialById(result.insertId)
}

export async function updateRawMaterialSwatch(id, swatch) {
  await getPool().query(
    `UPDATE raw_materials SET swatch = :swatch WHERE id = :id`,
    { id, swatch },
  )
}

export async function updateRawMaterial(id, { slug, name, swatch }) {
  await getPool().query(
    `UPDATE raw_materials
     SET slug = :slug, name = :name, swatch = :swatch
     WHERE id = :id`,
    { id, slug, name, swatch },
  )
  return findRawMaterialById(id)
}

export async function deleteRawMaterialBySlug(slug) {
  const [result] = await getPool().query(
    `DELETE FROM raw_materials WHERE slug = :slug`,
    { slug },
  )
  return result.affectedRows > 0
}
