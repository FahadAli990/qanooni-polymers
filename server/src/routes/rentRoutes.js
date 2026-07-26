import { Router } from 'express'
import {
  createVehicleController,
  createRentPaymentController,
  deleteVehicleController,
  deleteRentPaymentController,
  getVehicleLedgerController,
  listVehiclesController,
  updateVehicleController,
  updateRentPaymentController,
} from '../controllers/rentController.js'
import { requireAuth, enforceRolePermissions } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth)
router.use(enforceRolePermissions)
router.get('/', listVehiclesController)
router.post('/', createVehicleController)
router.get('/:id/ledger', getVehicleLedgerController)
router.post('/:id/payments', createRentPaymentController)
router.put('/:id/payments/:paymentId', updateRentPaymentController)
router.delete('/:id/payments/:paymentId', deleteRentPaymentController)
router.put('/:id', updateVehicleController)
router.delete('/:id', deleteVehicleController)

export default router
