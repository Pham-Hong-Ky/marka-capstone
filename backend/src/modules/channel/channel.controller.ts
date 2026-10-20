import { Request, Response } from 'express';
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

export const getFacebookAuthUrl = catchAsync(async (req: Request, res: Response) => {
  const data = await channelService.createFacebookAuthUrl(req.workspaceId!, req.user!.id);

  return ApiResponse.success(res, {
    message: 'Tạo URL đăng nhập Facebook thành công',
    data,
  });
});

export const facebookCallback = catchAsync(async (req: Request, res: Response) => {
  const redirectUrl = await channelService.handleFacebookCallback(req.query);

  return res.redirect(redirectUrl);
});

export const getPendingFacebookPages = catchAsync(async (req: Request, res: Response) => {
  const data = await channelService.getFacebookPendingPages(
    req.params.sessionId as string,
    req.user!.id,
    req.workspaceId!
  );

  return ApiResponse.success(res, {
    message: 'Lấy danh sách Page thành công',
    data,
  });
});

export const connectFacebookPages = catchAsync(async (req: Request, res: Response) => {
  const data = await channelService.connectFacebookPages(
    req.params.sessionId as string,
    req.user!.id,
    req.workspaceId!,
    req.body.pageIds as string[]
  );

  return ApiResponse.success(res, {
    statusCode: 201,
    message: 'Kết nối Facebook thành công',
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

export default {
  listChannels,
  getFacebookAuthUrl,
  facebookCallback,
  getPendingFacebookPages,
  connectFacebookPages,
  disconnectChannel,
};
