import { Router } from 'express'
import {
  createMillRouteController,
  deleteMillRouteController,
  getMillRouteController,
  listMillRoutesController,
  updateMillRouteController,
} from '../controllers/millRouteController.js'
import {
  createRouteCustomerController,
  deleteRouteCustomerController,
  listRouteCustomersController,
  updateRouteCustomerController,
} from '../controllers/routeCustomerController.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth)
router.get('/', listMillRoutesController)
router.post('/', createMillRouteController)

router.get('/:slug/customers', listRouteCustomersController)
router.post('/:slug/customers', createRouteCustomerController)
router.put('/:slug/customers/:customerId', updateRouteCustomerController)
router.delete('/:slug/customers/:customerId', deleteRouteCustomerController)

router.get('/:slug', getMillRouteController)
router.put('/:slug', updateMillRouteController)
router.delete('/:slug', deleteMillRouteController)

export default router
