import {
  createVehicle,
  createRentPayment,
  createTrip,
  getVehicleLedger,
  listVehicles,
  removeVehicle,
  removeRentPayment,
  removeTrip,
  updateVehicle,
  updateRentPayment,
  updateTrip,
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
    return ok(res, await getVehicleLedger(req.params.id))
  } catch (err) {
    return next(err)
  }
}

export async function createTripController(req, res, next) {
  try {
    return ok(res, await createTrip(req.params.id, req.body), 201)
  } catch (err) {
    return next(err)
  }
}

export async function updateTripController(req, res, next) {
  try {
    return ok(res, await updateTrip(req.params.id, req.params.tripId, req.body))
  } catch (err) {
    return next(err)
  }
}

export async function deleteTripController(req, res, next) {
  try {
    return ok(res, await removeTrip(req.params.id, req.params.tripId))
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
    return ok(res, await removeRentPayment(req.params.id, req.params.paymentId))
  } catch (err) {
    return next(err)
  }
}
