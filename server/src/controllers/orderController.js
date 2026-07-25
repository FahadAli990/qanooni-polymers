import {
  createOrder,
  deliverOrder,
  getOrderRates,
  listOrders,
  removeOrder,
  undeliverOrder,
  updateOrder,
} from '../services/orderService.js'
import { ok } from '../utils/apiResponse.js'

export async function listOrdersController(_req, res, next) {
  try {
    return ok(res, await listOrders())
  } catch (err) {
    return next(err)
  }
}

export async function getOrderRatesController(_req, res, next) {
  try {
    return ok(res, await getOrderRates())
  } catch (err) {
    return next(err)
  }
}

export async function createOrderController(req, res, next) {
  try {
    return ok(res, await createOrder(req.body), 201)
  } catch (err) {
    return next(err)
  }
}

export async function updateOrderController(req, res, next) {
  try {
    return ok(res, await updateOrder(req.params.id, req.body))
  } catch (err) {
    return next(err)
  }
}

export async function deliverOrderController(req, res, next) {
  try {
    return ok(res, await deliverOrder(req.params.id))
  } catch (err) {
    return next(err)
  }
}

export async function undeliverOrderController(req, res, next) {
  try {
    return ok(res, await undeliverOrder(req.params.id))
  } catch (err) {
    return next(err)
  }
}

export async function deleteOrderController(req, res, next) {
  try {
    return ok(res, await removeOrder(req.params.id))
  } catch (err) {
    return next(err)
  }
}
