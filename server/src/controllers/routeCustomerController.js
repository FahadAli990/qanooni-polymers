import {
  createRouteCustomer,
  listRouteCustomers,
  removeRouteCustomer,
  updateRouteCustomer,
} from '../services/routeCustomerService.js'
import { ok } from '../utils/apiResponse.js'

export async function listRouteCustomersController(req, res, next) {
  try {
    return ok(res, await listRouteCustomers(req.params.slug))
  } catch (err) {
    return next(err)
  }
}

export async function createRouteCustomerController(req, res, next) {
  try {
    return ok(res, await createRouteCustomer(req.params.slug, req.body), 201)
  } catch (err) {
    return next(err)
  }
}

export async function updateRouteCustomerController(req, res, next) {
  try {
    return ok(
      res,
      await updateRouteCustomer(req.params.slug, req.params.customerId, req.body),
    )
  } catch (err) {
    return next(err)
  }
}

export async function deleteRouteCustomerController(req, res, next) {
  try {
    return ok(res, await removeRouteCustomer(req.params.slug, req.params.customerId))
  } catch (err) {
    return next(err)
  }
}
