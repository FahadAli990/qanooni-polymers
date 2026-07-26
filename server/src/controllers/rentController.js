import {
  createBuilding,
  createRentPayment,
  getBuildingLedger,
  listBuildings,
  removeBuilding,
  removeRentPayment,
  updateBuilding,
  updateRentPayment,
} from '../services/rentService.js'
import { ok } from '../utils/apiResponse.js'

export async function listBuildingsController(_req, res, next) {
  try {
    return ok(res, await listBuildings())
  } catch (err) {
    return next(err)
  }
}

export async function createBuildingController(req, res, next) {
  try {
    return ok(res, await createBuilding(req.body), 201)
  } catch (err) {
    return next(err)
  }
}

export async function updateBuildingController(req, res, next) {
  try {
    return ok(res, await updateBuilding(req.params.id, req.body))
  } catch (err) {
    return next(err)
  }
}

export async function deleteBuildingController(req, res, next) {
  try {
    return ok(res, await removeBuilding(req.params.id))
  } catch (err) {
    return next(err)
  }
}

export async function getBuildingLedgerController(req, res, next) {
  try {
    return ok(res, await getBuildingLedger(req.params.id, req.query))
  } catch (err) {
    return next(err)
  }
}

export async function createRentPaymentController(req, res, next) {
  try {
    return ok(res, await createRentPayment(req.params.id, req.body), 201)
  } catch (err) {
    return next(err)
  }
}

export async function updateRentPaymentController(req, res, next) {
  try {
    return ok(res, await updateRentPayment(req.params.id, req.params.paymentId, req.body))
  } catch (err) {
    return next(err)
  }
}

export async function deleteRentPaymentController(req, res, next) {
  try {
    return ok(res, await removeRentPayment(req.params.id, req.params.paymentId, req.query))
  } catch (err) {
    return next(err)
  }
}
