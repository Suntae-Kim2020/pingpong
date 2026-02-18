import { Router } from 'express';
import { clubController, regionController } from '../controllers/clubController';
import { requireAuth, requireClubRole } from '../middleware/auth';

const router = Router();

// 클럽 검색 (이름/지역) — 공개
router.get('/search', clubController.search);

// 클럽 이름 중복 확인 — 공개
router.get('/check-name', clubController.checkName);

// 내 클럽 목록 — 인증 필수
router.get('/my', requireAuth, clubController.getMyClubs);

// 클럽 생성 — 인증 필수
router.post('/', requireAuth, clubController.create);

// 클럽 상세 (숫자 ID만 매칭) — 공개
router.get('/:id(\\d+)', clubController.getById);

// 클럽 수정 — 인증 + 클럽 리더만
router.patch('/:id(\\d+)', requireAuth, requireClubRole('leader'), clubController.update);

// 클럽 가입 신청 — 인증 필수
router.post('/:id(\\d+)/join', requireAuth, clubController.join);

export default router;

// 지역 라우터 (별도 export)
export const regionRouter = Router();

regionRouter.get('/', regionController.getAll);
regionRouter.get('/level/:level', regionController.getByLevel);
regionRouter.get('/:parentId/children', regionController.getChildren);
