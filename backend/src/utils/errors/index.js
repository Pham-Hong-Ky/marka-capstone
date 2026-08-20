export class AppError extends Error {
  constructor(message, statusCode = 500, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.errors = errors;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Tài nguyên không tồn tại') {
    super(message, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Yêu cầu xác thực không hợp lệ') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Bạn không có quyền thực hiện hành động này') {
    super(message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Xung đột dữ liệu') {
    super(message, 409);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Dữ liệu không hợp lệ', errors = null) {
    super(message, 422, errors);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Yêu cầu không hợp lệ') {
    super(message, 400);
  }
}

export default {
  AppError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  ValidationError,
  BadRequestError,
};
