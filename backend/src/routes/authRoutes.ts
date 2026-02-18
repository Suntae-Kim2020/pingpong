import { Router } from 'express';
import { authController } from '../controllers/authController';

const router = Router();

// OAuth 로그인 URL 가져오기
router.get('/login/:provider', authController.getLoginUrl);

// OAuth 콜백 처리 (code를 token으로 교환)
router.post('/callback/:provider', authController.handleCallback);

// 현재 사용자 정보
router.get('/me', authController.getMe);

// 로그아웃
router.post('/logout', authController.logout);

export default router;
