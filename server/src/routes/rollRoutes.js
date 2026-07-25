import { Router } from 'express'
import {
  createRollController,
  deleteRollController,
  listRollsController,
  updateRollController,
} from '../controllers/rollController.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth)
router.get('/', listRollsController)
router.post('/', createRollController)
router.put('/:id', updateRollController)
router.delete('/:id', deleteRollController)

export default router
