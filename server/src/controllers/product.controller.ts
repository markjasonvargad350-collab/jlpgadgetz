import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as productService from '../services/product.service';
import type { ProductQuery } from '../services/product.service';

/** GET /api/products — search / filter / sort / paginate the ACTIVE catalog. */
export const list = asyncHandler(async (req: Request, res: Response) => {
  // req.query was validated + coerced by the `validate` middleware.
  const result = await productService.listProducts(req.query as unknown as ProductQuery);
  res.json(result);
});

/** GET /api/products/:idOrSlug — full product detail (images + active variants). */
export const detail = asyncHandler(async (req: Request, res: Response) => {
  const { idOrSlug } = req.params as { idOrSlug: string };
  const product = await productService.getProduct(idOrSlug);
  res.json({ product });
});
