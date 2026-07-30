import { findMillRouteBySlug } from '../repositories/millRouteRepository.js'
import {
  deleteCustomerById,
  findCustomersByRouteId,
  insertCustomer,
  updateCustomerById,
} from '../repositories/routeCustomerRepository.js'
import { normalizeContactNumbers } from '../utils/contactNumbers.js'

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

async function requireRoute(slug) {
  const route = await findMillRouteBySlug(slug)
  if (!route) throw notFound()
  return route
}

function normalizeCustomerInput(body = {}) {
  const shopName = String(body.shopName ?? body.shop_name ?? '').trim()
  const address = String(body.address ?? '').trim()
  const ownerName = String(body.ownerName ?? body.owner_name ?? '').trim()
  const contactRaw = String(body.contactNumber ?? body.contact_number ?? '').trim()

  if (!shopName) throw badRequest('Shop name is required')
  if (shopName.length > 160) throw badRequest('Shop name must be 160 characters or less')

  if (!address) throw badRequest('Address is required')
  if (address.length > 255) throw badRequest('Address must be 255 characters or less')

  if (!ownerName) throw badRequest('Owner name is required')
  if (ownerName.length > 120) throw badRequest('Owner name must be 120 characters or less')

  const contact = normalizeContactNumbers(contactRaw, { fieldLabel: 'Contact number' })
  if (!contact.ok) throw badRequest(contact.error)

  return { shopName, address, ownerName, contactNumber: contact.value }
}

export async function listRouteCustomers(slug) {
  const route = await requireRoute(slug)
  const items = await findCustomersByRouteId(route.id)
  return { route, items }
}

export async function createRouteCustomer(slug, body) {
  const route = await requireRoute(slug)
  const payload = normalizeCustomerInput(body)
  const item = await insertCustomer({ millRouteId: route.id, ...payload })
  return { route, item }
}

export async function updateRouteCustomer(slug, customerId, body) {
  const route = await requireRoute(slug)
  const id = Number(customerId)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid customer id')

  const payload = normalizeCustomerInput(body)
  const item = await updateCustomerById(id, route.id, payload)
  if (!item) {
    const error = new Error('Customer not found')
    error.status = 404
    throw error
  }
  return { route, item }
}

export async function removeRouteCustomer(slug, customerId) {
  const route = await requireRoute(slug)
  const id = Number(customerId)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid customer id')

  const deleted = await deleteCustomerById(id, route.id)
  if (!deleted) {
    const error = new Error('Customer not found')
    error.status = 404
    throw error
  }
  return { route, deleted: true }
}
