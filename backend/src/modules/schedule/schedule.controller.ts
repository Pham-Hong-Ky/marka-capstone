import { getWorkspaceId } from '../../utils/request.js';
import { Request, Response } from 'express';
import ApiResponse from '../../utils/ApiResponse.js';
import catchAsync from '../../utils/catchAsync.js';
import scheduleService from './schedule.service.js';
import type { ListSchedulesQuery } from './schedule.validation.js';

export const createSchedules = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = getWorkspaceId(req);
  const { schedules, isImmediate } = await scheduleService.createSchedules(
    workspaceId,
    req.user!.id,
    req.params.postId as string,
    req.body
  );

  return ApiResponse.success(res, {
    statusCode: 201,
    message: isImmediate ? 'Đã đưa bài vào hàng đợi đăng' : 'Lên lịch đăng bài thành công',
    data: { schedules },
  });
});

export const listSchedules = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = getWorkspaceId(req);
  const { schedules, meta } = await scheduleService.listSchedules(
    workspaceId,
    req.query as unknown as ListSchedulesQuery
  );

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Lấy danh sách lịch đăng thành công',
    data: { schedules },
    meta,
  });
});

export const cancelSchedule = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = getWorkspaceId(req);
  await scheduleService.cancelSchedule(
    workspaceId,
    req.user!.id,
    req.params.scheduleId as string
  );

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Huỷ lịch đăng thành công',
    data: { success: true },
  });
});

export default {
  createSchedules,
  listSchedules,
  cancelSchedule,
};
