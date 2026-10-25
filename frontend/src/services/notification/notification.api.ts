import httpClient from '../httpClient';
import type { ApiResponse } from '@/types';
import type { PaginationMeta } from '../post/post.types';
import type {
  AppNotification,
  NotificationListParams,
  NotificationListResult,
} from './notification.types';

const DEFAULT_META: PaginationMeta = { page: 1, limit: 10, total: 0, totalPages: 0 };

export const listNotifications = async (
  params: NotificationListParams = {}
): Promise<NotificationListResult> => {
  const response = await httpClient.get<ApiResponse<{ notifications: AppNotification[] }>>(
    '/users/me/notifications',
    { params }
  );

  return {
    notifications: response.data.data?.notifications ?? [],
    meta: (response.data.meta as PaginationMeta | undefined) ?? DEFAULT_META,
  };
};

export const getUnreadCount = async (workspaceId?: string): Promise<number> => {
  const response = await httpClient.get<ApiResponse<{ unreadCount: number }>>(
    '/users/me/notifications/unread-count',
    { params: workspaceId ? { workspaceId } : undefined }
  );

  return response.data.data?.unreadCount ?? 0;
};

export const markNotificationRead = async (notificationId: string): Promise<void> => {
  await httpClient.patch(`/users/me/notifications/${notificationId}/read`);
};

export const markAllNotificationsRead = async (workspaceId?: string): Promise<void> => {
  await httpClient.patch('/users/me/notifications/read-all', null, {
    params: workspaceId ? { workspaceId } : undefined,
  });
};

export default {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
};
