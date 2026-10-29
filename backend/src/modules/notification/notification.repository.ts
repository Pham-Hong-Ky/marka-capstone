import type { Prisma } from '@prisma/client';
import prisma from '../../config/db.js';

export const createNotification = async (data: {
  userId: string;
  workspaceId?: string | null;
  type: string;
  payload: Record<string, unknown>;
}) => {
  return prisma.notification.create({
    data: {
      userId: data.userId,
      workspaceId: data.workspaceId ?? null,
      type: data.type,
      payload: data.payload,
    },
  });
};

export interface ListNotificationsParams {
  userId: string;
  workspaceId?: string;
  isRead?: boolean;
  skip: number;
  take: number;
}

const buildWhere = (params: Omit<ListNotificationsParams, 'skip' | 'take'>): Prisma.NotificationWhereInput => ({
  userId: params.userId,
  ...(params.workspaceId ? { workspaceId: params.workspaceId } : {}),
  ...(params.isRead !== undefined ? { isRead: params.isRead } : {}),
});

export const listNotificationsAndCount = async (params: ListNotificationsParams) => {
  const where = buildWhere(params);

  return prisma.$transaction([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.take,
    }),
    prisma.notification.count({ where }),
  ]);
};

export const countUnread = async (userId: string, workspaceId?: string) => {
  return prisma.notification.count({
    where: { userId, isRead: false, ...(workspaceId ? { workspaceId } : {}) },
  });
};

export const markNotificationRead = async (notificationId: string, userId: string) => {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
};

export const markAllNotificationsRead = async (userId: string, workspaceId?: string) => {
  return prisma.notification.updateMany({
    where: { userId, isRead: false, ...(workspaceId ? { workspaceId } : {}) },
    data: { isRead: true },
  });
};

export const hasTaskReminder = async (params: {
  userId: string;
  type: string;
  taskId: string;
  dueAt: Date;
}) => {
  const count = await prisma.notification.count({
    where: {
      userId: params.userId,
      type: params.type,
      AND: [
        { payload: { path: ['taskId'], equals: params.taskId } },
        { payload: { path: ['dueAt'], equals: params.dueAt.toISOString() } },
      ],
    },
  });

  return count > 0;
};

export default {
  createNotification,
  listNotificationsAndCount,
  countUnread,
  markNotificationRead,
  markAllNotificationsRead,
  hasTaskReminder,
};
