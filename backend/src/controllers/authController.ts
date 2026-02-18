import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { userModel } from '../models/userModel';
import { AppError } from '../middleware/errorHandler';
import type { SocialProvider, SystemRole } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'pingpong-platform-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

// OAuth 설정 (환경변수에서 로드)
const OAUTH_CONFIG = {
  kakao: {
    clientId: process.env.KAKAO_CLIENT_ID || '',
    clientSecret: process.env.KAKAO_CLIENT_SECRET || '',
    redirectUri: process.env.KAKAO_REDIRECT_URI || 'http://localhost:5173/auth/kakao/callback',
  },
  naver: {
    clientId: process.env.NAVER_CLIENT_ID || '',
    clientSecret: process.env.NAVER_CLIENT_SECRET || '',
    redirectUri: process.env.NAVER_REDIRECT_URI || 'http://localhost:5173/auth/naver/callback',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5173/auth/google/callback',
  },
};

// JWT 토큰 생성 (role 포함)
const generateToken = (userId: number, role: SystemRole): string => {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// JWT 토큰 검증 (구 토큰 호환: role 없을 수 있음)
export const verifyToken = (token: string): { userId: number; role?: SystemRole } | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: number; role?: SystemRole };
  } catch {
    return null;
  }
};

export const authController = {
  // OAuth 로그인 URL 생성
  async getLoginUrl(req: Request, res: Response, next: NextFunction) {
    try {
      const provider = req.params.provider as SocialProvider;

      let authUrl: string;

      switch (provider) {
        case 'kakao':
          authUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${OAUTH_CONFIG.kakao.clientId}&redirect_uri=${encodeURIComponent(OAUTH_CONFIG.kakao.redirectUri)}&response_type=code`;
          break;
        case 'naver':
          const state = Math.random().toString(36).substring(7);
          authUrl = `https://nid.naver.com/oauth2.0/authorize?client_id=${OAUTH_CONFIG.naver.clientId}&redirect_uri=${encodeURIComponent(OAUTH_CONFIG.naver.redirectUri)}&response_type=code&state=${state}`;
          break;
        case 'google':
          authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${OAUTH_CONFIG.google.clientId}&redirect_uri=${encodeURIComponent(OAUTH_CONFIG.google.redirectUri)}&response_type=code&scope=email%20profile`;
          break;
        default:
          throw new AppError('Invalid provider', 400);
      }

      res.json({ url: authUrl });
    } catch (error) {
      next(error);
    }
  },

  // OAuth 콜백 처리 (code -> token -> user info)
  async handleCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const provider = req.params.provider as SocialProvider;
      const { code } = req.body;

      if (!code) {
        throw new AppError('Authorization code is required', 400);
      }

      let userInfo: {
        provider_id: string;
        email?: string;
        name: string;
        nickname?: string;
        profile_image?: string;
      };

      switch (provider) {
        case 'kakao':
          userInfo = await getKakaoUserInfo(code);
          break;
        case 'naver':
          userInfo = await getNaverUserInfo(code, req.body.state);
          break;
        case 'google':
          userInfo = await getGoogleUserInfo(code);
          break;
        default:
          throw new AppError('Invalid provider', 400);
      }

      // 사용자 생성 또는 조회
      const { user, isNew } = await userModel.findOrCreate({
        provider,
        provider_id: userInfo.provider_id,
        email: userInfo.email,
        name: userInfo.name,
        nickname: userInfo.nickname,
        profile_image: userInfo.profile_image,
      });

      // JWT 토큰 생성 (role 포함)
      const token = generateToken(user.id, user.role || 'user');

      res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          nickname: user.nickname,
          email: user.email,
          profile_image: user.profile_image,
          provider: user.provider,
          role: user.role || 'user',
        },
        isNew,
      });
    } catch (error) {
      next(error);
    }
  },

  // 현재 로그인한 사용자 정보
  async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AppError('Unauthorized', 401);
      }

      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      if (!decoded) {
        throw new AppError('Invalid token', 401);
      }

      const user = await userModel.findById(decoded.userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      res.json({
        id: user.id,
        name: user.name,
        nickname: user.nickname,
        email: user.email,
        profile_image: user.profile_image,
        provider: user.provider,
        phone: user.phone,
        birth_year: user.birth_year,
        gender: user.gender,
        role: user.role || 'user',
      });
    } catch (error) {
      next(error);
    }
  },

  // 로그아웃 (클라이언트에서 토큰 삭제)
  async logout(req: Request, res: Response) {
    res.json({ success: true, message: 'Logged out successfully' });
  },
};

// =============================================
// OAuth Provider별 사용자 정보 가져오기
// =============================================

async function getKakaoUserInfo(code: string) {
  // 1. Access Token 발급
  const tokenResponse = await axios.post(
    'https://kauth.kakao.com/oauth/token',
    new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: OAUTH_CONFIG.kakao.clientId,
      client_secret: OAUTH_CONFIG.kakao.clientSecret,
      redirect_uri: OAUTH_CONFIG.kakao.redirectUri,
      code,
    }),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );

  const accessToken = tokenResponse.data.access_token;

  // 2. 사용자 정보 조회
  const userResponse = await axios.get('https://kapi.kakao.com/v2/user/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const kakaoUser = userResponse.data;
  const kakaoAccount = kakaoUser.kakao_account || {};
  const profile = kakaoAccount.profile || {};

  return {
    provider_id: String(kakaoUser.id),
    email: kakaoAccount.email,
    name: profile.nickname || kakaoAccount.name || '카카오 사용자',
    nickname: profile.nickname,
    profile_image: profile.profile_image_url,
  };
}

async function getNaverUserInfo(code: string, state?: string) {
  // 1. Access Token 발급
  const tokenResponse = await axios.post(
    'https://nid.naver.com/oauth2.0/token',
    new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: OAUTH_CONFIG.naver.clientId,
      client_secret: OAUTH_CONFIG.naver.clientSecret,
      code,
      state: state || '',
    }),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );

  const accessToken = tokenResponse.data.access_token;

  // 2. 사용자 정보 조회
  const userResponse = await axios.get('https://openapi.naver.com/v1/nid/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const naverUser = userResponse.data.response;

  return {
    provider_id: naverUser.id,
    email: naverUser.email,
    name: naverUser.name || naverUser.nickname || '네이버 사용자',
    nickname: naverUser.nickname,
    profile_image: naverUser.profile_image,
  };
}

async function getGoogleUserInfo(code: string) {
  // 1. Access Token 발급
  const tokenResponse = await axios.post(
    'https://oauth2.googleapis.com/token',
    {
      grant_type: 'authorization_code',
      client_id: OAUTH_CONFIG.google.clientId,
      client_secret: OAUTH_CONFIG.google.clientSecret,
      redirect_uri: OAUTH_CONFIG.google.redirectUri,
      code,
    },
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  const accessToken = tokenResponse.data.access_token;

  // 2. 사용자 정보 조회
  const userResponse = await axios.get(
    'https://www.googleapis.com/oauth2/v2/userinfo',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  const googleUser = userResponse.data;

  return {
    provider_id: googleUser.id,
    email: googleUser.email,
    name: googleUser.name || '구글 사용자',
    nickname: googleUser.given_name,
    profile_image: googleUser.picture,
  };
}
