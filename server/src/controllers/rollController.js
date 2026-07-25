import {
  createRollProduction,
  listRollProductions,
  removeRollProduction,
  updateRollProduction,
} from '../services/rollService.js'
import { ok } from '../utils/apiResponse.js'

export async function listRollsController(_req, res, next) {
  try {
    return ok(res, await listRollProductions())
  } catch (err) {
    return next(err)
  }
}

export async function createRollController(req, res, next) {
  try {
    return ok(res, await createRollProduction(req.body), 201)
  } catch (err) {
    return next(err)
  }
}

export async function updateRollController(req, res, next) {
  try {
    return ok(res, await updateRollProduction(req.params.id, req.body))
  } catch (err) {
    return next(err)
  }
}

export async function deleteRollController(req, res, next) {
  try {
    return ok(res, await removeRollProduction(req.params.id))
  } catch (err) {
    return next(err)
  }
}
