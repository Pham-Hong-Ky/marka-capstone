import { BadRequestError } from '../../../../utils/errors/index.js';

export class SocialTokenExpiredError extends BadRequestError {
  constructor(
    message = 'Phiên đăng nhập hoặc token đã hết hạn / bị thu hồi. Vui lòng kết nối lại.'
  ) {
    super(message);
    this.name = 'SocialTokenExpiredError';
  }
}

/** Lỗi tạm thời (mạng/timeout/5xx) — có thể thử lại an toàn. */
export class SocialTransientError extends BadRequestError {
  constructor(message = 'Không thể kết nối tới nền tảng. Vui lòng thử lại.') {
    super(message);
    this.name = 'SocialTransientError';
  }
}

/** Bài không còn trên nền tảng (đã bị xoá tay) — coi như đã gỡ. */
export class SocialPostGoneError extends BadRequestError {
  constructor(message = 'Bài viết không còn tồn tại trên nền tảng.') {
    super(message);
    this.name = 'SocialPostGoneError';
  }
}

export class SocialRateLimitError extends SocialTransientError {
  constructor(message = 'Nền tảng đang giới hạn tần suất. Hệ thống sẽ thử lại sau.') {
    super(message);
    this.name = 'SocialRateLimitError';
  }
}
