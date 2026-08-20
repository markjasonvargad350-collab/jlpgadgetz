import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  adminOrderListQuerySchema,
  orderNumberParamSchema,
  updateOrderStatusSchema,
} from '../validators/admin.order.validator';
import * as ctrl from '../controllers/admin.order.controller';

const router = Router();

// Every route requires a valid admin session. Cancellation is further gated to
// ADMIN inside the controller (the rule depends on the requested target status).
router.use(requireAuth);

router.get('/', validate({ query: adminOrderListQuerySchema }), ctrl.list);
router.get('/:orderNumber', validate({ params: orderNumberParamSchema }), ctrl.getOne);
router.patch(
  '/:orderNumber/status',
  validate({ params: orderNumberParamSchema, body: updateOrderStatusSchema }),
  ctrl.updateStatus,
);

export default router;
