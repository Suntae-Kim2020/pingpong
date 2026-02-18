import { Router } from 'express';
import { memberController } from '../controllers/memberController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', memberController.getAll);
router.get('/:id', memberController.getById);
router.post('/', requireAuth, memberController.create);
router.put('/:id', requireAuth, memberController.update);

export default router;
