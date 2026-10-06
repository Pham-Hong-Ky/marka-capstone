import { Request, Response } from 'express';
import workspaceService from './workspace.service.js';
import ApiResponse from '../../utils/ApiResponse.js';
import catchAsync from '../../utils/catchAsync.js';

export const createWorkspace = catchAsync(async (req: Request, res: Response) => {
  const workspace = await workspaceService.createWorkspace(req.user!.id, req.body);

  return ApiResponse.success(res, {
    statusCode: 201,
    message: 'Tạo workspace thành công',
    data: workspace,
  });
});

export const listWorkspaces = catchAsync(async (req: Request, res: Response) => {
  const workspaces = await workspaceService.listMyWorkspaces(req.user!.id);

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Lấy danh sách workspace thành công',
    data: { workspaces },
  });
});

export const updateWorkspace = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = req.params.workspaceId as string;
  const workspace = await workspaceService.updateWorkspace(workspaceId, req.user!.id, req.body);

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Cập nhật workspace thành công',
    data: workspace,
  });
});

export const deleteWorkspace = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = req.params.workspaceId as string;
  const result = await workspaceService.deleteWorkspace(workspaceId, req.user!.id);

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Xóa workspace thành công',
    data: result,
  });
});

export const uploadLogo = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = req.params.workspaceId as string;
  const result = await workspaceService.uploadWorkspaceLogo(workspaceId, req.user!.id, req.file);

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Cập nhật logo workspace thành công',
    data: result,
  });
});

export const listMembers = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = req.params.workspaceId as string;
  const data = await workspaceService.listMembers(workspaceId);

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Lấy danh sách thành viên thành công',
    data,
  });
});

export const inviteMember = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = req.params.workspaceId as string;
  const data = await workspaceService.inviteMember(
    workspaceId,
    { id: req.user!.id, name: req.user!.name },
    req.body
  );

  return ApiResponse.success(res, {
    statusCode: 201,
    message: 'Đã tạo lời mời tham gia workspace',
    data,
  });
});

export const acceptInvite = catchAsync(async (req: Request, res: Response) => {
  const token = req.params.token as string;
  const currentUser = req.user ? { id: req.user.id, email: req.user.email } : undefined;
  const data = await workspaceService.acceptInvite(token, currentUser);

  return ApiResponse.success(res, {
    statusCode: 200,
    message: data.requiresRegistration
      ? 'Bạn cần đăng ký tài khoản để tham gia workspace'
      : 'Tham gia workspace thành công',
    data,
  });
});

export const leaveWorkspace = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = req.params.workspaceId as string;
  const result = await workspaceService.leaveWorkspace(workspaceId, req.user!.id);

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Rời workspace thành công',
    data: result,
  });
});

export const removeMember = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = req.params.workspaceId as string;
  const memberId = req.params.memberId as string;
  const result = await workspaceService.removeMember(workspaceId, req.user!.id, memberId);

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Xóa thành viên thành công',
    data: result,
  });
});

export const changeMemberRole = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = req.params.workspaceId as string;
  const memberId = req.params.memberId as string;
  const result = await workspaceService.changeMemberRole(workspaceId, req.user!.id, memberId, req.body.role);

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Cập nhật vai trò thành viên thành công',
    data: result,
  });
});

export default {
  createWorkspace,
  listWorkspaces,
  updateWorkspace,
  deleteWorkspace,
  uploadLogo,
  listMembers,
  inviteMember,
  acceptInvite,
  leaveWorkspace,
  removeMember,
  changeMemberRole,
};
