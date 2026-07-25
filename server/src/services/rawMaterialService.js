import {
  deleteRawMaterialBySlug,
  findAllRawMaterials,
  findRawMaterialByName,
  findRawMaterialBySlug,
  insertRawMaterial,
  updateRawMaterial,
  updateRawMaterialSwatch,
} from '../repositories/rawMaterialRepository.js'

/** Common color names → real hex (name jo doge, wahi color) */
const COLOR_NAME_MAP = {
  red: '#dc2626',
  maroon: '#7f1d1d',
  crimson: '#dc143c',
  pink: '#ec4899',
  rose: '#f43f5e',
  orange: '#ea580c',
  amber: '#d97706',
  yellow: '#ca8a04',
  gold: '#eab308',
  lime: '#65a30d',
  green: '#16a34a',
  emerald: '#059669',
  teal: '#0d9488',
  cyan: '#0891b2',
  sky: '#0284c7',
  blue: '#2563eb',
  navy: '#1e3a8a',
  indigo: '#4f46e5',
  purple: '#7c3aed',
  violet: '#8b5cf6',
  magenta: '#d946ef',
  fuchsia: '#c026d3',
  brown: '#92400e',
  chocolate: '#7c2d12',
  beige: '#d6d3d1',
  cream: '#fef3c7',
  white: '#f8fafc',
  black: '#171717',
  gray: '#6b7280',
  grey: '#6b7280',
  silver: '#94a3b8',
  charcoal: '#374151',
}

const DEFAULT_SWATCH = '#64748b'

export function slugifyName(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
}

function normalizeColorKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, '')
}

function isHexColor(value) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value || '').trim())
}

/** "Blue", "dark blue", "#2563eb" → matching swatch */
export function swatchFromName(name) {
  const trimmed = String(name || '').trim()
  if (!trimmed) return DEFAULT_SWATCH

  if (isHexColor(trimmed)) {
    const hex = trimmed.toLowerCase()
    if (hex.length === 4) {
      return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    }
    return hex
  }

  const fullKey = normalizeColorKey(trimmed)
  if (COLOR_NAME_MAP[fullKey]) return COLOR_NAME_MAP[fullKey]

  const words = trimmed.toLowerCase().split(/[^a-z]+/).filter(Boolean)
  for (let i = words.length - 1; i >= 0; i -= 1) {
    if (COLOR_NAME_MAP[words[i]]) return COLOR_NAME_MAP[words[i]]
  }

  for (const [key, hex] of Object.entries(COLOR_NAME_MAP)) {
    if (fullKey.includes(key)) return hex
  }

  return DEFAULT_SWATCH
}

function normalizeMaterialName(inputName) {
  const name = String(inputName || '').trim()
  if (!name) {
    const error = new Error('Name is required')
    error.status = 400
    throw error
  }
  if (name.length > 120) {
    const error = new Error('Name must be 120 characters or less')
    error.status = 400
    throw error
  }

  const slug = slugifyName(name)
  if (!slug) {
    const error = new Error('Name must include letters or numbers')
    error.status = 400
    throw error
  }

  return { name, slug, swatch: swatchFromName(name) }
}

async function assertNameAvailable(name, slug, excludeId = null) {
  const byName = await findRawMaterialByName(name)
  if (byName && byName.id !== excludeId) {
    const error = new Error('A raw material with this name already exists')
    error.status = 409
    throw error
  }

  const bySlug = await findRawMaterialBySlug(slug)
  if (bySlug && bySlug.id !== excludeId) {
    const error = new Error('A raw material with this name already exists')
    error.status = 409
    throw error
  }
}

export async function listRawMaterials() {
  const items = await findAllRawMaterials()
  const totals = items.reduce(
    (acc, item) => ({
      totalBags: acc.totalBags + Number(item.totalBags || 0),
      totalKg: acc.totalKg + Number(item.totalKg || 0),
    }),
    { totalBags: 0, totalKg: 0 },
  )
  return {
    items,
    totals: {
      totalBags: Number(totals.totalBags.toFixed(2)),
      totalKg: Number(totals.totalKg.toFixed(2)),
      kgPerBag: 40,
    },
  }
}

export async function getRawMaterialBySlug(slug) {
  return findRawMaterialBySlug(slug)
}

export async function syncRawMaterialSwatches() {
  const items = await findAllRawMaterials()
  await Promise.all(
    items.map(async (item) => {
      const swatch = swatchFromName(item.name)
      if (swatch !== item.swatch) {
        await updateRawMaterialSwatch(item.id, swatch)
      }
    }),
  )
}

export async function createRawMaterial(inputName) {
  const payload = normalizeMaterialName(inputName)
  await assertNameAvailable(payload.name, payload.slug)
  return insertRawMaterial(payload)
}

export async function updateRawMaterialBySlug(currentSlug, inputName) {
  const existing = await findRawMaterialBySlug(currentSlug)
  if (!existing) {
    const error = new Error('Raw material not found')
    error.status = 404
    throw error
  }

  const payload = normalizeMaterialName(inputName)
  await assertNameAvailable(payload.name, payload.slug, existing.id)
  return updateRawMaterial(existing.id, payload)
}

export async function removeRawMaterialBySlug(slug) {
  const deleted = await deleteRawMaterialBySlug(slug)
  if (!deleted) {
    const error = new Error('Raw material not found')
    error.status = 404
    throw error
  }
  return true
}
