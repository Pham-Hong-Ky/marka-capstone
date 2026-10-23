import { AppError } from '../../utils/errors/index.js';

export class AiProviderError extends Error {
  constructor(
    message: string,
    public readonly retryable = true
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}

export class AiContentPolicyError extends AiProviderError {
  constructor(message = 'Nội dung bị chặn bởi chính sách của nhà cung cấp AI') {
    super(message, false);
    this.name = 'AiContentPolicyError';
  }
}

export class AiOutputError extends AiProviderError {
  constructor(message = 'AI trả về dữ liệu không hợp lệ') {
    super(message, true);
    this.name = 'AiOutputError';
  }
}

export class AiProviderConfigError extends AiProviderError {
  constructor(message = 'Dịch vụ AI chưa được cấu hình') {
    super(message, false);
    this.name = 'AiProviderConfigError';
  }
}

export class AiPostNotEditableError extends AiProviderError {
  constructor(message = 'Bài viết không còn ở trạng thái có thể thêm ảnh') {
    super(message, false);
    this.name = 'AiPostNotEditableError';
  }
}

export class AiGenerationFinalizedError extends AppError {
  constructor() {
    super('Generation đã được xử lý xong bởi tiến trình khác', 409);
    this.name = 'AiGenerationFinalizedError';
  }
}

export default {
  AiProviderError,
  AiContentPolicyError,
  AiOutputError,
  AiProviderConfigError,
  AiPostNotEditableError,
  AiGenerationFinalizedError,
};
