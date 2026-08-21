import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { listActiveBranches } from '../services/branch.service';

/** GET /api/branches — active branches for pickers + the About page. */
export const list = asyncHandler(async (_req: Request, res: Response) => {
  const branches = await listActiveBranches();
  res.json({ branches });
});
