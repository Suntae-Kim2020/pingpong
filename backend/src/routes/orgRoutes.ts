import { Router } from 'express';
import { orgController } from '../controllers/orgController';
import { clubAffiliationController } from '../controllers/clubAffiliationController';
import { memberRegistrationController } from '../controllers/memberRegistrationController';
import { orgFeeController } from '../controllers/orgFeeController';
import { requireAuth, requireOrgRole } from '../middleware/auth';

const router = Router();

// 조직 검색 — 공개
router.get('/search', orgController.search);

// 조직 이름 중복 확인 — 공개
router.get('/check-name', orgController.checkName);

// 내 조직 목록 — 인증 필수
router.get('/my', requireAuth, orgController.getMyOrgs);

// 조직 생성 — 인증 필수
router.post('/', requireAuth, orgController.create);

// 조직 상세 — 공개
router.get('/:id(\\d+)', orgController.getById);

// 조직 수정 — 인증 + 조직 리더 또는 관리자
router.patch('/:id(\\d+)', requireAuth, requireOrgRole('leader', 'admin'), orgController.update);

// 조직 가입 신청 — 인증 필수
router.post('/:id(\\d+)/join', requireAuth, orgController.join);

// 가입 신청 취소 — 인증 필수
router.delete('/:id(\\d+)/join', requireAuth, orgController.cancelJoin);

// 조직 탈퇴 — 인증 필수
router.delete('/:id(\\d+)/leave', requireAuth, orgController.leave);

// 조직 멤버 목록 — 인증 + 관리자
router.get('/:id(\\d+)/members', requireAuth, requireOrgRole('leader', 'admin'), orgController.getMembers);

// 멤버 상태 변경 — 인증 + 관리자
router.patch('/:id(\\d+)/members/:membershipId(\\d+)', requireAuth, requireOrgRole('leader', 'admin'), orgController.updateMemberStatus);

// 멤버 역할 변경 — 인증 + 관리자
router.patch('/:id(\\d+)/members/:membershipId(\\d+)/role', requireAuth, requireOrgRole('leader', 'admin'), orgController.updateMemberRole);

// 초대 링크 생성 — 인증 + 관리자
router.post('/:id(\\d+)/invites', requireAuth, requireOrgRole('leader', 'admin'), orgController.createInvite);

// 초대 링크 목록 — 인증 + 관리자
router.get('/:id(\\d+)/invites', requireAuth, requireOrgRole('leader', 'admin'), orgController.getInvites);

// 초대 링크 비활성화 — 인증 + 관리자
router.delete('/:id(\\d+)/invites/:inviteId(\\d+)', requireAuth, requireOrgRole('leader', 'admin'), orgController.deactivateInvite);

// 조직 공지 작성 — 인증 + 관리자
router.post('/:id(\\d+)/announcements', requireAuth, requireOrgRole('leader', 'admin'), orgController.createAnnouncement);

// 클럽 소속 신청 관리 — 인증 + 조직 리더/관리자
router.get('/:id(\\d+)/affiliation-requests', requireAuth, requireOrgRole('leader', 'admin'), clubAffiliationController.getRequests);
router.patch('/:id(\\d+)/affiliation-requests/:requestId(\\d+)', requireAuth, requireOrgRole('leader', 'admin'), clubAffiliationController.reviewRequest);

// 회원 등록 신청 관리 — 인증 + 조직 리더/관리자
router.get('/:id(\\d+)/member-registrations', requireAuth, requireOrgRole('leader', 'admin'), memberRegistrationController.getOrgRequests);
router.patch('/:id(\\d+)/member-registrations/:requestId(\\d+)', requireAuth, requireOrgRole('leader', 'admin'), memberRegistrationController.reviewRequest);

// =============================================
// 조직 회비/재무관리
// =============================================

// 회비 정책
router.get('/:id(\\d+)/fees/policy', requireAuth, requireOrgRole('leader', 'admin'), orgFeeController.getPolicy);
router.put('/:id(\\d+)/fees/policy', requireAuth, requireOrgRole('leader', 'admin'), orgFeeController.upsertPolicy);

// 각종회비 (special routes must come before /:feeId to avoid conflicts)
router.get('/:id(\\d+)/fees/special', requireAuth, requireOrgRole('leader', 'admin'), orgFeeController.getSpecialFees);
router.post('/:id(\\d+)/fees/special', requireAuth, requireOrgRole('leader', 'admin'), orgFeeController.createSpecialFee);
router.delete('/:id(\\d+)/fees/special/records/:recordId(\\d+)', requireAuth, requireOrgRole('leader', 'admin'), orgFeeController.cancelSpecialFeePayment);
router.put('/:id(\\d+)/fees/special/:sfId(\\d+)', requireAuth, requireOrgRole('leader', 'admin'), orgFeeController.updateSpecialFee);
router.delete('/:id(\\d+)/fees/special/:sfId(\\d+)', requireAuth, requireOrgRole('leader', 'admin'), orgFeeController.deleteSpecialFee);
router.get('/:id(\\d+)/fees/special/:sfId(\\d+)/records', requireAuth, requireOrgRole('leader', 'admin'), orgFeeController.getSpecialFeeRecords);
router.post('/:id(\\d+)/fees/special/:sfId(\\d+)/records', requireAuth, requireOrgRole('leader', 'admin'), orgFeeController.markSpecialFeePaid);

// 수입/지출
router.get('/:id(\\d+)/fees/transactions', requireAuth, requireOrgRole('leader', 'admin'), orgFeeController.getTransactions);
router.post('/:id(\\d+)/fees/transactions', requireAuth, requireOrgRole('leader', 'admin'), orgFeeController.createTransaction);
router.delete('/:id(\\d+)/fees/transactions/:txId(\\d+)', requireAuth, requireOrgRole('leader', 'admin'), orgFeeController.deleteTransaction);

// 월회비 납부 기록
router.get('/:id(\\d+)/fees', requireAuth, requireOrgRole('leader', 'admin'), orgFeeController.getRecords);
router.post('/:id(\\d+)/fees', requireAuth, requireOrgRole('leader', 'admin'), orgFeeController.markPaid);
router.delete('/:id(\\d+)/fees/:feeId(\\d+)', requireAuth, requireOrgRole('leader', 'admin'), orgFeeController.cancelPayment);

// 초대 링크 정보 조회 — 공개
router.get('/invite/:token', orgController.resolveInvite);

// 초대 링크로 가입 — 인증 필수
router.post('/invite/:token/join', requireAuth, orgController.joinViaInvite);

export default router;
