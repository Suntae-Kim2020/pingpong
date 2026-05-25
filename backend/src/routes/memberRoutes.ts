import { Router } from 'express';
import { memberController } from '../controllers/memberController';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { uploadAvatar } from '../middleware/upload';

const router = Router();

router.get('/', optionalAuth, memberController.getAll);
router.get('/:id', memberController.getById);
router.post('/', requireAuth, memberController.create);
router.put('/:id', requireAuth, memberController.update);
router.put('/:id/spouse', requireAuth, memberController.setSpouse);
router.post('/:id/photo', requireAuth, uploadAvatar, memberController.uploadMemberPhoto);

export default router;
