import {
  createPreviousBill,
  createShopPayment,
  getShopLedger,
  removePreviousBill,
  removeShopPayment,
  updatePreviousBill,
  updateShopPayment,
} from '../services/billService.js'
import { ok } from '../utils/apiResponse.js'

export async function getShopLedgerController(req, res, next) {
  try {
    return ok(
      res,
      await getShopLedger({
        routeSlug: req.query.routeSlug,
        customerId: req.query.customerId,
      }),
    )
  } catch (err) {
    return next(err)
  }
}

export async function createPaymentController(req, res, next) {
  try {
    return ok(res, await createShopPayment(req.body), 201)
  } catch (err) {
    return next(err)
  }
}

export async function updatePaymentController(req, res, next) {
  try {
    return ok(res, await updateShopPayment(req.params.id, req.body))
  } catch (err) {
    return next(err)
  }
}

export async function deletePaymentController(req, res, next) {
  try {
    return ok(
      res,
      await removeShopPayment(req.params.id, {
        routeSlug: req.query.routeSlug ?? req.body?.routeSlug,
        customerId: req.query.customerId ?? req.body?.customerId,
      }),
    )
  } catch (err) {
    return next(err)
  }
}

export async function createPreviousBillController(req, res, next) {
  try {
    return ok(res, await createPreviousBill(req.body), 201)
  } catch (err) {
    return next(err)
  }
}

export async function updatePreviousBillController(req, res, next) {
  try {
    return ok(res, await updatePreviousBill(req.params.id, req.body))
  } catch (err) {
    return next(err)
  }
}

export async function deletePreviousBillController(req, res, next) {
  try {
    return ok(
      res,
      await removePreviousBill(req.params.id, {
        routeSlug: req.query.routeSlug ?? req.body?.routeSlug,
        customerId: req.query.customerId ?? req.body?.customerId,
      }),
    )
  } catch (err) {
    return next(err)
  }
}
