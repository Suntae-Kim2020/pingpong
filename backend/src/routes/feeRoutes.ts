import { Router } from 'express';
import { feeController } from '../controllers/feeController';
import { requireAuth, requireClubRole } from '../middleware/auth';

const router = Router({ mergeParams: true });

// 회비 정책
router.get('/fees/policy', requireAuth, requireClubRole('leader', 'admin'), feeController.getPolicy);
router.put('/fees/policy', requireAuth, requireClubRole('leader', 'admin'), feeController.upsertPolicy);

// 거래내역 양식 컬럼 매핑 (학습/재사용)
router.get('/fees/import-mapping', requireAuth, requireClubRole('leader', 'admin'), feeController.getImportMapping);
router.put('/fees/import-mapping', requireAuth, requireClubRole('leader', 'admin'), feeController.saveImportMapping);

// 회비 납부 기록
router.get('/fees', requireAuth, requireClubRole('leader', 'admin'), feeController.getRecords);
router.post('/fees', requireAuth, requireClubRole('leader', 'admin'), feeController.markPaid);
router.delete('/fees/:id', requireAuth, requireClubRole('leader', 'admin'), feeController.cancelPayment);

// 각종회비
router.get('/fees/special', requireAuth, requireClubRole('leader', 'admin'), feeController.getSpecialFees);
router.post('/fees/special', requireAuth, requireClubRole('leader', 'admin'), feeController.createSpecialFee);
router.put('/fees/special/:id', requireAuth, requireClubRole('leader', 'admin'), feeController.updateSpecialFee);
router.delete('/fees/special/:id', requireAuth, requireClubRole('leader', 'admin'), feeController.deleteSpecialFee);
router.get('/fees/special/:id/records', requireAuth, requireClubRole('leader', 'admin'), feeController.getSpecialFeeRecords);
router.post('/fees/special/:id/records', requireAuth, requireClubRole('leader', 'admin'), feeController.markSpecialFeePaid);
router.delete('/fees/special/records/:id', requireAuth, requireClubRole('leader', 'admin'), feeController.cancelSpecialFeePayment);

// 수입/지출
router.get('/fees/transactions', requireAuth, requireClubRole('leader', 'admin'), feeController.getTransactions);
router.post('/fees/transactions', requireAuth, requireClubRole('leader', 'admin'), feeController.createTransaction);
router.delete('/fees/transactions/:id', requireAuth, requireClubRole('leader', 'admin'), feeController.deleteTransaction);

export default router;
