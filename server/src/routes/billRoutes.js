import { Router } from 'express'
import {
  createPaymentController,
  createPreviousBillController,
  deletePaymentController,
  deletePreviousBillController,
  getShopLedgerController,
  updatePaymentController,
  updatePreviousBillController,
} from '../controllers/billController.js'
import { requireAuth, enforceRolePermissions } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth)
router.use(enforceRolePermissions)
router.get('/shop', getShopLedgerController)
router.post('/payments', createPaymentController)
router.put('/payments/:id', updatePaymentController)
router.delete('/payments/:id', deletePaymentController)
router.post('/previous-bills', createPreviousBillController)
router.put('/previous-bills/:id', updatePreviousBillController)
router.delete('/previous-bills/:id', deletePreviousBillController)

export default router
