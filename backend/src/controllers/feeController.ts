import { Request, Response, NextFunction } from 'express';
import { feeModel } from '../models/feeModel';
import { membershipModel } from '../models/clubModel';
import { AppError } from '../middleware/errorHandler';

export const feeController = {
  async getPolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const clubId = parseInt(req.params.clubId);
      const policy = await feeModel.getPolicy(clubId);
      res.json(policy);
    } catch (error) {
      next(error);
    }
  },

  async upsertPolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const clubId = parseInt(req.params.clubId);
      const { amount, bank_name, account_number, account_holder, kakao_pay_link, description, couple_discount_rate, officer_discount_rate } = req.body;

      if (amount === undefined || amount === null) {
        throw new AppError('amount is required', 400);
      }

      const policy = await feeModel.upsertPolicy(clubId, {
        amount,
        bank_name,
        account_number,
        account_holder,
        kakao_pay_link,
        description,
        couple_discount_rate,
        officer_discount_rate,
      });

      res.json(policy);
    } catch (error) {
      next(error);
    }
  },

  // 거래내역 양식 컬럼 매핑 조회 (양식 지문 기준, 동호회 공통)
  async getImportMapping(req: Request, res: Response, next: NextFunction) {
    try {
      const signature = req.query.signature as string | undefined;
      if (!signature) {
        res.json(null);
        return;
      }
      const mapping = await feeModel.getImportMapping(signature);
      res.json(mapping);
    } catch (error) {
      next(error);
    }
  },

  // 거래내역 양식 컬럼 매핑 저장/갱신
  async saveImportMapping(req: Request, res: Response, next: NextFunction) {
    try {
      const { signature, amount_header, name_header, date_header } = req.body;
      if (!signature || !amount_header || !name_header) {
        throw new AppError('signature, amount_header, name_header are required', 400);
      }
      await feeModel.saveImportMapping(signature, amount_header, name_header, date_header || null);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },

  async getRecords(req: Request, res: Response, next: NextFunction) {
    try {
      const clubId = parseInt(req.params.clubId);
      const year = parseInt(req.query.year as string);
      const month = parseInt(req.query.month as string);

      if (!year || !month) {
        throw new AppError('year and month are required', 400);
      }

      const records = await feeModel.getRecords(clubId, year, month);
      const stats = await feeModel.getStats(clubId, year, month);
      const allMembers = await feeModel.getAllMembers(clubId);

      res.json({ records, stats, allMembers });
    } catch (error) {
      next(error);
    }
  },

  async markPaid(req: Request, res: Response, next: NextFunction) {
    try {
      const clubId = parseInt(req.params.clubId);
      const { memberId, year, month, amount, memo } = req.body;

      if (!memberId || !year || !month || amount === undefined) {
        throw new AppError('memberId, year, month, and amount are required', 400);
      }

      let confirmedBy: number | null = null;
      if (req.auth) {
        confirmedBy = await membershipModel.getMemberIdByUserId(req.auth.userId, clubId);
      }

      const result = await feeModel.markPaid(clubId, memberId, year, month, amount, confirmedBy!, memo);
      res.status(201).json(result);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        return next(new AppError('이미 납부 처리된 회원입니다', 409));
      }
      next(error);
    }
  },

  async cancelPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const clubId = parseInt(req.params.clubId);
      const id = parseInt(req.params.id);

      const deleted = await feeModel.cancelPayment(id, clubId);
      if (!deleted) {
        throw new AppError('납부 기록을 찾을 수 없습니다', 404);
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },

  // =============================================
  // 각종회비 (Special Fee)
  // =============================================

  async getSpecialFees(req: Request, res: Response, next: NextFunction) {
    try {
      const clubId = parseInt(req.params.clubId);
      const fees = await feeModel.getSpecialFees(clubId);
      res.json(fees);
    } catch (error) {
      next(error);
    }
  },

  async createSpecialFee(req: Request, res: Response, next: NextFunction) {
    try {
      const clubId = parseInt(req.params.clubId);
      const { name, amount, description, due_date } = req.body;

      if (!name || amount === undefined) {
        throw new AppError('name and amount are required', 400);
      }

      const result = await feeModel.createSpecialFee(clubId, { name, amount, description, due_date });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },

  async updateSpecialFee(req: Request, res: Response, next: NextFunction) {
    try {
      const clubId = parseInt(req.params.clubId);
      const id = parseInt(req.params.id);
      const { name, amount, description, due_date, is_active } = req.body;

      const updated = await feeModel.updateSpecialFee(id, clubId, { name, amount, description, due_date, is_active });
      if (!updated) {
        throw new AppError('회비 항목을 찾을 수 없습니다', 404);
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },

  async deleteSpecialFee(req: Request, res: Response, next: NextFunction) {
    try {
      const clubId = parseInt(req.params.clubId);
      const id = parseInt(req.params.id);

      const deleted = await feeModel.deleteSpecialFee(id, clubId);
      if (!deleted) {
        throw new AppError('회비 항목을 찾을 수 없습니다', 404);
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },

  async getSpecialFeeRecords(req: Request, res: Response, next: NextFunction) {
    try {
      const clubId = parseInt(req.params.clubId);
      const specialFeeId = parseInt(req.params.id);

      const records = await feeModel.getSpecialFeeRecords(specialFeeId, clubId);
      const allMembers = await feeModel.getAllMembers(clubId);

      res.json({ records, allMembers });
    } catch (error) {
      next(error);
    }
  },

  async markSpecialFeePaid(req: Request, res: Response, next: NextFunction) {
    try {
      const clubId = parseInt(req.params.clubId);
      const specialFeeId = parseInt(req.params.id);
      const { memberId, amount, memo } = req.body;

      if (!memberId || amount === undefined) {
        throw new AppError('memberId and amount are required', 400);
      }

      let confirmedBy: number | null = null;
      if (req.auth) {
        confirmedBy = await membershipModel.getMemberIdByUserId(req.auth.userId, clubId);
      }

      const result = await feeModel.markSpecialFeePaid({
        special_fee_id: specialFeeId,
        club_id: clubId,
        member_id: memberId,
        amount,
        confirmed_by: confirmedBy,
        memo,
      });
      res.status(201).json(result);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        return next(new AppError('이미 납부 처리된 회원입니다', 409));
      }
      next(error);
    }
  },

  async cancelSpecialFeePayment(req: Request, res: Response, next: NextFunction) {
    try {
      const clubId = parseInt(req.params.clubId);
      const id = parseInt(req.params.id);

      const deleted = await feeModel.cancelSpecialFeePayment(id, clubId);
      if (!deleted) {
        throw new AppError('납부 기록을 찾을 수 없습니다', 404);
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },

  // =============================================
  // 수입/지출 (Finance Transaction)
  // =============================================

  async getTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const clubId = parseInt(req.params.clubId);
      const year = parseInt(req.query.year as string);
      const month = parseInt(req.query.month as string);

      if (!year || !month) {
        throw new AppError('year and month are required', 400);
      }

      // 이월금 자동 생성 (lazy safety net)
      await feeModel.ensureCarryover(clubId, year, month);

      const [transactions, summary] = await Promise.all([
        feeModel.getTransactions(clubId, year, month),
        feeModel.getTransactionSummary(clubId, year, month),
      ]);

      res.json({ transactions, summary });
    } catch (error) {
      next(error);
    }
  },

  async createTransaction(req: Request, res: Response, next: NextFunction) {
    try {
      const clubId = parseInt(req.params.clubId);
      const { type, category, amount, description, transaction_date } = req.body;

      if (!type || !category || amount === undefined || !transaction_date) {
        throw new AppError('type, category, amount, and transaction_date are required', 400);
      }

      let recordedBy: number | null = null;
      if (req.auth) {
        recordedBy = await membershipModel.getMemberIdByUserId(req.auth.userId, clubId);
      }

      const result = await feeModel.createTransaction(clubId, {
        type,
        category,
        amount,
        description,
        transaction_date,
        recorded_by: recordedBy,
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },

  async deleteTransaction(req: Request, res: Response, next: NextFunction) {
    try {
      const clubId = parseInt(req.params.clubId);
      const id = parseInt(req.params.id);

      const deleted = await feeModel.deleteTransaction(id, clubId);
      if (!deleted) {
        throw new AppError('거래 기록을 찾을 수 없습니다', 404);
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },
};
