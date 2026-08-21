import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as svc from '../services/admin.branch.service';
import type {
  CreateBranchInput,
  UpdateBranchInput,
  AdminBranchQueryInput,
} from '../validators/admin.branch.validator';

/** GET /api/admin/branches — list branches (search + active filter). */
export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.listBranchesAdmin(req.query as unknown as AdminBranchQueryInput);
  res.json(result);
});

/** POST /api/admin/branches */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const branch = await svc.createBranch(req.body as CreateBranchInput, req.admin?.sub);
  res.status(201).json({ branch });
});

/** GET /api/admin/branches/:id */
export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const branch = await svc.getBranchAdmin(id);
  res.json({ branch });
});

/** PATCH /api/admin/branches/:id */
export const update = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const branch = await svc.updateBranch(id, req.body as UpdateBranchInput, req.admin?.sub);
  res.json({ branch });
});

/** DELETE /api/admin/branches/:id (ADMIN only; refuses if the branch is referenced). */
export const remove = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const result = await svc.deleteBranch(id, req.admin?.sub);
  res.json(result);
});
