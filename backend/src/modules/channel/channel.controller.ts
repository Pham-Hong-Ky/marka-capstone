import { Request, Response } from 'express';
import type { SocialPlatform } from '@prisma/client';
import channelService from './channel.service.js';
import ApiResponse from '../../utils/ApiResponse.js';
import catchAsync from '../../utils/catchAsync.js';

export const listChannels = catchAsync(async (req: Request, res: Response) => {
  const data = await channelService.listChannels(req.params.workspaceId as string);

  return ApiResponse.success(res, {
    message: 'Lấy danh sách kênh thành công',
    data,
  });
});

export const getOauthUrl = catchAsync(async (req: Request, res: Response) => {
  const data = await channelService.createAuthUrl(
    req.params.platform as SocialPlatform,
    req.workspaceId!,
    req.user!.id
  );

  return ApiResponse.success(res, {
    message: 'Tạo URL đăng nhập thành công',
    data,
  });
});

export const oauthCallback = catchAsync(async (req: Request, res: Response) => {
  const redirectUrl = await channelService.handleOauthCallback(
    req.params.platform as SocialPlatform,
    req.query
  );

  return res.redirect(redirectUrl);
});

export const getPendingAccounts = catchAsync(async (req: Request, res: Response) => {
  const data = await channelService.getPendingAccounts(
    req.params.platform as SocialPlatform,
    req.params.sessionId as string,
    req.user!.id,
    req.workspaceId!
  );

  return ApiResponse.success(res, {
    message: 'Lấy danh sách tài khoản thành công',
    data,
  });
});

export const connectAccounts = catchAsync(async (req: Request, res: Response) => {
  const data = await channelService.connectAccounts(
    req.params.platform as SocialPlatform,
    req.params.sessionId as string,
    req.user!.id,
    req.workspaceId!,
    req.body.accountIds as string[]
  );

  return ApiResponse.success(res, {
    statusCode: 201,
    message: 'Kết nối kênh thành công',
    data,
  });
});

export const disconnectChannel = catchAsync(async (req: Request, res: Response) => {
  const data = await channelService.disconnectChannel(
    req.params.channelId as string,
    req.workspaceId!,
    req.user!.id
  );

  return ApiResponse.success(res, {
    message: 'Ngắt kết nối kênh thành công',
    data,
  });
});

export const getChannelDetail = catchAsync(async (req: Request, res: Response) => {
  const data = await channelService.getChannelDetail(
    req.params.channelId as string,
    req.workspaceId!
  );

  return ApiResponse.success(res, {
    message: 'Lấy thông tin kênh thành công',
    data,
  });
});

export const updateChannelLabel = catchAsync(async (req: Request, res: Response) => {
  const data = await channelService.updateChannelLabel(
    req.params.channelId as string,
    req.workspaceId!,
    req.user!.id,
    req.body.label
  );

  return ApiResponse.success(res, {
    message: 'Cập nhật tên hiển thị của kênh thành công',
    data,
  });
});

export const refreshChannel = catchAsync(async (req: Request, res: Response) => {
  const data = await channelService.refreshChannel(
    req.params.channelId as string,
    req.workspaceId!,
    req.user!.id
  );

  return ApiResponse.success(res, {
    message: 'Làm mới thông tin kênh thành công',
    data,
  });
});

export default {
  listChannels,
  getOauthUrl,
  oauthCallback,
  getPendingAccounts,
  connectAccounts,
  disconnectChannel,
  getChannelDetail,
  updateChannelLabel,
  refreshChannel,
};
