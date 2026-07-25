import { Router } from 'express'
import {
  createMillRouteController,
  deleteMillRouteController,
  getMillRouteController,
  listMillRoutesController,
  updateMillRouteController,
} from '../controllers/millRouteController.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth)
router.get('/', listMillRoutesController)
router.post('/', createMillRouteController)
router.get('/:slug', getMillRouteController)
router.put('/:slug', updateMillRouteController)
router.delete('/:slug', deleteMillRouteController)

export default router
