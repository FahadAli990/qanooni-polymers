import { Router } from 'express'
import {
  createPaymentController,
  deletePaymentController,
  getShopLedgerController,
  updatePaymentController,
} from '../controllers/billController.js'
import { requireAuth, enforceRolePermissions } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth)
router.use(enforceRolePermissions)
router.get('/shop', getShopLedgerController)
router.post('/payments', createPaymentController)
router.put('/payments/:id', updatePaymentController)
router.delete('/payments/:id', deletePaymentController)

export default router
