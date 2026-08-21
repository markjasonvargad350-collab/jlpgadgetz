import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { createTradeIn } from '../services/tradein.service';
import type { CreateTradeInBody } from '../validators/tradein.validator';

/** POST /api/trade-ins — submit a trade-in request (guest). Returns the reference. */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const tradeIn = await createTradeIn(req.body as CreateTradeInBody);
  res.status(201).json({ tradeIn });
});
