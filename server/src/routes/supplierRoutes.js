import { Router } from 'express'
import {
  createSupplierController,
  createSupplierPaymentController,
  deleteSupplierController,
  deleteSupplierPaymentController,
  getSupplierLedgerController,
  listSuppliersController,
  updateSupplierController,
  updateSupplierPaymentController,
} from '../controllers/supplierController.js'
import { requireAuth, enforceRolePermissions } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth)
router.use(enforceRolePermissions)
router.get('/', listSuppliersController)
router.post('/', createSupplierController)
router.get('/:id/ledger', getSupplierLedgerController)
router.post('/:id/payments', createSupplierPaymentController)
router.put('/:id/payments/:paymentId', updateSupplierPaymentController)
router.delete('/:id/payments/:paymentId', deleteSupplierPaymentController)
router.put('/:id', updateSupplierController)
router.delete('/:id', deleteSupplierController)

export default router
