import { getWorkspaceId } from '../../utils/request.js';
import { Request, Response } from 'express';
import type { WorkspaceRole } from '@prisma/client';
import ApiResponse from '../../utils/ApiResponse.js';
import catchAsync from '../../utils/catchAsync.js';
import aiService from './ai.service.js';
import type { GenerateImageBody, GenerateTextBody } from './ai.validation.js';

export const generateText = catchAsync(async (req: Request, res: Response) => {
  const result = await aiService.startTextGeneration({
    workspaceId: getWorkspaceId(req),
    userId: req.user!.id,
    role: req.workspaceRole as WorkspaceRole,
    body: req.body as GenerateTextBody,
  });

  return ApiResponse.success(res, {
    statusCode: 202,
    message: 'Đã đưa yêu cầu tạo nội dung vào hàng đợi',
    data: result,
  });
});

export const generateImage = catchAsync(async (req: Request, res: Response) => {
  const result = await aiService.startImageGeneration({
    workspaceId: getWorkspaceId(req),
    userId: req.user!.id,
    role: req.workspaceRole as WorkspaceRole,
    body: req.body as GenerateImageBody,
  });

  return ApiResponse.success(res, {
    statusCode: 202,
    message: 'Đã đưa yêu cầu tạo ảnh vào hàng đợi',
    data: result,
  });
});

export const getGeneration = catchAsync(async (req: Request, res: Response) => {
  const generation = await aiService.getGeneration({
    workspaceId: getWorkspaceId(req),
    generationId: req.params.generationId as string,
  });

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Lấy trạng thái tạo nội dung AI thành công',
    data: generation,
  });
});

export default {
  generateText,
  generateImage,
  getGeneration,
};
