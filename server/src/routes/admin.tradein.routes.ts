import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  adminTradeInQuerySchema,
  updateTradeInSchema,
  tradeInIdParamSchema,
} from '../validators/tradein.validator';
import * as ctrl from '../controllers/admin.tradein.controller';

const router = Router();

// Every route requires a valid admin session.
router.use(requireAuth);

router.get('/', validate({ query: adminTradeInQuerySchema }), ctrl.list);
router.get('/:id', validate({ params: tradeInIdParamSchema }), ctrl.getOne);
router.patch('/:id', validate({ params: tradeInIdParamSchema, body: updateTradeInSchema }), ctrl.update);

export default router;
