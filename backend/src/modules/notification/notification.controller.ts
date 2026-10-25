import { Request, Response } from 'express';
import notificationService from './notification.service.js';
import type { ListNotificationsQuery, WorkspaceFilterQuery } from './notification.validation.js';
import ApiResponse from '../../utils/ApiResponse.js';
import catchAsync from '../../utils/catchAsync.js';

export const listNotifications = catchAsync(async (req: Request, res: Response) => {
  const { notifications, meta } = await notificationService.listNotifications(
    req.user!.id,
    req.query as unknown as ListNotificationsQuery
  );

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Lấy danh sách thông báo thành công',
    data: { notifications },
    meta,
  });
});

export const getUnreadCount = catchAsync(async (req: Request, res: Response) => {
  const { workspaceId } = req.query as WorkspaceFilterQuery;
  const unreadCount = await notificationService.getUnreadCount(req.user!.id, workspaceId);

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Lấy số thông báo chưa đọc thành công',
    data: { unreadCount },
  });
});

export const markNotificationRead = catchAsync(async (req: Request, res: Response) => {
  await notificationService.markNotificationRead(req.user!.id, req.params.notificationId as string);

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Đã đánh dấu thông báo là đã đọc',
  });
});

export const markAllNotificationsRead = catchAsync(async (req: Request, res: Response) => {
  const { workspaceId } = req.query as WorkspaceFilterQuery;
  const updated = await notificationService.markAllNotificationsRead(req.user!.id, workspaceId);

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Đã đánh dấu tất cả thông báo là đã đọc',
    data: { updated },
  });
});

export default {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
};
