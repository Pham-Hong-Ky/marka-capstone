import { Request, Response } from 'express';
import brandVoiceService from './brandvoice.service.js';
import ApiResponse from '../../utils/ApiResponse.js';
import catchAsync from '../../utils/catchAsync.js';

export const getBrandVoice = catchAsync(async (req: Request, res: Response) => {
  const data = await brandVoiceService.getBrandVoice(req.params.workspaceId as string);

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Lấy Brand Voice thành công',
    data,
  });
});

export const updateBrandVoice = catchAsync(async (req: Request, res: Response) => {
  const data = await brandVoiceService.updateBrandVoice(
    req.params.workspaceId as string,
    req.user!.id,
    req.body
  );

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Cập nhật Brand Voice thành công',
    data,
  });
});

export default {
  getBrandVoice,
  updateBrandVoice,
};
