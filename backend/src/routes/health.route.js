import { Router } from 'express';
import prisma from '../config/db.js';
import { cacheConnection } from '../config/redis.js';
import ApiResponse from '../utils/ApiResponse.js';
import catchAsync from '../utils/catchAsync.js';

const router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Kiểm tra trạng thái hệ thống
 *     tags: [System]
 *     responses:
 *       200:
 *         description: OK
 */
router.get(
  '/',
  catchAsync(async (req, res) => {
    let dbStatus = 'disconnected';
    let redisStatus = 'disconnected';

    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch {
      dbStatus = 'error';
    }

    try {
      const pingResult = await cacheConnection.ping();
      redisStatus = pingResult === 'PONG' ? 'connected' : 'idle';
    } catch {
      redisStatus = 'error';
    }

    return ApiResponse.success(res, {
      message: 'Marka API is healthy',
      data: {
        uptime: process.uptime(),
        database: dbStatus,
        redis: redisStatus,
        version: '1.0.0',
      },
    });
  })
);

export default router;
