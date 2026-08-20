import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as svc from '../services/admin.product.service';
import type {
  CreateProductInput,
  UpdateProductInput,
  VariantCreateInput,
  VariantUpdateInput,
  ImageInput,
  AdminProductQueryInput,
} from '../validators/admin.product.validator';

/** GET /api/admin/products — full catalog (all statuses), search + paginate. */
export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.listProductsAdmin(req.query as unknown as AdminProductQueryInput);
  res.json(result);
});

/** POST /api/admin/products — create product with images + variants + opening stock. */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const product = await svc.createProduct(req.body as CreateProductInput, req.admin?.sub);
  res.status(201).json({ product });
});

/** GET /api/admin/products/:id */
export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const product = await svc.getProductAdmin(id);
  res.json({ product });
});

/** PATCH /api/admin/products/:id */
export const update = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const product = await svc.updateProduct(id, req.body as UpdateProductInput, req.admin?.sub);
  res.json({ product });
});

/** DELETE /api/admin/products/:id (ADMIN only; refuses if the product has history). */
export const remove = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const result = await svc.deleteProduct(id, req.admin?.sub);
  res.json(result);
});

/** POST /api/admin/products/:id/variants */
export const addVariant = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const variant = await svc.addVariant(id, req.body as VariantCreateInput, req.admin?.sub);
  res.status(201).json({ variant });
});

/** PATCH /api/admin/variants/:id (non-stock fields only). */
export const updateVariant = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const variant = await svc.updateVariant(id, req.body as VariantUpdateInput, req.admin?.sub);
  res.json({ variant });
});

/** POST /api/admin/products/:id/images */
export const addImage = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const image = await svc.addImage(id, req.body as ImageInput, req.admin?.sub);
  res.status(201).json({ image });
});

/** DELETE /api/admin/images/:imageId */
export const removeImage = asyncHandler(async (req: Request, res: Response) => {
  const { imageId } = req.params as { imageId: string };
  const result = await svc.deleteImage(imageId, req.admin?.sub);
  res.json(result);
});
