import prisma from '../../config/db.js';
import { cacheConnection } from '../../config/redis.js';

const HEALTH_WRITE_KEY = 'health:write-check';
const HEALTH_WRITE_TTL_SECONDS = 30;

export const getSystemHealth = async () => {
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

    if (pingResult !== 'PONG') {
      redisStatus = 'idle';
    } else {
      // PING vẫn chạy khi Redis chỉ còn đọc (hết hạn mức/quyền ghi), nên phải thử ghi
      // mới phát hiện được sự cố kiểu này.
      try {
        await cacheConnection.set(HEALTH_WRITE_KEY, '1', 'EX', HEALTH_WRITE_TTL_SECONDS);
        await cacheConnection.del(HEALTH_WRITE_KEY);
        redisStatus = 'connected';
      } catch {
        redisStatus = 'read-only';
      }
    }
  } catch {
    redisStatus = 'error';
  }

  return {
    uptime: process.uptime(),
    database: dbStatus,
    redis: redisStatus,
    memoryUsage: process.memoryUsage().rss,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  };
};

export default {
  getSystemHealth,
};
