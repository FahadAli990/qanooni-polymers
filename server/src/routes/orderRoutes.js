import { Router } from 'express'
import {
  createOrderController,
  deleteOrderController,
  deliverOrderController,
  getOrderRatesController,
  listOrdersController,
  undeliverOrderController,
  updateOrderController,
} from '../controllers/orderController.js'
import { requireAuth, enforceRolePermissions } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth)
router.use(enforceRolePermissions)
router.get('/rates', getOrderRatesController)
router.get('/', listOrdersController)
router.post('/', createOrderController)
router.put('/:id', updateOrderController)
router.post('/:id/deliver', deliverOrderController)
router.post('/:id/pending', undeliverOrderController)
router.delete('/:id', deleteOrderController)

export default router
