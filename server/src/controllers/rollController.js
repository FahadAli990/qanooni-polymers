import {
  createRollProduction,
  listRollProductions,
  removeRollProduction,
  updateRollProduction,
} from '../services/rollService.js'
import { ok } from '../utils/apiResponse.js'

export async function listRollsController(req, res, next) {
  try {
    return ok(res, await listRollProductions(req.params.kind || 'roll'))
  } catch (err) {
    return next(err)
  }
}

export async function createRollController(req, res, next) {
  try {
    return ok(res, await createRollProduction(req.body, req.params.kind || 'roll'), 201)
  } catch (err) {
    return next(err)
  }
}

export async function updateRollController(req, res, next) {
  try {
    return ok(res, await updateRollProduction(req.params.id, req.body, req.params.kind || 'roll'))
  } catch (err) {
    return next(err)
  }
}

export async function deleteRollController(req, res, next) {
  try {
    return ok(res, await removeRollProduction(req.params.id, req.params.kind || 'roll'))
  } catch (err) {
    return next(err)
  }
}
