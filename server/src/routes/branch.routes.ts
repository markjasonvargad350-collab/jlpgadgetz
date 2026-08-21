import { Router } from 'express';
import * as ctrl from '../controllers/branch.controller';

const router = Router();

// Public, read-only. Active branches only (see branch.service.listActiveBranches).
router.get('/', ctrl.list);

export default router;
