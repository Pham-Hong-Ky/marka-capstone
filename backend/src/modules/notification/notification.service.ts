import notificationRepository from './notification.repository.js';
import workspaceRepository from '../workspace/workspace.repository.js';
import type { ListNotificationsQuery } from './notification.validation.js';
import { ForbiddenError, NotFoundError } from '../../utils/errors/index.js';

const assertWorkspaceMembership = async (userId: string, workspaceId: string) => {
  const member = await workspaceRepository.findMember(workspaceId, userId);
  if (!member) {
    throw new ForbiddenError('Bạn không phải là thành viên của Workspace này');
  }
};

export const listNotifications = async (userId: string, query: ListNotificationsQuery) => {
  if (query.workspaceId) {
    await assertWorkspaceMembership(userId, query.workspaceId);
  }

  const [notifications, total] = await notificationRepository.listNotificationsAndCount({
    userId,
    workspaceId: query.workspaceId,
    isRead: query.isRead,
    skip: (query.page - 1) * query.limit,
    take: query.limit,
  });

  return {
    notifications,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

export const getUnreadCount = async (userId: string, workspaceId?: string) => {
  if (workspaceId) {
    await assertWorkspaceMembership(userId, workspaceId);
  }

  return notificationRepository.countUnread(userId, workspaceId);
};

export const markNotificationRead = async (userId: string, notificationId: string) => {
  const { count } = await notificationRepository.markNotificationRead(notificationId, userId);
  if (count === 0) {
    throw new NotFoundError('Thông báo không tồn tại');
  }
};

export const markAllNotificationsRead = async (userId: string, workspaceId?: string) => {
  if (workspaceId) {
    await assertWorkspaceMembership(userId, workspaceId);
  }

  const { count } = await notificationRepository.markAllNotificationsRead(userId, workspaceId);
  return count;
};

export default {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
};
