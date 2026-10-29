import { Request, Response } from 'express';
import adminService from './admin.service.js';
import type {
  ListUsersQuery,
  ListWorkspacesQuery,
  SuspendUserBody,
} from './admin.validation.js';
import ApiResponse from '../../utils/ApiResponse.js';
import catchAsync from '../../utils/catchAsync.js';

export const getStats = catchAsync(async (_req: Request, res: Response) => {
  const stats = await adminService.getStats();

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Lấy số liệu hệ thống thành công',
    data: stats,
  });
});

export const listUsers = catchAsync(async (req: Request, res: Response) => {
  const { users, meta } = await adminService.listUsers(
    req.query as unknown as ListUsersQuery
  );

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Lấy danh sách người dùng thành công',
    data: { users },
    meta,
  });
});

export const suspendUser = catchAsync(async (req: Request, res: Response) => {
  const { suspended } = req.body as SuspendUserBody;
  const user = await adminService.setUserSuspension(
    req.user!.id,
    req.params.userId as string,
    req.body
  );

  return ApiResponse.success(res, {
    statusCode: 200,
    message: suspended ? 'Đã khoá tài khoản người dùng' : 'Đã mở khoá tài khoản người dùng',
    data: user,
  });
});

export const listWorkspaces = catchAsync(async (req: Request, res: Response) => {
  const { workspaces, meta } = await adminService.listWorkspaces(
    req.query as unknown as ListWorkspacesQuery
  );

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Lấy danh sách workspace thành công',
    data: { workspaces },
    meta,
  });
});

export default {
  getStats,
  listUsers,
  suspendUser,
  listWorkspaces,
};
