import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../middleware/validate';
import {
  quoteInstallmentSchema,
  createInstallmentSchema,
} from '../validators/installment.validator';
import * as ctrl from '../controllers/installment.controller';

const router = Router();

// Public write endpoint — throttle applications per IP (matches trade-in's guard).
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

// Preview a schedule (read-only, server-computed). No rate limit beyond the app baseline.
router.get('/quote', validate({ query: quoteInstallmentSchema }), ctrl.quote);

router.post('/', submitLimiter, validate({ body: createInstallmentSchema }), ctrl.create);

export default router;
