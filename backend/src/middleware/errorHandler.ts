import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

export const errorHandler = (
  err: Error & { code?: string; sqlMessage?: string },
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error('Error:', err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message
    });
  }

  // MySQL 중복 키 오류 처리
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      error: '중복된 데이터가 존재합니다.'
    });
  }

  res.status(500).json({
    error: 'Internal server error'
  });
};
