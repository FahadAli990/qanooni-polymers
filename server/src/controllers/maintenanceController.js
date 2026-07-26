import {
  createMaintenance,
  listMaintenance,
  removeMaintenance,
  updateMaintenance,
} from '../services/maintenanceService.js'
import { ok } from '../utils/apiResponse.js'

export async function listMaintenanceController(req, res, next) {
  try {
    return ok(res, await listMaintenance(req.query))
  } catch (err) {
    return next(err)
  }
}

export async function createMaintenanceController(req, res, next) {
  try {
    return ok(res, await createMaintenance(req.body), 201)
  } catch (err) {
    return next(err)
  }
}

export async function updateMaintenanceController(req, res, next) {
  try {
    return ok(res, await updateMaintenance(req.params.id, req.body))
  } catch (err) {
    return next(err)
  }
}

export async function deleteMaintenanceController(req, res, next) {
  try {
    return ok(res, await removeMaintenance(req.params.id, req.query))
  } catch (err) {
    return next(err)
  }
}
