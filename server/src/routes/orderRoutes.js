import { Router } from 'express'
import {
  createOrderController,
  deleteOrderController,
  getOrderRatesController,
  listOrdersController,
} from '../controllers/orderController.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth)
router.get('/rates', getOrderRatesController)
router.get('/', listOrdersController)
router.post('/', createOrderController)
router.delete('/:id', deleteOrderController)

export default router
