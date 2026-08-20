import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as svc from '../services/report.service';

/** GET /api/admin/reports/summary — KPIs, breakdowns, daily revenue, top products. */
export const summary = asyncHandler(async (_req: Request, res: Response) => {
  const result = await svc.getReportSummary();
  res.json(result);
});
