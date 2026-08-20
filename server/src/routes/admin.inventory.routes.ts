import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  inventoryListQuerySchema,
  transactionsQuerySchema,
  adjustSchema,
} from '../validators/admin.inventory.validator';
import * as ctrl from '../controllers/admin.inventory.controller';

const router = Router();

// Every route in this router requires a valid admin session.
router.use(requireAuth);

router.get('/', validate({ query: inventoryListQuerySchema }), ctrl.list);
router.get('/stats', ctrl.stats);
router.get('/transactions', validate({ query: transactionsQuerySchema }), ctrl.transactions);

// Manual stock movements can zero out or overwrite inventory → restrict to ADMIN.
router.post('/adjust', requireRole('ADMIN'), validate({ body: adjustSchema }), ctrl.adjust);

export default router;
