import { Router } from 'express'
import {
  createBuildingController,
  createRentPaymentController,
  deleteBuildingController,
  deleteRentPaymentController,
  getBuildingLedgerController,
  listBuildingsController,
  updateBuildingController,
  updateRentPaymentController,
} from '../controllers/rentController.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth)
router.get('/', listBuildingsController)
router.post('/', createBuildingController)
router.get('/:id/ledger', getBuildingLedgerController)
router.post('/:id/payments', createRentPaymentController)
router.put('/:id/payments/:paymentId', updateRentPaymentController)
router.delete('/:id/payments/:paymentId', deleteRentPaymentController)
router.put('/:id', updateBuildingController)
router.delete('/:id', deleteBuildingController)

export default router
