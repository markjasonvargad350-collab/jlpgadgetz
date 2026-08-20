import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { orderNumberParamSchema } from '../validators/admin.order.validator';
import { updateShipmentSchema } from '../validators/admin.shipment.validator';
import * as ctrl from '../controllers/admin.shipment.controller';

const router = Router();

// Every route requires a valid admin session.
router.use(requireAuth);

// Editing shipment fields (courier / tracking code / ETA) is ADMIN-only, matching
// the destructive/financial gating philosophy (order cancellation, inventory adjust).
router.patch(
  '/:orderNumber',
  requireRole('ADMIN'),
  validate({ params: orderNumberParamSchema, body: updateShipmentSchema }),
  ctrl.update,
);

export default router;
