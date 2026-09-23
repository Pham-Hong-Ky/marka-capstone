import { Request, Response } from 'express';
import healthService from './health.service.js';
import ApiResponse from '../../utils/ApiResponse.js';
import catchAsync from '../../utils/catchAsync.js';

export const checkHealth = catchAsync(async (_req: Request, res: Response) => {
  const healthData = await healthService.getSystemHealth();
  const isHealthy = healthData.database === 'connected' && healthData.redis === 'connected';

  if (!isHealthy) {
    return res.status(503).json({
      status: 'error',
      message: 'Hệ thống đang gặp sự cố kết nối',
      data: healthData,
    });
  }

  return ApiResponse.success(res, {
    message: 'Hệ thống Marka đang hoạt động ổn định',
    data: healthData,
  });
});

export default {
  checkHealth,
};
