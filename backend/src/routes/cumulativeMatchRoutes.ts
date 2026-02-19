import { Router } from 'express';
import { cumulativeMatchController } from '../controllers/cumulativeMatchController';
import { requireAuth } from '../middleware/auth';

const router = Router();

// 경기 기록 목록
router.get('/', requireAuth, cumulativeMatchController.getHistory);

// 두 선수 간 전적
router.get('/head-to-head', requireAuth, cumulativeMatchController.getHeadToHead);

// 상대별 통계 + 전체 합계
router.get('/stats', requireAuth, cumulativeMatchController.getMemberStats);

// 경기 기록 생성
router.post('/', requireAuth, cumulativeMatchController.create);

// 경기 기록 삭제
router.delete('/:id(\\d+)', requireAuth, cumulativeMatchController.delete);

export default router;
