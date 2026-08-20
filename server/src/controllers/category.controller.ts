import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as categoryService from '../services/category.service';

/** GET /api/categories — active categories with active-product counts. */
export const list = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await categoryService.listCategories();
  res.json({ categories });
});
