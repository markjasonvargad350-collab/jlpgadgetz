import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as svc from '../services/admin.tradein.service';
import type { AdminTradeInQueryInput, UpdateTradeInInput } from '../validators/tradein.validator';

/** GET /api/admin/trade-ins — list requests (filter by status / search). */
export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.listTradeIns(req.query as unknown as AdminTradeInQueryInput);
  res.json(result);
});

/** GET /api/admin/trade-ins/:id */
export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const tradeIn = await svc.getTradeIn(id);
  res.json({ tradeIn });
});

/** PATCH /api/admin/trade-ins/:id — advance status and/or record staff valuation. */
export const update = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const tradeIn = await svc.updateTradeIn(id, req.body as UpdateTradeInInput, req.admin?.sub);
  res.json({ tradeIn });
});
