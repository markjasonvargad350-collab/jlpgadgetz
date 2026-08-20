import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as ctrl from '../controllers/report.controller';

const router = Router();

// Reports are read-only analytics — any authenticated admin (ADMIN or STAFF) may view.
router.use(requireAuth);

router.get('/summary', ctrl.summary);

export default router;
