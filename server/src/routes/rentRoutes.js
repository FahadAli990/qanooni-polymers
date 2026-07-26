import { Router } from 'express'
import {
  createVehicleController,
  createRentPaymentController,
  createTripController,
  deleteVehicleController,
  deleteRentPaymentController,
  deleteTripController,
  getVehicleLedgerController,
  listVehiclesController,
  updateVehicleController,
  updateRentPaymentController,
  updateTripController,
} from '../controllers/rentController.js'
import { requireAuth, enforceRolePermissions } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth)
router.use(enforceRolePermissions)
router.get('/', listVehiclesController)
router.post('/', createVehicleController)
router.get('/:id/ledger', getVehicleLedgerController)
router.post('/:id/trips', createTripController)
router.put('/:id/trips/:tripId', updateTripController)
router.delete('/:id/trips/:tripId', deleteTripController)
router.post('/:id/payments', createRentPaymentController)
router.put('/:id/payments/:paymentId', updateRentPaymentController)
router.delete('/:id/payments/:paymentId', deleteRentPaymentController)
router.put('/:id', updateVehicleController)
router.delete('/:id', deleteVehicleController)

export default router
