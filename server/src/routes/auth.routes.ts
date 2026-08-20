import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { loginSchema } from '../validators/auth.validator';
import * as authController from '../controllers/auth.controller';

const router = Router();

/**
 * Stricter limiter on credential submission to blunt brute-force attempts.
 * Sits on top of the baseline `/api` limiter mounted in app.ts.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { message: 'Too many login attempts. Please try again later.', code: 'RATE_LIMITED' },
  },
});

router.post('/login', loginLimiter, validate({ body: loginSchema }), authController.login);
router.post('/logout', authController.logout);
router.get('/me', requireAuth, authController.me);

export default router;
