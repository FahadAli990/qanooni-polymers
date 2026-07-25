import { slugifyName } from './rawMaterialService.js'
import {
  deleteMillRouteBySlug,
  findAllMillRoutes,
  findMillRouteByName,
  findMillRouteBySlug,
  insertMillRoute,
  updateMillRoute,
} from '../repositories/millRouteRepository.js'

function badRequest(message) {
  const error = new Error(message)
  error.status = 400
  return error
}

function notFound(message = 'Route not found') {
  const error = new Error(message)
  error.status = 404
  return error
}

function conflict(message) {
  const error = new Error(message)
  error.status = 409
  return error
}

function normalizeRouteName(inputName) {
  const name = String(inputName || '').trim()
  if (!name) throw badRequest('Route name is required')
  if (name.length > 120) throw badRequest('Route name must be 120 characters or less')

  const slug = slugifyName(name)
  if (!slug) throw badRequest('Route name must include letters or numbers')

  return { name, slug }
}

async function assertNameAvailable(name, slug, excludeId = null) {
  const byName = await findMillRouteByName(name)
  if (byName && byName.id !== excludeId) {
    throw conflict('A route with this name already exists')
  }
  const bySlug = await findMillRouteBySlug(slug)
  if (bySlug && bySlug.id !== excludeId) {
    throw conflict('A route with this name already exists')
  }
}

export async function listMillRoutes() {
  return findAllMillRoutes()
}

export async function getMillRouteBySlug(slug) {
  return findMillRouteBySlug(slug)
}

export async function createMillRoute(inputName) {
  const payload = normalizeRouteName(inputName)
  await assertNameAvailable(payload.name, payload.slug)
  return insertMillRoute(payload)
}

export async function updateMillRouteBySlug(currentSlug, inputName) {
  const existing = await findMillRouteBySlug(currentSlug)
  if (!existing) throw notFound()

  const payload = normalizeRouteName(inputName)
  await assertNameAvailable(payload.name, payload.slug, existing.id)
  return updateMillRoute(existing.id, payload)
}

export async function removeMillRouteBySlug(slug) {
  const deleted = await deleteMillRouteBySlug(slug)
  if (!deleted) throw notFound()
  return true
}
