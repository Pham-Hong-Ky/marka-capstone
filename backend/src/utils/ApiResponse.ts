import { Response } from 'express';

export interface SuccessResponseOptions<T = unknown> {
  statusCode?: number;
  message?: string;
  data?: T | null;
  meta?: unknown;
}

export interface ErrorResponseOptions {
  statusCode?: number;
  message?: string;
  errors?: unknown;
}

export class ApiResponse {
  static success<T = unknown>(
    res: Response,
    { statusCode = 200, message = 'Thành công', data = null, meta = null }: SuccessResponseOptions<T> = {}
  ) {
    const payload: Record<string, unknown> = { status: 'success', message };
    if (data !== null && data !== undefined) payload.data = data;
    if (meta) payload.meta = meta;
    return res.status(statusCode).json(payload);
  }

  static error(
    res: Response,
    { statusCode = 500, message = 'Đã có lỗi xảy ra', errors = null }: ErrorResponseOptions = {}
  ) {
    const payload: Record<string, unknown> = {
      status: `${statusCode}`.startsWith('4') ? 'fail' : 'error',
      message,
    };
    if (errors) payload.errors = errors;
    return res.status(statusCode).json(payload);
  }
}

export default ApiResponse;
