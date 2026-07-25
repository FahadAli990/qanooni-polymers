import { getPool } from '../config/db.js'

function mapRow(row) {
  const KG_PER_BAG = 40
  const stockedKg = Number(row.stocked_kg ?? row.total_kg ?? 0)
  const usedKg = Number(row.used_kg ?? 0)
  const availableKg = Number((stockedKg - usedKg).toFixed(2))
  const stockedBags = Number(row.total_bags ?? 0)
  const usedBags = Number((usedKg / KG_PER_BAG).toFixed(4))
  const availableBags = Number((availableKg / KG_PER_BAG).toFixed(4))
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    swatch: row.swatch,
    createdAt: row.created_at,
    stockedBags,
    usedBags,
    totalBags: availableBags,
    stockedKg,
    usedKg,
    totalKg: availableKg,
  }
}

export async function findAllRawMaterials() {
  const [rows] = await getPool().query(
    `SELECT
       m.id,
       m.slug,
       m.name,
       m.swatch,
       m.created_at,
       COALESCE(SUM(s.bags), 0) AS total_bags,
       COALESCE(SUM(s.kg), 0) AS stocked_kg,
       (
         SELECT COALESCE(SUM(r.kg), 0)
         FROM roll_productions r
         WHERE r.raw_material_id = m.id
       ) AS used_kg
     FROM raw_materials m
     LEFT JOIN raw_material_stocks s ON s.raw_material_id = m.id
     GROUP BY m.id, m.slug, m.name, m.swatch, m.created_at
     ORDER BY m.name ASC`,
  )
  return rows.map(mapRow)
}

export async function findRawMaterialById(id) {
  const [rows] = await getPool().query(
    `SELECT
       m.id,
       m.slug,
       m.name,
       m.swatch,
       m.created_at,
       COALESCE(SUM(s.bags), 0) AS total_bags,
       COALESCE(SUM(s.kg), 0) AS stocked_kg,
       (
         SELECT COALESCE(SUM(r.kg), 0)
         FROM roll_productions r
         WHERE r.raw_material_id = m.id
       ) AS used_kg
     FROM raw_materials m
     LEFT JOIN raw_material_stocks s ON s.raw_material_id = m.id
     WHERE m.id = :id
     GROUP BY m.id, m.slug, m.name, m.swatch, m.created_at
     LIMIT 1`,
    { id },
  )
  return rows[0] ? mapRow(rows[0]) : null
}

export async function findRawMaterialBySlug(slug) {
  const [rows] = await getPool().query(
    `SELECT
       m.id,
       m.slug,
       m.name,
       m.swatch,
       m.created_at,
       COALESCE(SUM(s.bags), 0) AS total_bags,
       COALESCE(SUM(s.kg), 0) AS stocked_kg,
       (
         SELECT COALESCE(SUM(r.kg), 0)
         FROM roll_productions r
         WHERE r.raw_material_id = m.id
       ) AS used_kg
     FROM raw_materials m
     LEFT JOIN raw_material_stocks s ON s.raw_material_id = m.id
     WHERE m.slug = :slug
     GROUP BY m.id, m.slug, m.name, m.swatch, m.created_at
     LIMIT 1`,
    { slug },
  )
  return rows[0] ? mapRow(rows[0]) : null
}

export async function findRawMaterialByName(name) {
  const [rows] = await getPool().query(
    `SELECT
       m.id,
       m.slug,
       m.name,
       m.swatch,
       m.created_at,
       COALESCE(SUM(s.bags), 0) AS total_bags,
       COALESCE(SUM(s.kg), 0) AS stocked_kg,
       (
         SELECT COALESCE(SUM(r.kg), 0)
         FROM roll_productions r
         WHERE r.raw_material_id = m.id
       ) AS used_kg
     FROM raw_materials m
     LEFT JOIN raw_material_stocks s ON s.raw_material_id = m.id
     WHERE m.name = :name
     GROUP BY m.id, m.slug, m.name, m.swatch, m.created_at
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
