import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../middleware/validate';
import { createTradeInSchema } from '../validators/tradein.validator';
import * as ctrl from '../controllers/tradein.controller';

const router = Router();

// Public write endpoint — throttle submissions per IP (spam guard), matching the
// spirit of the baseline API limiter but tighter for an unauthenticated POST.
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/', submitLimiter, validate({ body: createTradeInSchema }), ctrl.create);

export default router;
