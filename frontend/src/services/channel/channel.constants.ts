export const FACEBOOK_ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Bạn đã từ chối cấp quyền cho Marka.',
  invalid_state: 'Phiên kết nối đã hết hạn. Vui lòng thử lại.',
  no_pages:
    'Tài khoản Facebook của bạn chưa có Page nào. Hãy tạo Page hoặc nhờ quản trị viên Page cấp quyền, rồi thử lại.',
  token_exchange_failed: 'Không thể xác thực với Facebook. Vui lòng thử lại.',
  not_configured: 'Hệ thống chưa cấu hình Facebook App.',
};

export const CHANNEL_STATUS_LABELS = {
  ACTIVE: 'Hoạt động',
  EXPIRED: 'Hết hạn',
} as const;
