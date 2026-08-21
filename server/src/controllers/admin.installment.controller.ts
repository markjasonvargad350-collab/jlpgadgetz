import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as svc from '../services/admin.installment.service';
import type {
  AdminInstallmentQueryInput,
  UpdateInstallmentStatusInput,
  RecordPaymentInput,
} from '../validators/installment.validator';

/** GET /api/admin/installments — list plans (filter by status / search). */
export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.listInstallments(req.query as unknown as AdminInstallmentQueryInput);
  res.json(result);
});

/** GET /api/admin/installments/:id — full plan with its payment schedule. */
export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const installment = await svc.getInstallment(id);
  res.json({ installment });
});

/** PATCH /api/admin/installments/:id — advance the plan's status. */
export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const installment = await svc.updateInstallmentStatus(
    id,
    req.body as UpdateInstallmentStatusInput,
    req.admin?.sub,
  );
  res.json({ installment });
});

/** POST /api/admin/installments/:id/payments/:paymentId — record a payment (additive). */
export const recordPayment = asyncHandler(async (req: Request, res: Response) => {
  const { id, paymentId } = req.params as { id: string; paymentId: string };
  const installment = await svc.recordPayment(
    id,
    paymentId,
    req.body as RecordPaymentInput,
    req.admin?.sub,
  );
  res.json({ installment });
});
