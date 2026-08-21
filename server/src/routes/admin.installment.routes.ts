import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  adminInstallmentQuerySchema,
  updateInstallmentStatusSchema,
  recordPaymentSchema,
  installmentIdParamSchema,
  installmentPaymentParamSchema,
} from '../validators/installment.validator';
import * as ctrl from '../controllers/admin.installment.controller';

const router = Router();

// Every route requires a valid admin session.
router.use(requireAuth);

router.get('/', validate({ query: adminInstallmentQuerySchema }), ctrl.list);
router.get('/:id', validate({ params: installmentIdParamSchema }), ctrl.getOne);
router.patch(
  '/:id',
  validate({ params: installmentIdParamSchema, body: updateInstallmentStatusSchema }),
  ctrl.updateStatus,
);
router.post(
  '/:id/payments/:paymentId',
  validate({ params: installmentPaymentParamSchema, body: recordPaymentSchema }),
  ctrl.recordPayment,
);

export default router;
