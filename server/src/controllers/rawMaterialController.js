import {
  createRawMaterial,
  getRawMaterialBySlug,
  listRawMaterials,
  removeRawMaterialBySlug,
  updateRawMaterialBySlug,
} from '../services/rawMaterialService.js'
import { ok } from '../utils/apiResponse.js'

export async function listRawMaterialsController(_req, res, next) {
  try {
    return ok(res, await listRawMaterials())
  } catch (err) {
    return next(err)
  }
}

export async function getRawMaterialController(req, res, next) {
  try {
    const item = await getRawMaterialBySlug(req.params.slug)
    if (!item) {
      const error = new Error('Raw material not found')
      error.status = 404
      throw error
    }
    return ok(res, item)
  } catch (err) {
    return next(err)
  }
}

export async function createRawMaterialController(req, res, next) {
  try {
    return ok(res, await createRawMaterial(req.body?.name), 201)
  } catch (err) {
    return next(err)
  }
}

export async function updateRawMaterialController(req, res, next) {
  try {
    return ok(res, await updateRawMaterialBySlug(req.params.slug, req.body?.name))
  } catch (err) {
    return next(err)
  }
}

export async function deleteRawMaterialController(req, res, next) {
  try {
    await removeRawMaterialBySlug(req.params.slug)
    return ok(res, { deleted: true })
  } catch (err) {
    return next(err)
  }
}
