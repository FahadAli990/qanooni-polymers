import { Router } from 'express'
import {
  createMaintenanceController,
  deleteMaintenanceController,
  listMaintenanceController,
  updateMaintenanceController,
} from '../controllers/maintenanceController.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth)
router.get('/', listMaintenanceController)
router.post('/', createMaintenanceController)
router.put('/:id', updateMaintenanceController)
router.delete('/:id', deleteMaintenanceController)

export default router
