import { Request, Response, NextFunction } from 'express';
import { cumulativeMatchModel } from '../models/cumulativeMatchModel';
import { membershipModel } from '../models/clubModel';
import { AppError } from '../middleware/errorHandler';

export const cumulativeMatchController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { clubId, player1Id, player2Id, player1Score, player2Score, matchDate, memo } = req.body;
      if (!clubId || !player1Id || !player2Id || player1Score == null || player2Score == null || !matchDate) {
        throw new AppError('필수 항목이 누락되었습니다.', 400);
      }
      if (player1Id === player2Id) {
        throw new AppError('같은 선수끼리는 기록할 수 없습니다.', 400);
      }

      const userId = req.auth!.userId;
      const recorderMemberId = await membershipModel.getMemberIdByUserId(userId, clubId);
      if (!recorderMemberId) {
        throw new AppError('클럽 회원만 기록할 수 있습니다.', 403);
      }

      const matchId = await cumulativeMatchModel.create({
        clubId,
        recorderMemberId,
        player1Id,
        player2Id,
        player1Score,
        player2Score,
        matchDate,
        memo,
      });

      res.status(201).json({ success: true, matchId });
    } catch (error) { next(error); }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const matchId = parseInt(req.params.id);
      const clubId = parseInt(req.query.clubId as string);
      if (!clubId) throw new AppError('clubId is required', 400);

      const userId = req.auth!.userId;
      const recorderMemberId = await membershipModel.getMemberIdByUserId(userId, clubId);
      if (!recorderMemberId) {
        throw new AppError('클럽 회원만 삭제할 수 있습니다.', 403);
      }

      const deleted = await cumulativeMatchModel.delete(matchId, recorderMemberId);
      if (!deleted) {
        throw new AppError('본인이 기록한 경기만 삭제할 수 있습니다.', 403);
      }

      res.json({ success: true });
    } catch (error) { next(error); }
  },

  async getHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const clubId = parseInt(req.query.clubId as string);
      if (!clubId) throw new AppError('clubId is required', 400);

      const memberId = req.query.memberId ? parseInt(req.query.memberId as string) : undefined;
      const opponentId = req.query.opponentId ? parseInt(req.query.opponentId as string) : undefined;

      const matches = await cumulativeMatchModel.getHistory(clubId, { memberId, opponentId });
      res.json({ success: true, matches });
    } catch (error) { next(error); }
  },

  async getHeadToHead(req: Request, res: Response, next: NextFunction) {
    try {
      const clubId = parseInt(req.query.clubId as string);
      const player1Id = parseInt(req.query.player1Id as string);
      const player2Id = parseInt(req.query.player2Id as string);
      if (!clubId || !player1Id || !player2Id) {
        throw new AppError('clubId, player1Id, player2Id are required', 400);
      }

      const result = await cumulativeMatchModel.getHeadToHead(clubId, player1Id, player2Id);
      res.json({ success: true, ...result });
    } catch (error) { next(error); }
  },

  async getMemberStats(req: Request, res: Response, next: NextFunction) {
    try {
      const clubId = parseInt(req.query.clubId as string);
      const memberId = parseInt(req.query.memberId as string);
      if (!clubId || !memberId) {
        throw new AppError('clubId, memberId are required', 400);
      }

      const [stats, overall] = await Promise.all([
        cumulativeMatchModel.getMemberStats(clubId, memberId),
        cumulativeMatchModel.getMemberOverall(clubId, memberId),
      ]);

      res.json({ success: true, stats, overall });
    } catch (error) { next(error); }
  },
};
