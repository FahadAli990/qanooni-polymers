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

// Shared production API: /api/productions/:kind  (roll | chaat | dewaar)
router.get('/:kind', listRollsController)
router.post('/:kind', createRollController)
router.put('/:kind/:id', updateRollController)
router.delete('/:kind/:id', deleteRollController)

export default router
