import httpClient from '../httpClient';
import { unwrapPaginated } from '../http';
import type { ApiResponse, PaginationMeta } from '@/types';
import type {
  AppNotification,
  NotificationListParams,
  NotificationListResult,
} from './notification.types';

export const listNotifications = async (
  params: NotificationListParams = {}
): Promise<NotificationListResult> => {
  const response = await httpClient.get<
    ApiResponse<{ notifications: AppNotification[] }, PaginationMeta>
  >('/users/me/notifications', { params });
  const { data, meta } = unwrapPaginated(response);

  return { notifications: data.notifications, meta };
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
  await httpClient.patch('/users/me/notifications/read-all', {}, {
    params: workspaceId ? { workspaceId } : undefined,
  });
};

export default {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
};
