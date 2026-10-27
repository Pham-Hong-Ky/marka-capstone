import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/errors/index.js';
import ApiResponse from '../utils/ApiResponse.js';
import logger from '../utils/logger.js';
import env from '../config/env.js';

const PRISMA_ERRORS: Record<string, { statusCode: number; message: string }> = {
  P2002: { statusCode: 409, message: 'Dữ liệu đã tồn tại trong hệ thống' },
  P2025: { statusCode: 404, message: 'Không tìm thấy dữ liệu' },
};

type HttpStatusError = Error & { status?: number; statusCode?: number };

const getHttpStatus = (error: unknown): number | undefined => {
  if (!(error instanceof Error)) return undefined;
  const { status, statusCode } = error as HttpStatusError;
  return status ?? statusCode;
};

export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(err.message, { requestId: req.id, path: req.originalUrl, stack: err.stack });
    }
    return ApiResponse.error(res, { statusCode: err.statusCode, message: err.message, errors: err.errors });
  }

  if (err instanceof ZodError) {
    return ApiResponse.error(res, {
      statusCode: 422,
      message: 'Dữ liệu không hợp lệ',
      errors: err.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
    });
  }

  const prismaError = err instanceof Prisma.PrismaClientKnownRequestError ? PRISMA_ERRORS[err.code] : undefined;
  if (prismaError) {
    return ApiResponse.error(res, prismaError);
  }

  // Lỗi của body-parser (JSON hỏng, payload quá lớn) có status 4xx nhưng không
  // phải AppError; trả đúng mã để client sửa request thay vì nhận 500.
  const httpStatus = getHttpStatus(err);
  if (httpStatus && httpStatus >= 400 && httpStatus < 500) {
    return ApiResponse.error(res, {
      statusCode: httpStatus,
      message: httpStatus === 413 ? 'Dữ liệu gửi lên quá lớn' : 'Dữ liệu gửi lên không hợp lệ',
    });
  }

  const message = err instanceof Error ? err.message : 'Lỗi không xác định';
  const stack = err instanceof Error ? err.stack : undefined;
  logger.error(message, { requestId: req.id, stack, path: req.originalUrl });

  return ApiResponse.error(res, {
    statusCode: 500,
    message: 'Đã có lỗi hệ thống xảy ra',
    errors: env.NODE_ENV === 'development' ? { debug: message } : null,
  });
};

export default errorHandler;
