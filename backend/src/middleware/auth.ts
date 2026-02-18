import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../controllers/authController';
import { AppError } from './errorHandler';
import pool from '../config/database';
import type { SystemRole, ClubMemberRole, AuthUser, DBRow } from '../types';

// req.auth 타입 확장
declare global {
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

// JWT 검증 후 req.auth 설정
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Unauthorized', 401));
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  if (!decoded) {
    return next(new AppError('Invalid token', 401));
  }

  // 구 토큰 호환: role 없으면 'user' 폴백
  req.auth = {
    userId: decoded.userId,
    role: decoded.role || 'user',
  };
  // 하위호환: (req as any).userId 유지
  (req as any).userId = decoded.userId;
  next();
}

// 토큰 있으면 파싱, 없어도 에러 없이 통과
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  if (decoded) {
    req.auth = {
      userId: decoded.userId,
      role: decoded.role || 'user',
    };
    (req as any).userId = decoded.userId;
  }
  next();
}

// 시스템 역할 확인. 예: requireRole('admin','super_admin')
export function requireRole(...roles: SystemRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      return next(new AppError('Unauthorized', 401));
    }
    if (!roles.includes(req.auth.role)) {
      return next(new AppError('Forbidden: insufficient role', 403));
    }
    next();
  };
}

// 클럽 내 역할 확인. super_admin은 바이패스.
// clubId는 req.params.id 또는 req.params.clubId에서 추출
export function requireClubRole(...roles: ClubMemberRole[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.auth) {
        return next(new AppError('Unauthorized', 401));
      }

      // super_admin은 모든 클럽 접근 가능
      if (req.auth.role === 'super_admin') {
        return next();
      }

      const clubId = parseInt(req.params.id || req.params.clubId);
      if (!clubId || isNaN(clubId)) {
        return next(new AppError('Club ID is required', 400));
      }

      const [rows] = await pool.query<DBRow[]>(
        `SELECT role FROM club_membership
         WHERE club_id = ? AND user_id = ? AND status = 'approved'`,
        [clubId, req.auth.userId]
      );

      if (rows.length === 0) {
        return next(new AppError('Forbidden: not a club member', 403));
      }

      const memberRole = rows[0].role as ClubMemberRole;
      if (!roles.includes(memberRole)) {
        return next(new AppError('Forbidden: insufficient club role', 403));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
