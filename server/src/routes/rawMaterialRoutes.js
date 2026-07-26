import { Router } from 'express'
import {
  createRawMaterialController,
  deleteRawMaterialController,
  getRawMaterialController,
  listRawMaterialsController,
  updateRawMaterialController,
} from '../controllers/rawMaterialController.js'
import {
  createStockController,
  deleteStockController,
  listStocksController,
  updateStockController,
} from '../controllers/stockController.js'
import { requireAuth, enforceRolePermissions } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth)
router.use(enforceRolePermissions)
router.get('/', listRawMaterialsController)
router.post('/', createRawMaterialController)
router.get('/:slug/stocks', listStocksController)
router.post('/:slug/stocks', createStockController)
router.put('/:slug/stocks/:stockId', updateStockController)
router.delete('/:slug/stocks/:stockId', deleteStockController)
router.get('/:slug', getRawMaterialController)
router.put('/:slug', updateRawMaterialController)
router.delete('/:slug', deleteRawMaterialController)

export default router
