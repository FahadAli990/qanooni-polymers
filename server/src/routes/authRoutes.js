import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { loginController, meController } from '../controllers/authController.js'
import { requireAuth } from '../middleware/auth.js'

const LOGIN_WINDOW_MS = 15 * 60 * 1000
const LOGIN_MAX_ATTEMPTS = 30

const router = Router()

const loginLimiter = rateLimit({
  windowMs: LOGIN_WINDOW_MS,
  max: LOGIN_MAX_ATTEMPTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts. Try again later.' },
})

router.post('/login', loginLimiter, loginController)
router.get('/me', requireAuth, meController)

export default router
