import { Router } from 'express'
import { healthController } from '../controllers/healthController.js'
import authRoutes from './authRoutes.js'
import rawMaterialRoutes from './rawMaterialRoutes.js'
import productionRoutes from './productionRoutes.js'
import millRouteRoutes from './millRouteRoutes.js'
import orderRoutes from './orderRoutes.js'
import billRoutes from './billRoutes.js'
import supplierRoutes from './supplierRoutes.js'
import expenseRoutes from './expenseRoutes.js'
import maintenanceRoutes from './maintenanceRoutes.js'
import rentRoutes from './rentRoutes.js'
import workerRoutes from './workerRoutes.js'
import gasRoutes from './gasRoutes.js'
import managerRoutes from './managerRoutes.js'

const router = Router()

router.get('/health', healthController)
router.use('/auth', authRoutes)
router.use('/managers', managerRoutes)
router.use('/raw-materials', rawMaterialRoutes)
router.use('/productions', productionRoutes)
router.use('/routes', millRouteRoutes)
router.use('/orders', orderRoutes)
router.use('/bills', billRoutes)
router.use('/suppliers', supplierRoutes)
router.use('/expenses', expenseRoutes)
router.use('/maintenance', maintenanceRoutes)
router.use('/rents', rentRoutes)
router.use('/utility', gasRoutes)
router.use('/workers', workerRoutes)

export default router
