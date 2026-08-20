import { Router } from 'express';
import { validate } from '../middleware/validate';
import { productQuerySchema, productParamsSchema } from '../validators/product.validator';
import * as productController from '../controllers/product.controller';

const router = Router();

router.get('/', validate({ query: productQuerySchema }), productController.list);
router.get('/:idOrSlug', validate({ params: productParamsSchema }), productController.detail);

export default router;
