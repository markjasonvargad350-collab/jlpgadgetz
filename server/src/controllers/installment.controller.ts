import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { quoteInstallment, createInstallment } from '../services/installment.service';
import type {
  QuoteInstallmentQuery,
  CreateInstallmentBody,
} from '../validators/installment.validator';

/** GET /api/installments/quote — server-computed schedule preview (persists nothing). */
export const quote = asyncHandler(async (req: Request, res: Response) => {
  const result = await quoteInstallment(req.query as unknown as QuoteInstallmentQuery);
  res.json({ quote: result });
});

/** POST /api/installments — apply for an installment plan (guest). Returns the reference + schedule. */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const plan = await createInstallment(req.body as CreateInstallmentBody);
  res.status(201).json({ installment: plan });
});
