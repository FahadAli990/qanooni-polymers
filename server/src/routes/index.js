import { Router } from 'express'
import { healthController } from '../controllers/healthController.js'
import authRoutes from './authRoutes.js'
import rawMaterialRoutes from './rawMaterialRoutes.js'
import rollRoutes from './rollRoutes.js'

const router = Router()

router.get('/health', healthController)
router.use('/auth', authRoutes)
router.use('/raw-materials', rawMaterialRoutes)
router.use('/rolls', rollRoutes)

export default router
