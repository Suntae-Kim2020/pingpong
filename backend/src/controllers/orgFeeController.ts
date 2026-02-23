import { Request, Response, NextFunction } from 'express';
import { orgFeeModel } from '../models/orgFeeModel';
import { AppError } from '../middleware/errorHandler';

export const orgFeeController = {
  async getPolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = parseInt(req.params.id);
      const policy = await orgFeeModel.getPolicy(orgId);
      res.json(policy);
    } catch (error) {
      next(error);
    }
  },

  async upsertPolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = parseInt(req.params.id);
      const { amount, bank_name, account_number, account_holder, kakao_pay_link, description } = req.body;

      if (amount === undefined || amount === null) {
        throw new AppError('amount is required', 400);
      }

      const policy = await orgFeeModel.upsertPolicy(orgId, {
        amount,
        bank_name,
        account_number,
        account_holder,
        kakao_pay_link,
        description,
      });

      res.json(policy);
    } catch (error) {
      next(error);
    }
  },

  async getRecords(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = parseInt(req.params.id);
      const year = parseInt(req.query.year as string);
      const month = parseInt(req.query.month as string);

      if (!year || !month) {
        throw new AppError('year and month are required', 400);
      }

      const records = await orgFeeModel.getRecords(orgId, year, month);
      const stats = await orgFeeModel.getStats(orgId, year, month);
      const allMembers = await orgFeeModel.getAllMembers(orgId);

      res.json({ records, stats, allMembers });
    } catch (error) {
      next(error);
    }
  },

  async markPaid(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = parseInt(req.params.id);
      const { userId, year, month, amount, memo } = req.body;

      if (!userId || !year || !month || amount === undefined) {
        throw new AppError('userId, year, month, and amount are required', 400);
      }

      const confirmedBy = req.auth!.userId;

      const result = await orgFeeModel.markPaid(orgId, userId, year, month, amount, confirmedBy, memo);
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
      const orgId = parseInt(req.params.id);
      const feeId = parseInt(req.params.feeId);

      const deleted = await orgFeeModel.cancelPayment(feeId, orgId);
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
      const orgId = parseInt(req.params.id);
      const fees = await orgFeeModel.getSpecialFees(orgId);
      res.json(fees);
    } catch (error) {
      next(error);
    }
  },

  async createSpecialFee(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = parseInt(req.params.id);
      const { name, amount, description, due_date } = req.body;

      if (!name || amount === undefined) {
        throw new AppError('name and amount are required', 400);
      }

      const result = await orgFeeModel.createSpecialFee(orgId, { name, amount, description, due_date });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },

  async updateSpecialFee(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = parseInt(req.params.id);
      const sfId = parseInt(req.params.sfId);
      const { name, amount, description, due_date, is_active } = req.body;

      const updated = await orgFeeModel.updateSpecialFee(sfId, orgId, { name, amount, description, due_date, is_active });
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
      const orgId = parseInt(req.params.id);
      const sfId = parseInt(req.params.sfId);

      const deleted = await orgFeeModel.deleteSpecialFee(sfId, orgId);
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
      const orgId = parseInt(req.params.id);
      const sfId = parseInt(req.params.sfId);

      const records = await orgFeeModel.getSpecialFeeRecords(sfId, orgId);
      const allMembers = await orgFeeModel.getAllMembers(orgId);

      res.json({ records, allMembers });
    } catch (error) {
      next(error);
    }
  },

  async markSpecialFeePaid(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = parseInt(req.params.id);
      const sfId = parseInt(req.params.sfId);
      const { userId, amount, memo } = req.body;

      if (!userId || amount === undefined) {
        throw new AppError('userId and amount are required', 400);
      }

      const confirmedBy = req.auth!.userId;

      const result = await orgFeeModel.markSpecialFeePaid({
        special_fee_id: sfId,
        org_id: orgId,
        user_id: userId,
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
      const orgId = parseInt(req.params.id);
      const recordId = parseInt(req.params.recordId);

      const deleted = await orgFeeModel.cancelSpecialFeePayment(recordId, orgId);
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
      const orgId = parseInt(req.params.id);
      const year = parseInt(req.query.year as string);
      const month = parseInt(req.query.month as string);

      if (!year || !month) {
        throw new AppError('year and month are required', 400);
      }

      // 이월금 자동 생성 (lazy safety net)
      await orgFeeModel.ensureCarryover(orgId, year, month);

      const [transactions, summary] = await Promise.all([
        orgFeeModel.getTransactions(orgId, year, month),
        orgFeeModel.getTransactionSummary(orgId, year, month),
      ]);

      res.json({ transactions, summary });
    } catch (error) {
      next(error);
    }
  },

  async createTransaction(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = parseInt(req.params.id);
      const { type, category, amount, description, transaction_date } = req.body;

      if (!type || !category || amount === undefined || !transaction_date) {
        throw new AppError('type, category, amount, and transaction_date are required', 400);
      }

      const recordedBy = req.auth!.userId;

      const result = await orgFeeModel.createTransaction(orgId, {
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
      const orgId = parseInt(req.params.id);
      const txId = parseInt(req.params.txId);

      const deleted = await orgFeeModel.deleteTransaction(txId, orgId);
      if (!deleted) {
        throw new AppError('거래 기록을 찾을 수 없습니다', 404);
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },
};
