import { Request, Response, NextFunction } from 'express';
import { memberModel } from '../models/memberModel';
import { clubModel, membershipModel } from '../models/clubModel';
import { userModel } from '../models/userModel';
import { AppError } from '../middleware/errorHandler';
import pool from '../config/database';
import type { DBRow, ClubMemberRole } from '../types';

export const memberController = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      let clubId = req.query.club_id ? parseInt(req.query.club_id as string) : undefined;
      if (!clubId && req.auth?.userId) {
        clubId = await membershipModel.getUserPrimaryClubId(req.auth.userId) || undefined;
      }
      const members = clubId ? await memberModel.findAll(clubId) : [];
      res.json(members);
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const member = await memberModel.findById(id);
      if (!member) {
        throw new AppError('Member not found', 404);
      }
      res.json(member);
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      let clubId = req.body.club_id ? parseInt(req.body.club_id) : undefined;
      if (!clubId) {
        clubId = await membershipModel.getUserPrimaryClubId(req.auth!.userId) || undefined;
      }
      if (!clubId) {
        throw new AppError('클럽을 찾을 수 없습니다.', 400);
      }
      const member = await memberModel.create({
        club_id: clubId,
        name: req.body.name,
        profile_image: null,
        birth_year: req.body.birth_year,
        gender: req.body.gender,
        phone: req.body.phone || null,
        local_busu: req.body.local_busu || null,
        open_busu: req.body.open_busu || null,
        play_style: req.body.play_style || '올라운드',
        pimple_type: req.body.pimple_type || 'none',
        spouse_id: req.body.spouse_id || null,
        is_active: req.body.is_active !== false,
        role: req.body.role || 'member',
      });
      await clubModel.updateMemberCount(clubId);
      res.status(201).json(member);
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const userId = req.auth!.userId;

      // 대상 member의 클럽 확인
      const member = await memberModel.findById(id);
      if (!member) {
        throw new AppError('Member not found', 404);
      }

      // super_admin은 바이패스
      if (req.auth!.role !== 'super_admin') {
        // 본인의 연결된 member인지 확인
        const myMemberId = await membershipModel.getMemberIdByUserId(userId, member.club_id);
        if (myMemberId !== id) {
          // 클럽 leader/admin인지 확인
          const [rows] = await pool.query<DBRow[]>(
            `SELECT role FROM club_membership WHERE club_id = ? AND user_id = ? AND status = 'approved'`,
            [member.club_id, userId]
          );
          if (rows.length === 0) {
            throw new AppError('권한이 없습니다.', 403);
          }
          const clubRole = rows[0].role as ClubMemberRole;
          if (clubRole !== 'leader' && clubRole !== 'admin') {
            throw new AppError('권한이 없습니다.', 403);
          }
        }
      }

      await memberModel.update(id, req.body);
      if (req.body.is_active !== undefined) {
        await clubModel.updateMemberCount(member.club_id);
      }
      const updated = await memberModel.findById(id);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  },

  // 부부(배우자) 양방향 설정 — 본인 또는 클럽 leader/admin
  async setSpouse(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const userId = req.auth!.userId;
      const raw = req.body.spouse_id;
      const spouseId = raw === null || raw === undefined || raw === '' ? null : parseInt(raw);

      const member = await memberModel.findById(id);
      if (!member) {
        throw new AppError('Member not found', 404);
      }

      // 권한 확인 (update와 동일 규칙)
      if (req.auth!.role !== 'super_admin') {
        const myMemberId = await membershipModel.getMemberIdByUserId(userId, member.club_id);
        if (myMemberId !== id) {
          const [rows] = await pool.query<DBRow[]>(
            `SELECT role FROM club_membership WHERE club_id = ? AND user_id = ? AND status = 'approved'`,
            [member.club_id, userId]
          );
          const clubRole = rows[0]?.role as ClubMemberRole | undefined;
          if (clubRole !== 'leader' && clubRole !== 'admin') {
            throw new AppError('권한이 없습니다.', 403);
          }
        }
      }

      // 배우자 대상 검증 (같은 클럽)
      if (spouseId !== null) {
        if (spouseId === id) {
          throw new AppError('자기 자신을 배우자로 지정할 수 없습니다.', 400);
        }
        const spouse = await memberModel.findById(spouseId);
        if (!spouse || spouse.club_id !== member.club_id) {
          throw new AppError('같은 클럽의 회원만 배우자로 지정할 수 있습니다.', 400);
        }
      }

      await memberModel.setSpouse(id, spouseId);
      const updated = await memberModel.findById(id);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  },

  // 회원 사진 업로드 (클럽 leader/admin만)
  async uploadMemberPhoto(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const userId = req.auth!.userId;

      if (!req.file) {
        throw new AppError('파일이 없습니다.', 400);
      }

      const member = await memberModel.findById(id);
      if (!member) {
        throw new AppError('Member not found', 404);
      }

      // super_admin은 바이패스
      if (req.auth!.role !== 'super_admin') {
        const [rows] = await pool.query<DBRow[]>(
          `SELECT role FROM club_membership WHERE club_id = ? AND user_id = ? AND status = 'approved'`,
          [member.club_id, userId]
        );
        if (rows.length === 0) {
          throw new AppError('권한이 없습니다.', 403);
        }
        const clubRole = rows[0].role as ClubMemberRole;
        if (clubRole !== 'leader' && clubRole !== 'admin') {
          throw new AppError('권한이 없습니다.', 403);
        }
      }

      const imageUrl = `/api/uploads/${req.file.filename}`;
      await memberModel.update(id, { profile_image: imageUrl } as any);

      // 이 member에 연결된 user가 있으면 user.profile_image 및 그 user의 다른 member들도 동기화
      const [linkRows] = await pool.query<DBRow[]>(
        `SELECT user_id FROM club_membership WHERE member_id = ? AND status = 'approved' LIMIT 1`,
        [id]
      );
      const linkedUserId = linkRows[0]?.user_id as number | undefined;
      if (linkedUserId) {
        await userModel.update(linkedUserId, { profile_image: imageUrl });
        const memberships = await membershipModel.findByUserId(linkedUserId);
        for (const ms of memberships) {
          if (ms.member_id && ms.status === 'approved' && ms.member_id !== id) {
            await memberModel.update(ms.member_id, { profile_image: imageUrl } as any);
          }
        }
      }

      res.json({ profile_image: imageUrl });
    } catch (error) {
      next(error);
    }
  },
};
