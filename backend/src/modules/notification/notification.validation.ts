import { workspaceIdField } from '../../utils/validation/common.js';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  isRead: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  workspaceId: workspaceIdField.optional(),
});

export const notificationIdParamSchema = z.object({
  notificationId: z.string().uuid('Thông báo không hợp lệ'),
});

export const workspaceFilterQuerySchema = z.object({
  workspaceId: workspaceIdField.optional(),
});

export const listNotificationsSchema = { query: listNotificationsQuerySchema };
export const notificationIdSchema = { params: notificationIdParamSchema };
export const unreadCountSchema = { query: workspaceFilterQuerySchema };
export const markAllReadSchema = { query: workspaceFilterQuerySchema };

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
export type WorkspaceFilterQuery = z.infer<typeof workspaceFilterQuerySchema>;

export default {
  listNotificationsSchema,
  notificationIdSchema,
  unreadCountSchema,
  markAllReadSchema,
  listNotificationsQuerySchema,
  notificationIdParamSchema,
  workspaceFilterQuerySchema,
};
