import { Router } from 'express'
import {
  createManagerController,
  deleteManagerController,
  listManagersController,
  resetManagerPasswordController,
  setManagerActiveController,
} from '../controllers/managerController.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth)
router.use(requireAdmin)

router.get('/', listManagersController)
router.post('/', createManagerController)
router.put('/:id/password', resetManagerPasswordController)
router.put('/:id/active', setManagerActiveController)
router.delete('/:id', deleteManagerController)

export default router
