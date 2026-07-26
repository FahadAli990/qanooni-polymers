import {
  createVehicle,
  createRentPayment,
  getVehicleLedger,
  listVehicles,
  removeVehicle,
  removeRentPayment,
  updateVehicle,
  updateRentPayment,
} from '../services/rentService.js'
import { ok } from '../utils/apiResponse.js'

export async function listVehiclesController(_req, res, next) {
  try {
    return ok(res, await listVehicles())
  } catch (err) {
    return next(err)
  }
}

export async function createVehicleController(req, res, next) {
  try {
    return ok(res, await createVehicle(req.body), 201)
  } catch (err) {
    return next(err)
  }
}

export async function updateVehicleController(req, res, next) {
  try {
    return ok(res, await updateVehicle(req.params.id, req.body))
  } catch (err) {
    return next(err)
  }
}

export async function deleteVehicleController(req, res, next) {
  try {
    return ok(res, await removeVehicle(req.params.id))
  } catch (err) {
    return next(err)
  }
}

export async function getVehicleLedgerController(req, res, next) {
  try {
    return ok(res, await getVehicleLedger(req.params.id, req.query))
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
