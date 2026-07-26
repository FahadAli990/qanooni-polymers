import {
  createManager,
  listManagers,
  removeManager,
  resetManagerPassword,
  setManagerActive,
} from '../services/authService.js'
import { ok } from '../utils/apiResponse.js'

export async function listManagersController(_req, res, next) {
  try {
    return ok(res, await listManagers())
  } catch (err) {
    return next(err)
  }
}

export async function createManagerController(req, res, next) {
  try {
    return ok(res, await createManager(req.body), 201)
  } catch (err) {
    return next(err)
  }
}

export async function resetManagerPasswordController(req, res, next) {
  try {
    return ok(res, await resetManagerPassword(req.params.id, req.body))
  } catch (err) {
    return next(err)
  }
}

export async function setManagerActiveController(req, res, next) {
  try {
    const active = req.body?.active !== false && req.body?.active !== 0
    return ok(res, await setManagerActive(req.params.id, active))
  } catch (err) {
    return next(err)
  }
}

export async function deleteManagerController(req, res, next) {
  try {
    return ok(res, await removeManager(req.params.id))
  } catch (err) {
    return next(err)
  }
}
