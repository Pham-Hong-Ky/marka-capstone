import type { Request, Response } from 'express';
import taskService from './task.service.js';
import type { BoardQuery, CreateTaskBody } from './task.validation.js';
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

export default { createTask, getBoard };
