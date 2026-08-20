import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createProductSchema,
  updateProductSchema,
  adminProductQuerySchema,
  variantCreateSchema,
  variantUpdateSchema,
  imageInputSchema,
  idParamSchema,
  imageIdParamSchema,
} from '../validators/admin.product.validator';
import * as ctrl from '../controllers/admin.product.controller';

const router = Router();

// Every route in this router requires a valid admin session.
router.use(requireAuth);

// Products
router.get('/products', validate({ query: adminProductQuerySchema }), ctrl.list);
router.post('/products', validate({ body: createProductSchema }), ctrl.create);
router.get('/products/:id', validate({ params: idParamSchema }), ctrl.getOne);
router.patch('/products/:id', validate({ params: idParamSchema, body: updateProductSchema }), ctrl.update);
// Hard delete is destructive and history-guarded → restrict to ADMIN role.
router.delete('/products/:id', requireRole('ADMIN'), validate({ params: idParamSchema }), ctrl.remove);

// Variants
router.post('/products/:id/variants', validate({ params: idParamSchema, body: variantCreateSchema }), ctrl.addVariant);
router.patch('/variants/:id', validate({ params: idParamSchema, body: variantUpdateSchema }), ctrl.updateVariant);

// Images
router.post('/products/:id/images', validate({ params: idParamSchema, body: imageInputSchema }), ctrl.addImage);
router.delete('/images/:imageId', validate({ params: imageIdParamSchema }), ctrl.removeImage);

export default router;
