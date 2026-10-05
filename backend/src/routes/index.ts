import { Router, Request, Response, NextFunction } from 'express';
import authController from '../modules/auth/auth.controller.js';
import userController from '../modules/user/user.controller.js';
import healthController from '../modules/health/health.controller.js';
import { validate } from '../middlewares/validate.js';
import { requireAuth } from '../middlewares/auth.js';
import { authLimiter, loginLimiter } from '../middlewares/rateLimiter.js';
import {
  registerSchema,
  loginSchema,
  googleLoginSchema,
  logoutSchema,
  refreshTokenSchema,
} from '../modules/auth/auth.validation.js';
import {
  updateProfileSchema,
  changePasswordSchema,
} from '../modules/user/user.validation.js';
import env from '../config/env.js';

const router = Router();
const bypassRateLimit = (_req: Request, _res: Response, next: NextFunction) => next();
const rateLimitMiddleware = env.NODE_ENV === 'test' ? bypassRateLimit : authLimiter;
const loginRateLimitMiddleware = env.NODE_ENV === 'test' ? bypassRateLimit : loginLimiter;

// Health
router.get('/health', healthController.checkHealth);

// Auth (UC01, UC02, Google OAuth, UC03, UC33)
router.post('/auth/register', rateLimitMiddleware, validate(registerSchema), authController.register);
router.post('/auth/login', loginRateLimitMiddleware, validate(loginSchema), authController.login);
router.post('/auth/google', rateLimitMiddleware, validate(googleLoginSchema), authController.googleLogin);
router.post('/auth/logout', requireAuth, validate(logoutSchema), authController.logout);
router.post('/auth/refresh-token', validate(refreshTokenSchema), authController.refreshToken);

// User (UC04, UC32)
router.get('/users/me', requireAuth, userController.getMe);
router.patch('/users/me', requireAuth, validate(updateProfileSchema), userController.updateProfile);
router.patch('/users/me/password', requireAuth, validate(changePasswordSchema), userController.changePassword);

export default router;
