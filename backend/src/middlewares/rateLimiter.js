import rateLimit from 'express-rate-limit';

/**
 * Key generator prioritizing Workspace ID, then User ID, falling back to IP.
 * This prevents entire NAT/university WiFi networks from being rate-limited as one IP.
 */
export const getClientOrWorkspaceKey = (req) => {
  return req.workspaceId || req.user?.activeWorkspaceId || req.user?.id || req.ip;
};

/**
 * Global general API rate limiter (200 req / min per IP)
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: {
    status: 'fail',
    message: 'Quá nhiều yêu cầu gửi tới máy chủ. Vui lòng thử lại sau.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Stricter rate limiter for Auth endpoints (Login, Register, Forgot Password)
 * Prevents brute force attacks (15 req / 15 mins per IP)
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: {
    status: 'fail',
    message: 'Quá nhiều lần thử xác thực. Vui lòng đợi 15 phút trước khi thử lại.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Workspace-scoped rate limiter factory.
 * Limits traffic per workspace (or authenticated user/IP fallback).
 */
export const createWorkspaceLimiter = ({
  windowMs = 60 * 1000,
  max = 60,
  message = 'Workspace đã vượt quá giới hạn lượt gọi API.',
} = {}) => {
  return rateLimit({
    windowMs,
    max,
    keyGenerator: getClientOrWorkspaceKey,
    validate: { keyGeneratorIpFallback: false },
    message: {
      status: 'fail',
      message,
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

/**
 * Specialized Rate Limiter for AI Generation routes (20 req / min per workspace)
 */
export const aiLimiter = createWorkspaceLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Workspace đã đạt giới hạn yêu cầu tạo nội dung AI trong 1 phút. Vui lòng chờ giây lát.',
});

export default apiLimiter;
