import {
  createMillRoute,
  getMillRouteBySlug,
  listMillRoutes,
  removeMillRouteBySlug,
  updateMillRouteBySlug,
} from '../services/millRouteService.js'
import { ok } from '../utils/apiResponse.js'

export async function listMillRoutesController(_req, res, next) {
  try {
    return ok(res, await listMillRoutes())
  } catch (err) {
    return next(err)
  }
}

export async function getMillRouteController(req, res, next) {
  try {
    const item = await getMillRouteBySlug(req.params.slug)
    if (!item) {
      const error = new Error('Route not found')
      error.status = 404
      throw error
    }
    return ok(res, item)
  } catch (err) {
    return next(err)
  }
}

export async function createMillRouteController(req, res, next) {
  try {
    return ok(res, await createMillRoute(req.body?.name), 201)
  } catch (err) {
    return next(err)
  }
}

export async function updateMillRouteController(req, res, next) {
  try {
    return ok(res, await updateMillRouteBySlug(req.params.slug, req.body?.name))
  } catch (err) {
    return next(err)
  }
}

export async function deleteMillRouteController(req, res, next) {
  try {
    await removeMillRouteBySlug(req.params.slug)
    return ok(res, { deleted: true })
  } catch (err) {
    return next(err)
  }
}
