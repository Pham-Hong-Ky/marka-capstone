import prisma from '../../config/db.js';
import { cacheConnection } from '../../config/redis.js';

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
    redisStatus = pingResult === 'PONG' ? 'connected' : 'idle';
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
