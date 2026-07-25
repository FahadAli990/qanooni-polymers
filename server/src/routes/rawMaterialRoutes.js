import { Router } from 'express'
import {
  createRawMaterialController,
  deleteRawMaterialController,
  getRawMaterialController,
  listRawMaterialsController,
  updateRawMaterialController,
} from '../controllers/rawMaterialController.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth)
router.get('/', listRawMaterialsController)
router.post('/', createRawMaterialController)
router.get('/:slug', getRawMaterialController)
router.put('/:slug', updateRawMaterialController)
router.delete('/:slug', deleteRawMaterialController)

export default router
