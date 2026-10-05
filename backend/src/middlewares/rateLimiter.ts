import { Request } from 'express';
import rateLimit from 'express-rate-limit';

export const getClientOrWorkspaceKey = (req: Request): string => {
  return req.workspaceId || req.user?.id || req.ip || 'unknown';
};

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

const extractLoginEmail = (req: Request): string => {
  const email = (req.body as { email?: unknown } | undefined)?.email;
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
};

// Chống brute-force đăng nhập: "sai quá 5 lần trong 15 phút cho cùng 1 IP/email" (UC02).
// Chỉ đếm các lần THẤT BẠI (skipSuccessfulRequests) nên đăng nhập đúng không bị tính vào hạn mức.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req: Request) => `${req.ip ?? 'unknown'}:${extractLoginEmail(req)}`,
  validate: { keyGeneratorIpFallback: false },
  message: {
    status: 'fail',
    message: 'Sai thông tin đăng nhập quá 5 lần. Vui lòng đợi 15 phút trước khi thử lại.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const createWorkspaceLimiter = ({
  windowMs = 60 * 1000,
  max = 60,
  message = 'Workspace đã vượt quá giới hạn lượt gọi API.',
}: { windowMs?: number; max?: number; message?: string } = {}) => {
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

export const aiLimiter = createWorkspaceLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Workspace đã đạt giới hạn yêu cầu tạo nội dung AI trong 1 phút. Vui lòng chờ giây lát.',
});

export default apiLimiter;
