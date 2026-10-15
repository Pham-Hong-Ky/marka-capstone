import { Router, Request, Response, NextFunction } from 'express';
import authController from '../modules/auth/auth.controller.js';
import userController from '../modules/user/user.controller.js';
import healthController from '../modules/health/health.controller.js';
import { validate } from '../middlewares/validate.js';
import { requireAuth, requireWorkspaceRole, optionalAuth } from '../middlewares/auth.js';
import uploadWorkspaceLogo, { uploadPostMedia } from '../middlewares/upload.js';
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
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  workspaceOnlySchema,
  inviteMemberSchema,
  memberActionSchema,
  changeMemberRoleSchema,
  inviteTokenSchema,
} from '../modules/workspace/workspace.validation.js';
import workspaceController from '../modules/workspace/workspace.controller.js';
import postController from '../modules/post/post.controller.js';
import {
  createPostSchema,
  postIdSchema,
  listPostsSchema,
  updatePostSchema,
  postMediaSchema,
  deletePostMediaSchema,
  reviewPostSchema,
} from '../modules/post/post.validation.js';
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

// Workspace (UC16–UC23, UC35, UC36)
router.post('/workspaces', requireAuth, validate(createWorkspaceSchema), workspaceController.createWorkspace);
router.get('/workspaces', requireAuth, workspaceController.listWorkspaces);

router.patch(
  '/workspaces/:workspaceId',
  requireAuth,
  validate(updateWorkspaceSchema),
  requireWorkspaceRole('OWNER'),
  workspaceController.updateWorkspace
);
router.delete(
  '/workspaces/:workspaceId',
  requireAuth,
  validate(workspaceOnlySchema),
  requireWorkspaceRole('OWNER'),
  workspaceController.deleteWorkspace
);
router.post(
  '/workspaces/:workspaceId/logo',
  requireAuth,
  validate(workspaceOnlySchema),
  requireWorkspaceRole('OWNER'),
  uploadWorkspaceLogo,
  workspaceController.uploadLogo
);

// Members (UC19, UC22, UC23, UC36)
router.get(
  '/workspaces/:workspaceId/members',
  requireAuth,
  validate(workspaceOnlySchema),
  requireWorkspaceRole(),
  workspaceController.listMembers
);
router.delete(
  '/workspaces/:workspaceId/members/me',
  requireAuth,
  validate(workspaceOnlySchema),
  requireWorkspaceRole(),
  workspaceController.leaveWorkspace
);
router.patch(
  '/workspaces/:workspaceId/members/:memberId',
  requireAuth,
  validate(changeMemberRoleSchema),
  requireWorkspaceRole('OWNER'),
  workspaceController.changeMemberRole
);
router.delete(
  '/workspaces/:workspaceId/members/:memberId',
  requireAuth,
  validate(memberActionSchema),
  requireWorkspaceRole('OWNER'),
  workspaceController.removeMember
);

// Invites (UC20, UC21)
router.post(
  '/workspaces/:workspaceId/invites',
  requireAuth,
  validate(inviteMemberSchema),
  requireWorkspaceRole('OWNER'),
  workspaceController.inviteMember
);
router.get('/invites/:token', optionalAuth, validate(inviteTokenSchema), workspaceController.acceptInvite);

// Posts (UC05, UC07, UC08, UC09, UC10, UC37)
router.post(
  '/workspaces/:workspaceId/posts',
  requireAuth,
  validate(createPostSchema),
  requireWorkspaceRole(),
  postController.createPost
);
router.get(
  '/workspaces/:workspaceId/posts',
  requireAuth,
  validate(listPostsSchema),
  requireWorkspaceRole(),
  postController.listPosts
);
router.get(
  '/workspaces/:workspaceId/posts/:postId',
  requireAuth,
  validate(postIdSchema),
  requireWorkspaceRole(),
  postController.getPost
);
router.patch(
  '/workspaces/:workspaceId/posts/:postId',
  requireAuth,
  validate(updatePostSchema),
  requireWorkspaceRole(),
  postController.updatePost
);
router.delete(
  '/workspaces/:workspaceId/posts/:postId',
  requireAuth,
  validate(postIdSchema),
  requireWorkspaceRole(),
  postController.deletePost
);
router.post(
  '/workspaces/:workspaceId/posts/:postId/media',
  requireAuth,
  validate(postMediaSchema),
  requireWorkspaceRole(),
  uploadPostMedia,
  postController.uploadPostMedia
);
router.delete(
  '/workspaces/:workspaceId/posts/:postId/media/:mediaId',
  requireAuth,
  validate(deletePostMediaSchema),
  requireWorkspaceRole(),
  postController.deletePostMedia
);

// Approval flow (UC11, UC14)
router.post(
  '/workspaces/:workspaceId/posts/:postId/submit',
  requireAuth,
  validate(postIdSchema),
  requireWorkspaceRole(),
  postController.submitPost
);
router.patch(
  '/workspaces/:workspaceId/posts/:postId/review',
  requireAuth,
  validate(reviewPostSchema),
  requireWorkspaceRole('OWNER'),
  postController.reviewPost
);

export default router;
