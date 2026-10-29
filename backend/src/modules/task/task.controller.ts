import type { Request, Response } from 'express';
import taskService from './task.service.js';
import type {
  AssignTaskBody,
  BoardQuery,
  CreateTaskBody,
  UpdateTaskStatusBody,
} from './task.validation.js';
import { getWorkspaceId } from '../../utils/request.js';
import ApiResponse from '../../utils/ApiResponse.js';
import catchAsync from '../../utils/catchAsync.js';

export const createTask = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = getWorkspaceId(req);
  const task = await taskService.createTask(workspaceId, req.user!.id, req.body as CreateTaskBody);

  return ApiResponse.success(res, {
    statusCode: 201,
    message: 'Tạo công việc thành công',
    data: task,
  });
});

export const getBoard = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = getWorkspaceId(req);
  const board = await taskService.getTaskBoard(
    workspaceId,
    req.user!.id,
    req.workspaceRole!,
    req.query as unknown as BoardQuery
  );

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Lấy bảng công việc thành công',
    data: board,
  });
});

export const assignTask = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = getWorkspaceId(req);
  const body = req.body as AssignTaskBody;
  const task = await taskService.assignTask(
    workspaceId,
    req.user!.id,
    req.params.taskId as string,
    body
  );

  return ApiResponse.success(res, {
    statusCode: 200,
    message: body.assigneeId ? 'Giao việc thành công' : 'Đã bỏ giao việc',
    data: task,
  });
});

export const updateTaskStatus = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = getWorkspaceId(req);
  const task = await taskService.updateTaskStatus(
    workspaceId,
    req.user!.id,
    req.workspaceRole!,
    req.params.taskId as string,
    req.body as UpdateTaskStatusBody
  );

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Cập nhật trạng thái công việc thành công',
    data: task,
  });
});

export default { createTask, getBoard, assignTask, updateTaskStatus };
