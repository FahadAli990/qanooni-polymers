import { Router } from 'express'
import { healthController } from '../controllers/healthController.js'
import authRoutes from './authRoutes.js'
import rawMaterialRoutes from './rawMaterialRoutes.js'
import productionRoutes from './productionRoutes.js'
import millRouteRoutes from './millRouteRoutes.js'
import orderRoutes from './orderRoutes.js'
import billRoutes from './billRoutes.js'

const router = Router()

router.get('/health', healthController)
router.use('/auth', authRoutes)
router.use('/raw-materials', rawMaterialRoutes)
router.use('/productions', productionRoutes)
router.use('/routes', millRouteRoutes)
router.use('/orders', orderRoutes)
router.use('/bills', billRoutes)

export default router
