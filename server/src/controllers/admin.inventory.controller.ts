import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as svc from '../services/admin.inventory.service';
import type {
  InventoryListQuery,
  TransactionsQuery,
  AdjustInput,
} from '../validators/admin.inventory.validator';

/** GET /api/admin/inventory — variant-centric stock list (search/filter/sort/paginate). */
export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.listInventory(req.query as unknown as InventoryListQuery);
  res.json(result);
});

/** GET /api/admin/inventory/stats — dashboard counts (in/low/out, units, value). */
export const stats = asyncHandler(async (_req: Request, res: Response) => {
  const result = await svc.inventoryStats();
  res.json(result);
});

/** GET /api/admin/inventory/transactions — the inventory ledger (newest first). */
export const transactions = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.listTransactions(req.query as unknown as TransactionsQuery);
  res.json(result);
});

/** POST /api/admin/inventory/adjust — manual stock movement (ADMIN only). */
export const adjust = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.adjustStock(req.body as AdjustInput, req.admin?.sub);
  res.status(201).json(result);
});
