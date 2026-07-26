import { Router } from 'express'
import {
  createExpenseController,
  deleteExpenseController,
  listExpensesController,
  updateExpenseController,
} from '../controllers/expenseController.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth)
router.get('/', listExpensesController)
router.post('/', createExpenseController)
router.put('/:id', updateExpenseController)
router.delete('/:id', deleteExpenseController)

export default router
