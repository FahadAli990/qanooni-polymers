import { Router } from 'express'
import {
  createRollController,
  deleteRollController,
  listRollsController,
  updateRollController,
} from '../controllers/rollController.js'
import { requireAuth, enforceRolePermissions } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth)
router.use(enforceRolePermissions)

// Shared production API: /api/productions/:kind  (roll | chaat | dewaar)
router.get('/:kind', listRollsController)
router.post('/:kind', createRollController)
router.put('/:kind/:id', updateRollController)
router.delete('/:kind/:id', deleteRollController)

export default router
