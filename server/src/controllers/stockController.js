import {
  createStockForMaterialSlug,
  listStocksByMaterialSlug,
  removeStockForMaterialSlug,
  updateStockForMaterialSlug,
} from '../services/stockService.js'
import { ok } from '../utils/apiResponse.js'

export async function listStocksController(req, res, next) {
  try {
    return ok(res, await listStocksByMaterialSlug(req.params.slug))
  } catch (err) {
    return next(err)
  }
}

export async function createStockController(req, res, next) {
  try {
    return ok(res, await createStockForMaterialSlug(req.params.slug, req.body), 201)
  } catch (err) {
    return next(err)
  }
}

export async function updateStockController(req, res, next) {
  try {
    return ok(res, await updateStockForMaterialSlug(req.params.slug, req.params.stockId, req.body))
  } catch (err) {
    return next(err)
  }
}

export async function deleteStockController(req, res, next) {
  try {
    return ok(res, await removeStockForMaterialSlug(req.params.slug, req.params.stockId))
  } catch (err) {
    return next(err)
  }
}
