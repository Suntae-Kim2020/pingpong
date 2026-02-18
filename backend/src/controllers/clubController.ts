import { Request, Response, NextFunction } from 'express';
import { clubModel, regionModel, membershipModel } from '../models/clubModel';
import { AppError } from '../middleware/errorHandler';
import type { ClubJoinType } from '../types';

export const clubController = {
  // 클럽 검색
  async search(req: Request, res: Response, next: NextFunction) {
    try {
      const { keyword, regionId, limit, offset } = req.query;

      const clubs = await clubModel.search({
        keyword: keyword as string | undefined,
        regionId: regionId ? parseInt(regionId as string) : undefined,
        limit: limit ? parseInt(limit as string) : 20,
        offset: offset ? parseInt(offset as string) : 0,
      });

      res.json(clubs);
    } catch (error) {
      next(error);
    }
  },

  // 클럽 상세 조회
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const club = await clubModel.findById(parseInt(id));

      if (!club) {
        throw new AppError('Club not found', 404);
      }

      res.json(club);
    } catch (error) {
      next(error);
    }
  },

  // 동일/유사 이름 클럽 확인 (생성 전 경고용)
  async checkName(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, regionId } = req.query;

      if (!name || !regionId) {
        throw new AppError('Name and regionId are required', 400);
      }

      const exactMatches = await clubModel.findByNameInRegion(
        name as string,
        parseInt(regionId as string)
      );

      const similarClubs = await clubModel.findSimilarClubs(
        name as string,
        parseInt(regionId as string)
      );

      res.json({
        exactMatch: exactMatches.length > 0,
        exactMatches,
        similarClubs: similarClubs.filter(
          (c) => !exactMatches.find((e) => e.id === c.id)
        ),
      });
    } catch (error) {
      next(error);
    }
  },

  // 클럽 생성
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth!.userId;
      const { name, regionId, description, address, joinType, isPublic } = req.body;

      if (!name || !regionId) {
        throw new AppError('Name and regionId are required', 400);
      }

      // 지역 존재 확인
      const region = await regionModel.findById(regionId);
      if (!region) {
        throw new AppError('Invalid region', 400);
      }

      // 클럽 생성
      const club = await clubModel.create({
        name,
        regionId,
        description,
        address,
        leaderUserId: userId,
        joinType: joinType as ClubJoinType,
        isPublic,
      });

      // 생성자를 리더로 자동 가입
      await membershipModel.createAsLeader({
        clubId: club.id,
        userId,
      });

      // 회원 수 업데이트
      await clubModel.updateMemberCount(club.id);

      const fullClub = await clubModel.findById(club.id);
      res.status(201).json(fullClub);
    } catch (error) {
      next(error);
    }
  },

  // 클럽 정보 수정
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth!.userId;
      const { id } = req.params;
      const clubId = parseInt(id);

      const club = await clubModel.findById(clubId);
      if (!club) {
        throw new AppError('Club not found', 404);
      }

      // 리더만 수정 가능
      if (club.leader_user_id !== userId) {
        throw new AppError('Only the club leader can update', 403);
      }

      const updated = await clubModel.update(clubId, req.body);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  },

  // 클럽 가입 신청
  async join(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth!.userId;
      const { id } = req.params;
      const clubId = parseInt(id);
      const { displayName } = req.body;

      const club = await clubModel.findById(clubId);
      if (!club) {
        throw new AppError('Club not found', 404);
      }

      // 이미 가입 여부 확인
      const exists = await membershipModel.exists(clubId, userId);
      if (exists) {
        throw new AppError('Already a member or pending', 400);
      }

      const membership = await membershipModel.create({
        clubId,
        userId,
        displayName,
      });

      // open 타입이면 자동 승인
      if (club.join_type === 'open') {
        await membershipModel.updateStatus(membership.id, 'approved');
        await clubModel.updateMemberCount(clubId);
      }

      res.status(201).json({
        success: true,
        status: club.join_type === 'open' ? 'approved' : 'pending',
        message:
          club.join_type === 'open'
            ? '가입이 완료되었습니다.'
            : '가입 신청이 접수되었습니다. 승인을 기다려주세요.',
      });
    } catch (error) {
      next(error);
    }
  },

  // 내 클럽 목록
  async getMyClubs(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth!.userId;
      const memberships = await membershipModel.findByUserId(userId);
      res.json(memberships);
    } catch (error) {
      next(error);
    }
  },
};

export const regionController = {
  // 모든 지역 (트리 구조로 반환)
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const regions = await regionModel.findAll();
      res.json(regions);
    } catch (error) {
      next(error);
    }
  },

  // 특정 레벨 지역
  async getByLevel(req: Request, res: Response, next: NextFunction) {
    try {
      const { level } = req.params;
      const regions = await regionModel.findByLevel(level);
      res.json(regions);
    } catch (error) {
      next(error);
    }
  },

  // 하위 지역
  async getChildren(req: Request, res: Response, next: NextFunction) {
    try {
      const { parentId } = req.params;
      const regions = await regionModel.findChildren(parseInt(parentId));
      res.json(regions);
    } catch (error) {
      next(error);
    }
  },
};
