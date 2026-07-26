import { Router } from 'express'
import {
  createSalaryPaymentController,
  createWorkerController,
  createWorkerLeaveController,
  deleteSalaryPaymentController,
  deleteWorkerController,
  deleteWorkerLeaveController,
  getWorkerController,
  getWorkerLedgerController,
  listWorkersController,
  updateSalaryPaymentController,
  updateWorkerController,
  updateWorkerLeaveController,
} from '../controllers/workerController.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth)
router.get('/', listWorkersController)
router.post('/', createWorkerController)
router.get('/:id/ledger', getWorkerLedgerController)
router.get('/:id', getWorkerController)
router.post('/:id/leaves', createWorkerLeaveController)
router.put('/:id/leaves/:leaveId', updateWorkerLeaveController)
router.delete('/:id/leaves/:leaveId', deleteWorkerLeaveController)
router.post('/:id/payments', createSalaryPaymentController)
router.put('/:id/payments/:paymentId', updateSalaryPaymentController)
router.delete('/:id/payments/:paymentId', deleteSalaryPaymentController)
router.put('/:id', updateWorkerController)
router.delete('/:id', deleteWorkerController)

export default router
