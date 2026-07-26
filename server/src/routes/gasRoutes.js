import { Router } from 'express'
import {
  createGasPaymentController,
  createGasPurchaseController,
  createGasSupplierController,
  createUtilityBillController,
  deleteGasPaymentController,
  deleteGasPurchaseController,
  deleteGasSupplierController,
  deleteUtilityBillController,
  getGasSupplierLedgerController,
  listGasSuppliersController,
  listUtilityBillsController,
  updateGasPaymentController,
  updateGasPurchaseController,
  updateGasSupplierController,
  updateUtilityBillController,
} from '../controllers/gasController.js'
import { requireAuth, enforceRolePermissions } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth)
router.use(enforceRolePermissions)

router.get('/bills', listUtilityBillsController)
router.post('/bills', createUtilityBillController)
router.put('/bills/:id', updateUtilityBillController)
router.delete('/bills/:id', deleteUtilityBillController)

router.get('/suppliers', listGasSuppliersController)
router.post('/suppliers', createGasSupplierController)
router.get('/suppliers/:id/ledger', getGasSupplierLedgerController)
router.post('/suppliers/:id/purchases', createGasPurchaseController)
router.put('/suppliers/:id/purchases/:purchaseId', updateGasPurchaseController)
router.delete('/suppliers/:id/purchases/:purchaseId', deleteGasPurchaseController)
router.post('/suppliers/:id/payments', createGasPaymentController)
router.put('/suppliers/:id/payments/:paymentId', updateGasPaymentController)
router.delete('/suppliers/:id/payments/:paymentId', deleteGasPaymentController)
router.put('/suppliers/:id', updateGasSupplierController)
router.delete('/suppliers/:id', deleteGasSupplierController)

export default router
