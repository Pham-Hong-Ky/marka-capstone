import { getWorkspaceId } from '../../utils/request.js';
import { Request, Response } from 'express';
import ApiResponse from '../../utils/ApiResponse.js';
import catchAsync from '../../utils/catchAsync.js';
import { enqueue } from '../../workers/queue-manager.js';
import { QUEUE_NAMES } from '../../workers/types.js';
import analyticsService from './analytics.service.js';
import type { AnalyticsOverviewQuery, AnalyticsSuggestionsQuery } from './analytics.validation.js';

export const getOverview = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = getWorkspaceId(req);
  const data = await analyticsService.getOverview(
    workspaceId,
    req.query as unknown as AnalyticsOverviewQuery
  );

  return ApiResponse.success(res, {
    message: 'Lấy thống kê thành công',
    data,
  });
});

export const getSuggestions = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = getWorkspaceId(req);
  const data = await analyticsService.getSuggestions(
    workspaceId,
    req.query as unknown as AnalyticsSuggestionsQuery
  );

  return ApiResponse.success(res, {
    message: 'Lấy gợi ý thành công',
    data,
  });
});

export const triggerSync = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = getWorkspaceId(req);
  // jobId theo workspace: bấm đồng bộ liên tục chỉ giữ một job chờ, tránh dội API nền tảng.
  await enqueue(
    QUEUE_NAMES.analytics,
    'analytics-sync',
    { workspaceId },
    { jobId: `analytics-sync-${workspaceId}`, removeOnComplete: true, removeOnFail: true }
  );

  return ApiResponse.success(res, {
    statusCode: 202,
    message: 'Đã đưa yêu cầu đồng bộ số liệu vào hàng đợi',
    data: { queued: true },
  });
});

export default {
  getOverview,
  getSuggestions,
  triggerSync,
};
