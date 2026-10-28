import { Router } from 'express';
import authController from '../modules/auth/auth.controller.js';
import userController from '../modules/user/user.controller.js';
import healthController from '../modules/health/health.controller.js';
import { validate } from '../middlewares/validate.js';
import { requireAuth, requireWorkspaceRole, requireRoles, optionalAuth } from '../middlewares/auth.js';
import { uploadPostMedia, uploadAvatar } from '../middlewares/upload.js';
import { authLimiter, loginLimiter, aiLimiter } from '../middlewares/rateLimiter.js';
import {
  registerSchema,
  loginSchema,
  googleLoginSchema,
  refreshTokenSchema,
} from '../modules/auth/auth.validation.js';
import {
  updateProfileSchema,
  changePasswordSchema,
  deleteAccountSchema,
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
import { brandVoiceSchema } from '../modules/brandvoice/brandvoice.validation.js';
import brandVoiceController from '../modules/brandvoice/brandvoice.controller.js';
import {
  listChannelsSchema,
  oauthUrlSchema,
  oauthCallbackSchema,
  oauthSessionSchema,
  connectAccountsSchema,
  channelIdSchema,
  channelProfileSchema,
  updateChannelLabelSchema,
} from '../modules/channel/channel.validation.js';
import channelController from '../modules/channel/channel.controller.js';
import postController from '../modules/post/post.controller.js';
import {
  createPostSchema,
  postIdSchema,
  listPostsSchema,
  updatePostSchema,
  postMediaSchema,
  deletePostMediaSchema,
  reviewPostSchema,
  assignPostSchema,
  updateTaskStatusSchema,
} from '../modules/post/post.validation.js';
import scheduleController from '../modules/schedule/schedule.controller.js';
import {
  createScheduleSchema,
  listSchedulesSchema,
  scheduleIdSchema,
} from '../modules/schedule/schedule.validation.js';
import aiController from '../modules/ai/ai.controller.js';
import {
  generateTextSchema,
  generateImageSchema,
  generationIdSchema,
} from '../modules/ai/ai.validation.js';
import analyticsController from '../modules/analytics/analytics.controller.js';
import {
  analyticsOverviewSchema,
  analyticsSuggestionsSchema,
  analyticsSyncSchema,
} from '../modules/analytics/analytics.validation.js';
import billingController from '../modules/billing/billing.controller.js';
import {
  billingSchema,
  listTransactionsSchema,
  createOrderSchema,
  orderIdSchema,
} from '../modules/billing/billing.validation.js';
import notificationController from '../modules/notification/notification.controller.js';
import {
  listNotificationsSchema,
  notificationIdSchema,
  unreadCountSchema,
  markAllReadSchema,
} from '../modules/notification/notification.validation.js';
import adminController from '../modules/admin/admin.controller.js';
import {
  listUsersSchema,
  suspendUserSchema,
  listWorkspacesSchema,
} from '../modules/admin/admin.validation.js';
import auditController from '../modules/audit/audit.controller.js';
import {
  adminAuditLogsSchema,
  workspaceAuditLogsSchema,
} from '../modules/audit/audit.validation.js';

const router = Router();

// Health
router.get('/health', healthController.checkHealth);

// Auth (UC01, UC02, Google OAuth, UC03, UC33)
router.post('/auth/register', authLimiter, validate(registerSchema), authController.register);
router.post('/auth/login', loginLimiter, validate(loginSchema), authController.login);
router.post('/auth/google', authLimiter, validate(googleLoginSchema), authController.googleLogin);
router.post('/auth/logout', requireAuth, authController.logout);
router.post('/auth/refresh-token', validate(refreshTokenSchema), authController.refreshToken);

// User (UC04, UC32)
router.get('/users/me', requireAuth, userController.getMe);
router.patch('/users/me', requireAuth, validate(updateProfileSchema), userController.updateProfile);
router.post('/users/me/avatar', requireAuth, uploadAvatar, userController.uploadAvatar);
router.post('/users/me/logout-all', requireAuth, userController.logoutAll);
router.delete('/users/me', requireAuth, validate(deleteAccountSchema), userController.deleteAccount);
router.patch('/users/me/password', requireAuth, validate(changePasswordSchema), userController.changePassword);

// Notifications — hộp thư trong ứng dụng
router.get(
  '/users/me/notifications',
  requireAuth,
  validate(listNotificationsSchema),
  notificationController.listNotifications
);
router.get(
  '/users/me/notifications/unread-count',
  requireAuth,
  validate(unreadCountSchema),
  notificationController.getUnreadCount
);
router.patch(
  '/users/me/notifications/read-all',
  requireAuth,
  validate(markAllReadSchema),
  notificationController.markAllNotificationsRead
);
router.patch(
  '/users/me/notifications/:notificationId/read',
  requireAuth,
  validate(notificationIdSchema),
  notificationController.markNotificationRead
);

// Admin — quản trị hệ thống & audit log (UC32)
router.get('/admin/stats', requireAuth, requireRoles('SYSTEM_ADMIN'), adminController.getStats);
router.get(
  '/admin/users',
  requireAuth,
  requireRoles('SYSTEM_ADMIN'),
  validate(listUsersSchema),
  adminController.listUsers
);
router.patch(
  '/admin/users/:userId/suspend',
  requireAuth,
  requireRoles('SYSTEM_ADMIN'),
  validate(suspendUserSchema),
  adminController.suspendUser
);
router.get(
  '/admin/workspaces',
  requireAuth,
  requireRoles('SYSTEM_ADMIN'),
  validate(listWorkspacesSchema),
  adminController.listWorkspaces
);
router.get(
  '/admin/audit-logs',
  requireAuth,
  requireRoles('SYSTEM_ADMIN'),
  validate(adminAuditLogsSchema),
  auditController.listAdminAuditLogs
);
router.get(
  '/workspaces/:workspaceId/audit-logs',
  requireAuth,
  validate(workspaceAuditLogsSchema),
  requireWorkspaceRole('OWNER'),
  auditController.listWorkspaceAuditLogs
);

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

// Brand Voice (UC24, UC25, UC26)
router.get(
  '/workspaces/:workspaceId/brand-voice',
  requireAuth,
  validate(workspaceOnlySchema),
  requireWorkspaceRole(),
  brandVoiceController.getBrandVoice
);
router.put(
  '/workspaces/:workspaceId/brand-voice',
  requireAuth,
  validate(brandVoiceSchema),
  requireWorkspaceRole('OWNER'),
  brandVoiceController.updateBrandVoice
);

// Channels (UC27, UC28, UC29)
router.get(
  '/workspaces/:workspaceId/channels',
  requireAuth,
  validate(listChannelsSchema),
  requireWorkspaceRole(),
  channelController.listChannels
);
router.get(
  '/channels/:platform/oauth/url',
  requireAuth,
  validate(oauthUrlSchema),
  requireWorkspaceRole('OWNER'),
  channelController.getOauthUrl
);
router.get(
  '/channels/:platform/oauth/callback',
  validate(oauthCallbackSchema),
  channelController.oauthCallback
);
router.get(
  '/channels/:platform/oauth/session/:sessionId',
  requireAuth,
  validate(oauthSessionSchema),
  requireWorkspaceRole('OWNER'),
  channelController.getPendingAccounts
);
router.post(
  '/channels/:platform/oauth/session/:sessionId/connect',
  requireAuth,
  validate(connectAccountsSchema),
  requireWorkspaceRole('OWNER'),
  channelController.connectAccounts
);
router.delete(
  '/channels/:channelId',
  requireAuth,
  validate(channelIdSchema),
  requireWorkspaceRole('OWNER'),
  channelController.disconnectChannel
);

// Hồ sơ kênh — xem chi tiết, đổi tên nội bộ, làm mới từ Facebook
router.get(
  '/workspaces/:workspaceId/channels/:channelId',
  requireAuth,
  validate(channelProfileSchema),
  requireWorkspaceRole(),
  channelController.getChannelDetail
);
router.patch(
  '/workspaces/:workspaceId/channels/:channelId',
  requireAuth,
  validate(updateChannelLabelSchema),
  requireWorkspaceRole(),
  channelController.updateChannelLabel
);
router.post(
  '/workspaces/:workspaceId/channels/:channelId/refresh',
  requireAuth,
  validate(channelProfileSchema),
  requireWorkspaceRole(),
  channelController.refreshChannel
);

// Billing — gói credit & PayOS (UC31, UC40, UC41)
router.get(
  '/workspaces/:workspaceId/billing',
  requireAuth,
  validate(billingSchema),
  requireWorkspaceRole(),
  billingController.getBilling
);
router.get(
  '/workspaces/:workspaceId/billing/transactions',
  requireAuth,
  validate(listTransactionsSchema),
  requireWorkspaceRole(),
  billingController.listTransactions
);
router.post(
  '/workspaces/:workspaceId/billing/orders',
  requireAuth,
  validate(createOrderSchema),
  requireWorkspaceRole(),
  billingController.createOrder
);
router.get(
  '/workspaces/:workspaceId/billing/orders/:orderId',
  requireAuth,
  validate(orderIdSchema),
  requireWorkspaceRole(),
  billingController.getOrder
);
router.post(
  '/workspaces/:workspaceId/billing/orders/:orderId/cancel',
  requireAuth,
  validate(orderIdSchema),
  requireWorkspaceRole(),
  billingController.cancelOrder
);

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

// Giao việc & trạng thái công việc (UC42, UC43)
router.patch(
  '/workspaces/:workspaceId/posts/:postId/assign',
  requireAuth,
  validate(assignPostSchema),
  requireWorkspaceRole('OWNER'),
  postController.assignPost
);
router.patch(
  '/workspaces/:workspaceId/posts/:postId/task-status',
  requireAuth,
  validate(updateTaskStatusSchema),
  requireWorkspaceRole(),
  postController.updateTaskStatus
);

// AI assistant (UC07 — sinh nội dung & ảnh cho bài viết)
router.post(
  '/workspaces/:workspaceId/ai/text',
  requireAuth,
  validate(generateTextSchema),
  requireWorkspaceRole(),
  aiLimiter,
  aiController.generateText
);
router.post(
  '/workspaces/:workspaceId/ai/images',
  requireAuth,
  validate(generateImageSchema),
  requireWorkspaceRole(),
  aiLimiter,
  aiController.generateImage
);
router.get(
  '/workspaces/:workspaceId/ai/generations/:generationId',
  requireAuth,
  validate(generationIdSchema),
  requireWorkspaceRole(),
  aiController.getGeneration
);

// Schedule — đăng ngay / lên lịch lên Facebook Page (UC13, UC14, UC16, UC37)
router.post(
  '/workspaces/:workspaceId/posts/:postId/schedules',
  requireAuth,
  validate(createScheduleSchema),
  requireWorkspaceRole(),
  scheduleController.createSchedules
);
router.get(
  '/workspaces/:workspaceId/schedules',
  requireAuth,
  validate(listSchedulesSchema),
  requireWorkspaceRole(),
  scheduleController.listSchedules
);
router.delete(
  '/workspaces/:workspaceId/schedules/:scheduleId',
  requireAuth,
  validate(scheduleIdSchema),
  requireWorkspaceRole(),
  scheduleController.cancelSchedule
);

// Analytics — thống kê hiệu quả bài đăng & gợi ý (Phân hệ 8)
router.get(
  '/workspaces/:workspaceId/analytics/overview',
  requireAuth,
  validate(analyticsOverviewSchema),
  requireWorkspaceRole(),
  analyticsController.getOverview
);
router.get(
  '/workspaces/:workspaceId/analytics/suggestions',
  requireAuth,
  validate(analyticsSuggestionsSchema),
  requireWorkspaceRole(),
  analyticsController.getSuggestions
);
router.post(
  '/workspaces/:workspaceId/analytics/sync',
  requireAuth,
  validate(analyticsSyncSchema),
  requireWorkspaceRole(),
  analyticsController.triggerSync
);

export default router;
