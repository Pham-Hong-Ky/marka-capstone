import { Response } from 'express';

export interface SuccessResponseOptions<T = any> {
  statusCode?: number;
  message?: string;
  data?: T | null;
  meta?: any;
}

export interface ErrorResponseOptions {
  statusCode?: number;
  message?: string;
  errors?: any;
}

export class ApiResponse {
  static success<T = any>(
    res: Response,
    { statusCode = 200, message = 'Thành công', data = null, meta = null }: SuccessResponseOptions<T> = {}
  ) {
    const payload: Record<string, any> = { status: 'success', message };
    if (data !== null && data !== undefined) payload.data = data;
    if (meta) payload.meta = meta;
    return res.status(statusCode).json(payload);
  }

  static error(
    res: Response,
    { statusCode = 500, message = 'Đã có lỗi xảy ra', errors = null }: ErrorResponseOptions = {}
  ) {
    const payload: Record<string, any> = {
      status: `${statusCode}`.startsWith('4') ? 'fail' : 'error',
      message,
    };
    if (errors) payload.errors = errors;
    return res.status(statusCode).json(payload);
  }
}

export default ApiResponse;
