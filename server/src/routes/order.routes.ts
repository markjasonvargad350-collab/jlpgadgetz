import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../middleware/validate';
import {
  createOrderSchema,
  orderParamsSchema,
  orderLookupQuerySchema,
} from '../validators/order.validator';
import * as orderController from '../controllers/order.controller';

const router = Router();

/**
 * Placing an order is a sensitive public write, so it gets a tighter limit than
 * the global API cap. Reads (lookup) fall under the global limiter only.
 */
const createOrderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many orders from this device. Please try again later.', code: 'RATE_LIMITED' } },
});

router.post('/', createOrderLimiter, validate({ body: createOrderSchema }), orderController.create);
router.get(
  '/:orderNumber',
  validate({ params: orderParamsSchema, query: orderLookupQuerySchema }),
  orderController.getByNumber,
);

export default router;
