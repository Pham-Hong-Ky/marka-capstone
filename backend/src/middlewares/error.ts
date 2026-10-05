import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/errors/index.js';
import logger from '../utils/logger.js';
import env from '../config/env.js';

export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      ...(err.errors ? { errors: err.errors } : {}),
    });
  }

  if (err instanceof ZodError) {
    return res.status(422).json({
      status: 'fail',
      message: 'Dữ liệu không hợp lệ',
      errors: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const isDuplicate = err.code === 'P2002';
    const isNotFound = err.code === 'P2025';
    return res.status(isNotFound ? 404 : 409).json({
      status: 'fail',
      message: isDuplicate ? 'Dữ liệu đã tồn tại trong hệ thống' : isNotFound ? 'Không tìm thấy dữ liệu' : 'Xung đột dữ liệu',
    });
  }

  const message = err instanceof Error ? err.message : 'Lỗi không xác định';
  const stack = err instanceof Error ? err.stack : undefined;
  logger.error(message, { requestId: req.id, stack, path: req.originalUrl });

  return res.status(500).json({
    status: 'error',
    message: 'Đã có lỗi hệ thống xảy ra',
    ...(env.NODE_ENV === 'development' ? { debug: message } : {}),
  });
};

export default errorHandler;
