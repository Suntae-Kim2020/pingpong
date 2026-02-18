import { Router } from 'express';
import { youtubeController } from '../controllers/youtubeController';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', youtubeController.getActive);                                                    // 공개: 활성 영상 목록 (메인 화면용)
router.get('/all', requireAuth, requireRole('admin', 'super_admin'), youtubeController.getAll);   // 관리자: 전체 영상 목록
router.post('/', requireAuth, requireRole('admin', 'super_admin'), youtubeController.create);     // 관리자: 영상 등록
router.put('/:id', requireAuth, requireRole('admin', 'super_admin'), youtubeController.update);   // 관리자: 영상 수정
router.delete('/:id', requireAuth, requireRole('admin', 'super_admin'), youtubeController.delete); // 관리자: 영상 삭제

export default router;
