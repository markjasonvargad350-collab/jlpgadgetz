import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createBranchSchema,
  updateBranchSchema,
  adminBranchQuerySchema,
  branchIdParamSchema,
} from '../validators/admin.branch.validator';
import * as ctrl from '../controllers/admin.branch.controller';

const router = Router();

// Every route requires a valid admin session.
router.use(requireAuth);

router.get('/', validate({ query: adminBranchQuerySchema }), ctrl.list);
router.post('/', validate({ body: createBranchSchema }), ctrl.create);
router.get('/:id', validate({ params: branchIdParamSchema }), ctrl.getOne);
router.patch('/:id', validate({ params: branchIdParamSchema, body: updateBranchSchema }), ctrl.update);
// Hard delete is destructive + reference-guarded → restrict to ADMIN role.
router.delete('/:id', requireRole('ADMIN'), validate({ params: branchIdParamSchema }), ctrl.remove);

export default router;
